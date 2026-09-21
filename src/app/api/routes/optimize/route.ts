import { handle, json, limit, readJson } from "@/server/http";
import { optimizeStops } from "@/lib/optimize";
import { optimizeSchema } from "@/server/validation";

export const POST = handle(async (req) => {
  limit(req, "optimize", 30);
  const b = optimizeSchema.parse(await readJson(req));
  const result = optimizeStops(b.origin, b.stops, b.travelMode);
  return json({ data: result }, { cache: "private, no-store" });
});
