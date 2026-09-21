import { getDb, newId } from "@/server/db";
import { ApiError, handle, json, limit, readJson } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getPandal } from "@/server/repo";
import { reviewSchema } from "@/server/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!await getPandal(id)) throw new ApiError(404, "NOT_FOUND", "Pandal not found.");
  const rows = (await getDb()
    .prepare(
      `SELECT r.id, r.rating, r.comment, r.images, r.created_at AS createdAt, u.name AS author
       FROM pandal_reviews r JOIN users u ON u.id = r.user_id
       WHERE r.pandal_id = ? AND r.status = 'APPROVED' ORDER BY r.created_at DESC LIMIT 50`
    )
    .all(id)) as { images: string }[];
  return json(
    { data: rows.map((r) => ({ ...r, images: JSON.parse(r.images) })) },
    { cache: "public, s-maxage=15, stale-while-revalidate=60" }
  );
});

export const POST = handle(async (req, ctx: Ctx) => {
  const u = await requireUser(req);
  limit(req, "review", 20, 3_600_000);
  const { id } = await ctx.params;
  if (!await getPandal(id)) throw new ApiError(404, "NOT_FOUND", "Pandal not found.");
  const b = reviewSchema.parse(await readJson(req));
  await getDb()
    .prepare(
      `INSERT INTO pandal_reviews (id,user_id,pandal_id,rating,comment,images,status) VALUES (?,?,?,?,?,?,'APPROVED')
       ON CONFLICT(user_id,pandal_id) DO UPDATE SET rating=excluded.rating, comment=excluded.comment, images=excluded.images`
    )
    .run(newId("r_"), u.id, id, b.rating, b.comment ?? null, JSON.stringify(b.images));
  return json({ ok: true }, { status: 201 });
});
