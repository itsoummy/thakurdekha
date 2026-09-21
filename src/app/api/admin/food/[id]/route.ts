import { handle, json, readJson } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { deleteItem, mergeFood, moderate } from "@/server/moderation";
import { moderationSchema } from "@/server/validation";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, ctx: Ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  await moderate("food_places", id, moderationSchema.parse(await readJson(req)));
  return json({ ok: true });
});

export const DELETE = handle(async (req, ctx: Ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  await deleteItem("food_places", id);
  return json({ ok: true });
});

export const POST = handle(async (req, ctx: Ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const { intoId } = z.object({ intoId: z.string().min(1).max(64) }).parse(await readJson(req));
  await mergeFood(id, intoId);
  return json({ ok: true });
});
