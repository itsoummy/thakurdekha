import { ApiError, handle } from "@/server/http";
import { defaultStorage } from "@/server/storage";

export const GET = handle(async (_req, ctx: { params: Promise<{ name: string }> }) => {
  const { name } = await ctx.params;
  if (!/^[a-zA-Z0-9_-]{6,64}(\.thumb)?\.webp$/.test(name)) throw new ApiError(404, "NOT_FOUND", "Image not found.");
  const data = await defaultStorage().get(name);
  if (!data) throw new ApiError(404, "NOT_FOUND", "Image not found.");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
