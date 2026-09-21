import { ApiError, handle, json } from "@/server/http";
import { getFood } from "@/server/repo";
import { getUser } from "@/server/auth";

export const GET = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await getUser(req);
  const f = await getFood(id, { includeAny: true });
  if (!f || (f.status !== "APPROVED" && user?.role !== "ADMIN")) {
    throw new ApiError(404, "NOT_FOUND", "Food place not found.");
  }
  return json(
    { data: f },
    { cache: f.status === "APPROVED" ? "public, s-maxage=30, stale-while-revalidate=120" : "private, no-store" }
  );
});
