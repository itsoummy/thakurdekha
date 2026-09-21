import { handle, json } from "@/server/http";
import { listPandals } from "@/server/repo";
import { nearbyQuery, parseQuery } from "@/server/validation";

export const GET = handle(async (req) => {
  const p = parseQuery(nearbyQuery, req);
  const { data } = await listPandals({ center: { lat: p.lat, lng: p.lng }, radius: p.radius, limit: p.limit, sort: "distance" });
  return json({ data }, { cache: "public, s-maxage=20, stale-while-revalidate=60" });
});
