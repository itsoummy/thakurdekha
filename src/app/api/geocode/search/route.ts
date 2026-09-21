import { z } from "zod";
import { handle, json, limit } from "@/server/http";
import { getMapService } from "@/server/map";
import { listFood, listPandals } from "@/server/repo";
import { parseQuery } from "@/server/validation";
import type { Place } from "@/lib/map/types";

const q = z.object({
  q: z.string().trim().min(2).max(120),
  type: z.enum(["pandal", "food"]).default("pandal"),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/** Existing community listings first (avoids duplicates), then map-provider results. */
export const GET = handle(async (req) => {
  limit(req, "geocode", 30);
  const p = parseQuery(q, req);
  const existing =
    p.type === "food"
      ? (await listFood({ q: p.q, limit: 5, includeStatuses: ["APPROVED", "PENDING"] })).data.map((f) => ({
          id: f.id, name: f.name, address: f.address ?? undefined, lat: f.latitude, lng: f.longitude, source: "community" as const,
        }))
      : (await listPandals({ q: p.q, limit: 5, includeStatuses: ["APPROVED", "PENDING"] })).data.map((x) => ({
          id: x.id, name: x.name, address: x.address ?? undefined, lat: x.latitude, lng: x.longitude, source: "community" as const,
        }));

  let external: Place[] = [];
  try {
    external = await getMapService().searchPlaces(p.q, p.lat !== undefined && p.lng !== undefined ? { lat: p.lat, lng: p.lng } : undefined);
  } catch (e) {
    console.error("[geocode]", e);
  }
  return json({ existing, places: external }, { cache: "private, no-store" });
});
