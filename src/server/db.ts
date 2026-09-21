import { createClient, type Client, type InValue, type Transaction } from "@libsql/client";
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { migrations } from "./migrations";
import { pandals as seedPandals } from "@/data/pandals";
import { foodSpots as seedFood } from "@/data/foodSpots";

export type Row = Record<string, unknown>;
type Arg = string | number | null | undefined;
type Exec = Client | Transaction;

export interface Stmt {
  all(...args: Arg[]): Promise<Row[]>;
  get(...args: Arg[]): Promise<Row | undefined>;
  run(...args: Arg[]): Promise<{ changes: number }>;
}

const txStore = new AsyncLocalStorage<Transaction>();
type G = typeof globalThis & { __tdDb?: Db };

export class Db {
  constructor(
    readonly client: Client,
    private ready: Promise<void> = Promise.resolve()
  ) {}

  setReady(p: Promise<void>) {
    p.catch(() => {});
    this.ready = p;
  }

  private async exec1(sql: string, args: Arg[], raw = false) {
    if (!raw) await this.ready;
    const ex: Exec = txStore.getStore() ?? this.client;
    const rs = await ex.execute({ sql, args: args.map((a) => (a === undefined ? null : a)) as InValue[] });
    return rs;
  }

  prepare(sql: string): Stmt {
    const toRow = (rs: Awaited<ReturnType<Db["exec1"]>>): Row[] =>
      rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));
    return {
      all: async (...a) => toRow(await this.exec1(sql, a)),
      get: async (...a) => toRow(await this.exec1(sql, a))[0],
      run: async (...a) => ({ changes: (await this.exec1(sql, a)).rowsAffected }),
    };
  }

  async exec(sql: string, raw = false) {
    if (!raw) await this.ready;
    const ex: Exec = txStore.getStore() ?? this.client;
    await ex.executeMultiple(sql);
  }

  async rawGet(sql: string, args: Arg[] = []): Promise<Row | undefined> {
    const rs = await this.exec1(sql, args, true);
    return rs.rows[0] ? Object.fromEntries(rs.columns.map((c, i) => [c, rs.rows[0][i]])) : undefined;
  }

  async rawRun(sql: string, args: Arg[] = []) {
    await this.exec1(sql, args, true);
  }
}

export function newId(prefix = ""): string {
  return prefix + randomBytes(9).toString("base64url");
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pandal"
  );
}

async function applyMigrations(db: Db) {
  await db.exec("CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)", true);
  const rs = await db.client.execute("SELECT id FROM _migrations");
  const done = new Set(rs.rows.map((r) => Number(r[0])));
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    await db.exec(m.sql, true);
    await db.rawRun("INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)", [m.id, m.name, new Date().toISOString()]);
  }
}

export async function seedIfEmpty(db: Db) {
  const row = await db.rawGet("SELECT COUNT(*) AS c FROM pandals");
  if (Number(row?.c) > 0) return;

  const pandalSql = `INSERT INTO pandals
    (id,name,slug,name_bn,description,history,established_year,current_theme,theme_status,category,zone,
     budget_range,opening_time,closing_time,crowd_rating,trending_score,latitude,longitude,address,
     nearest_metro,google_maps_url,verified,status,source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'APPROVED','seed')`;
  const foodSql = `INSERT INTO food_places
    (id,name,category,price_range,latitude,longitude,pujo_special,verified,status,source)
    VALUES (?,?,?,?,?,?,?,0,'APPROVED','seed')`;
  const linkSql = "INSERT OR IGNORE INTO pandal_food_links (pandal_id, food_place_id) VALUES (?,?)";

  const stmts: { sql: string; args: InValue[] }[] = [];
  for (const p of seedPandals) {
    const fromDirectory = p.theme2026 !== undefined;
    stmts.push({
      sql: pandalSql,
      args: [
        p.id,
        p.name,
        slugify(p.name),
        p.nameBn ?? null,
        p.description,
        fromDirectory ? p.description : null,
        p.establishedYear ?? null,
        p.theme2026 && p.theme2026 !== "Not announced" ? p.theme2026 : null,
        p.themeStatus ?? null,
        p.category ?? p.theme,
        p.zone,
        p.budgetRange,
        p.openingTime,
        p.closingTime,
        p.crowdRating,
        p.trendingScore,
        p.lat,
        p.lng,
        p.address,
        p.sourceNearestMetro ?? null,
        p.googleMapsUrl ?? null,
        fromDirectory ? 0 : 1,
      ],
    });
  }
  for (const f of seedFood) {
    stmts.push({ sql: foodSql, args: [f.id, f.name, f.cuisineTags.join(", "), f.priceRange, f.lat, f.lng, f.pujoSpecial ? 1 : 0] });
  }
  for (const p of seedPandals) {
    for (const fid of p.nearestFoodIds) stmts.push({ sql: linkSql, args: [p.id, fid] });
  }
  await db.client.batch(stmts, "write");
}

export async function openDatabase(url: string, authToken?: string): Promise<Db> {
  const client = createClient({ url, authToken });
  const db = new Db(client);
  if (url.startsWith("file:")) await client.execute("PRAGMA foreign_keys = ON");
  await applyMigrations(db);
  return db;
}

function defaultConfig(): { url: string; authToken?: string } {
  if (process.env.TURSO_DATABASE_URL) {
    return { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN };
  }
  if (process.env.DATABASE_PATH) return { url: `file:${process.env.DATABASE_PATH}` };
  if (process.env.VERCEL) return { url: "file:/tmp/thakurdekha.db" };
  return { url: `file:${path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "thakurdekha.db")}` };
}

export function getDb(): Db {
  const g = globalThis as G;
  if (!g.__tdDb) {
    const { url, authToken } = defaultConfig();
    const client = createClient({ url, authToken });
    const db = new Db(client);
    db.setReady(
      (async () => {
        if (url.startsWith("file:")) await client.execute("PRAGMA foreign_keys = ON");
        await applyMigrations(db);
        if (process.env.SEED_DATABASE !== "false") await seedIfEmpty(db);
      })()
    );
    g.__tdDb = db;
  }
  return g.__tdDb;
}

export function resetDbForTests(db: Db) {
  (globalThis as G).__tdDb = db;
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  const db = getDb();
  await db["ready"];
  const tx = await db.client.transaction("write");
  try {
    const r = await txStore.run(tx, fn);
    await tx.commit();
    return r;
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}
