import { ApiError, handle, json, readJson } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { deleteItem, moderate } from "@/server/moderation";
import { moderationSchema } from "@/server/validation";

type Ctx = { params: Promise<{ kind: string; id: string }> };

const KINDS = { recommendations: "food_recommendations", reviews: "pandal_reviews" } as const;

function table(kind: string) {
  const t = KINDS[kind as keyof typeof KINDS];
  if (!t) throw new ApiError(404, "NOT_FOUND", "Unknown content type.");
  return t;
}

export const PATCH = handle(async (req, ctx: Ctx) => {
  await requireAdmin(req);
  const { kind, id } = await ctx.params;
  await moderate(table(kind), id, moderationSchema.parse(await readJson(req)));
  return json({ ok: true });
});

export const DELETE = handle(async (req, ctx: Ctx) => {
  await requireAdmin(req);
  const { kind, id } = await ctx.params;
  await deleteItem(table(kind), id);
  return json({ ok: true });
});
