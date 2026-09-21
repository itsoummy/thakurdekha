import { handle, json } from "@/server/http";
import { getMapService } from "@/server/map";
import { tursoConfig } from "@/server/db";

/** Public capability flags only — never keys. */
export const GET = handle(async () => {
  const provider = getMapService().provider;
  return json(
    {
      routing: { provider, transit: provider === "google", estimated: provider !== "google" },
      assistant: { enabled: Boolean(process.env.GEMINI_API_KEY) },
      storage: {
        database: tursoConfig() ? "turso" : "local-file",
        images: process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local-disk",
      },
    },
    { cache: "public, s-maxage=300" }
  );
});
