import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: ResponseInit & { cache?: string }): Response {
  const headers = new Headers(init?.headers);
  if (init?.cache) headers.set("Cache-Control", init.cache);
  return Response.json(data, { ...init, headers });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response> | Response;

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function assertSameOrigin(req: Request) {
  if (!MUTATING.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "BAD_ORIGIN", "Request origin not allowed.");
  }
  if (host && originHost !== host) throw new ApiError(403, "BAD_ORIGIN", "Request origin not allowed.");
}

export function handle<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        return json({ error: { code: e.code, message: e.message } }, { status: e.status });
      }
      if (e instanceof ZodError) {
        return json(
          {
            error: {
              code: "VALIDATION",
              message: "Some fields are invalid.",
              fields: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
            },
          },
          { status: 400 }
        );
      }
      console.error("[api]", req.method, new URL(req.url).pathname, e);
      return json(
        { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } },
        { status: 500 }
      );
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 256_000) throw new ApiError(413, "TOO_LARGE", "Request body too large.");
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "BAD_JSON", "Request body must be valid JSON.");
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip")) || "local";
}

type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) {
    buckets.set(key, b);
    throw new ApiError(429, "RATE_LIMITED", "Too many requests. Please slow down and try again shortly.");
  }
  b.hits.push(now);
  buckets.set(key, b);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.hits.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
}

export function resetRateLimits() {
  buckets.clear();
}

export function limit(req: Request, name: string, max: number, windowMs = 60_000) {
  rateLimit(`${name}:${clientIp(req)}`, max, windowMs);
}
