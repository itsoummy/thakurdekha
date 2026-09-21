import { ApiError, handle, json } from "@/server/http";
import { getPandal } from "@/server/repo";
import { getUser } from "@/server/auth";

export const GET = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await getUser(req);
  const p = await getPandal(id, { includeAny: true });
  const visible = p && (p.status === "APPROVED" || user?.role === "ADMIN");
  if (!p || !visible) throw new ApiError(404, "NOT_FOUND", "Pandal not found.");
  return json(
    { data: p },
    { cache: p.status === "APPROVED" ? "public, s-maxage=30, stale-while-revalidate=120" : "private, no-store" }
  );
});
