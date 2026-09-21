import { handle, json, limit, readJson } from "@/server/http";
import { requireUser } from "@/server/auth";
import { addRecommendation } from "@/server/recommend";
import { recommendSchema } from "@/server/validation";

export const POST = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(req);
  limit(req, "recommend", 30, 3_600_000);
  const { id } = await ctx.params;
  const rid = await addRecommendation(u.id, id, recommendSchema.parse(await readJson(req)));
  return json({ data: { id: rid, status: "PENDING" } }, { status: 201 });
});
