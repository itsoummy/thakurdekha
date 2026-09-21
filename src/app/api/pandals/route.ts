import { z } from "zod";
import { handle, json } from "@/server/http";
import { listPandals } from "@/server/repo";
import { parseQuery } from "@/server/validation";

const q = z.object({
  q: z.string().trim().max(100).optional(),
  zone: z.string().max(40).optional(),
  budget: z.string().max(40).optional(),
  category: z.string().max(60).optional(),
  ids: z.string().max(2000).optional(),
  sort: z.enum(["trending", "distance", "crowd", "popular", "rating", "name"]).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().int().min(50).max(50_000).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(60),
  offset: z.coerce.number().int().min(0).default(0),
});

export const GET = handle(async (req) => {
  const p = parseQuery(q, req);
  const center = p.lat !== undefined && p.lng !== undefined ? { lat: p.lat, lng: p.lng } : undefined;
  const res = await listPandals({
    q: p.q,
    zone: p.zone,
    budget: p.budget,
    category: p.category,
    ids: p.ids?.split(",").filter(Boolean).slice(0, 100),
    sort: p.sort,
    center,
    radius: center ? p.radius : undefined,
    limit: p.limit,
    offset: p.offset,
  });
  return json(res, { cache: "public, s-maxage=30, stale-while-revalidate=120" });
});
