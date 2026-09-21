import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getDb, newId } from "./db";
import { ApiError } from "./http";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "td_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isAdminEmail(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await getDb()
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)")
    .run(sha256(token), userId, expires.toISOString());
  return { token, expires };
}

export function sessionCookie(token: string, expires: Date): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${secure}`;
}

export function clearCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export async function destroySession(req: Request) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

export async function getUser(req: Request): Promise<SessionUser | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const row = (await getDb()
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, s.expires_at FROM sessions s
       JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`
    )
    .get(sha256(token))) as (SessionUser & { expires_at: string }) | undefined;
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    await getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
    return null;
  }
  const role = row.role === "ADMIN" || isAdminEmail(row.email) ? "ADMIN" : "USER";
  return { id: row.id, email: row.email, name: row.name, role };
}

export async function requireUser(req: Request): Promise<SessionUser> {
  const u = await getUser(req);
  if (!u) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  return u;
}

export async function requireAdmin(req: Request): Promise<SessionUser> {
  const u = await requireUser(req);
  if (u.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Admin access required.");
  return u;
}

export function newUserId() {
  return newId("u_");
}
