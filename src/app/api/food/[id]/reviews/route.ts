import { getDb } from "@/server/db";
import { ApiError, handle, json, limit, readJson } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getFood } from "@/server/repo";
import { addRecommendation } from "@/server/recommend";
import { recommendSchema } from "@/server/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!await getFood(id)) throw new ApiError(404, "NOT_FOUND", "Food place not found.");
  const rows = (await getDb()
    .prepare(
      `SELECT r.id, r.rating, r.comment, r.recommended_dish AS recommendedDish, r.images, r.created_at AS createdAt, u.name AS author
       FROM food_recommendations r JOIN users u ON u.id = r.user_id
       WHERE r.food_place_id = ? AND r.status = 'APPROVED' ORDER BY r.created_at DESC LIMIT 50`
    )
    .all(id)) as { images: string }[];
  return json(
    { data: rows.map((r) => ({ ...r, images: JSON.parse(r.images) })) },
    { cache: "public, s-maxage=15, stale-while-revalidate=60" }
  );
});

export const POST = handle(async (req, ctx: Ctx) => {
  const u = await requireUser(req);
  limit(req, "recommend", 30, 3_600_000);
  const { id } = await ctx.params;
  const rid = await addRecommendation(u.id, id, recommendSchema.parse(await readJson(req)));
  return json({ data: { id: rid, status: "PENDING" } }, { status: 201 });
});
