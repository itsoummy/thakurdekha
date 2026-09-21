import { z } from "zod";
import { getDb, newId, transaction } from "@/server/db";
import { handle, json, limit, readJson } from "@/server/http";
import { requireUser } from "@/server/auth";
import { duplicateFood, listFood } from "@/server/repo";
import { foodCreateSchema, parseQuery } from "@/server/validation";

const q = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(60).optional(),
  pandalId: z.string().max(64).optional(),
  ids: z.string().max(2000).optional(),
  sort: z.enum(["distance", "rating", "popular", "name"]).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().int().min(50).max(50_000).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const GET = handle(async (req) => {
  const p = parseQuery(q, req);
  const center = p.lat !== undefined && p.lng !== undefined ? { lat: p.lat, lng: p.lng } : undefined;
  const res = await listFood({
    q: p.q,
    category: p.category,
    pandalId: p.pandalId,
    ids: p.ids?.split(",").filter(Boolean).slice(0, 100),
    sort: p.sort,
    center,
    radius: center ? p.radius : undefined,
    limit: p.limit,
    offset: p.offset,
  });
  return json(res, { cache: "public, s-maxage=30, stale-while-revalidate=120" });
});

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  limit(req, "food-submit", 15, 3_600_000);
  const b = foodCreateSchema.parse(await readJson(req));

  if (!b.force) {
    const dupes = await duplicateFood(b);
    if (dupes.length) {
      return json(
        { error: { code: "POSSIBLE_DUPLICATE", message: "We may already have this place listed." }, duplicates: dupes },
        { status: 409 }
      );
    }
  }

  const id = newId("f_");
  await transaction(async () => {
    const db = getDb();
    await db.prepare(
      `INSERT INTO food_places (id,name,description,category,recommended_dish,price_range,latitude,longitude,address,images,verified,status,source,created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,0,'PENDING','community',?)`
    ).run(
      id, b.name, b.description ?? null, b.category ?? null, b.recommendedDish ?? null, b.priceRange ?? null,
      b.latitude, b.longitude, b.address ?? null, JSON.stringify(b.images), user.id
    );
    const link = db.prepare("INSERT OR IGNORE INTO pandal_food_links (pandal_id, food_place_id) SELECT id, ? FROM pandals WHERE id = ?");
    for (const pid of b.pandalIds) await link.run(id, pid);
    if (b.rating || b.comment || b.recommendedDish) {
      await db.prepare(
        `INSERT INTO food_recommendations (id,user_id,food_place_id,pandal_id,rating,comment,recommended_dish,images,status)
         VALUES (?,?,?,?,?,?,?,?,'PENDING')`
      ).run(newId("fr_"), user.id, id, b.pandalIds[0] ?? null, b.rating ?? null, b.comment ?? null, b.recommendedDish ?? null, JSON.stringify(b.images));
    }
  });
  return json({ data: { id, status: "PENDING" } }, { status: 201 });
});
