import { handle, json } from "@/server/http";
import { getMapService } from "@/server/map";

/** Public capability flags only — never keys. */
export const GET = handle(async () => {
  const provider = getMapService().provider;
  return json(
    { routing: { provider, transit: provider === "google", estimated: provider !== "google" } },
    { cache: "public, s-maxage=300" }
  );
});
