import { handle, json } from "@/server/http";
import { listFood } from "@/server/repo";
import { nearbyQuery, parseQuery } from "@/server/validation";

export const GET = handle(async (req) => {
  const p = parseQuery(nearbyQuery, req);
  const sortParam = new URL(req.url).searchParams.get("sort");
  const sort = sortParam === "rating" || sortParam === "popular" ? sortParam : "distance";
  const { data } = await listFood({ center: { lat: p.lat, lng: p.lng }, radius: p.radius, limit: p.limit, sort });
  return json({ data }, { cache: "public, s-maxage=20, stale-while-revalidate=60" });
});
