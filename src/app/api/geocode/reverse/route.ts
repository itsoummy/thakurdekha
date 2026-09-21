import { z } from "zod";
import { handle, json, limit } from "@/server/http";
import { getMapService } from "@/server/map";
import { parseQuery } from "@/server/validation";

const q = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const GET = handle(async (req) => {
  limit(req, "reverse", 30);
  const p = parseQuery(q, req);
  try {
    const address = await getMapService().reverseGeocode(p.lat, p.lng);
    return json({ data: address }, { cache: "private, no-store" });
  } catch {
    return json({ data: null }, { cache: "private, no-store" });
  }
});
