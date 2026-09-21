import { ApiError, handle, json, limit, readJson } from "@/server/http";
import { getMapService } from "@/server/map";
import { routeSchema } from "@/server/validation";

export const POST = handle(async (req) => {
  limit(req, "route", 40);
  const b = routeSchema.parse(await readJson(req));
  const svc = getMapService();
  try {
    const route = await svc.calculateRoute(b.origin, b.destination, b.mode);
    return json({ data: route, provider: svc.provider }, { cache: "private, no-store" });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    console.error("[routes]", e);
    throw new ApiError(502, "ROUTE_UNAVAILABLE", "We couldn't find a route for this destination right now.");
  }
});
