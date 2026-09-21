import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { openDatabase, resetDbForTests, seedIfEmpty } from "@/server/db";
import { resetRateLimits } from "@/server/http";

export async function freshDb(seed = true) {
  const file = path.join(os.tmpdir(), `td-test-${randomBytes(6).toString("hex")}.db`);
  const db = await openDatabase(`file:${file}`);
  resetDbForTests(db);
  resetRateLimits();
  if (seed) await seedIfEmpty(db);
  return db;
}

export function req(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}
): Request {
  const headers: Record<string, string> = { host: "localhost:3000", ...(init.headers ?? {}) };
  if (init.cookie) headers.cookie = init.cookie;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  return new Request(`http://localhost:3000${path}`, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

export const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

export async function register(
  handler: (r: Request, c: never) => Promise<Response> | Response,
  email = "user@example.com",
  name = "Test User"
): Promise<string> {
  const res = await handler(req("/api/auth/register", { body: { email, name, password: "password123" } }), undefined as never);
  const set = res.headers.get("set-cookie") ?? "";
  return set.split(";")[0];
}
