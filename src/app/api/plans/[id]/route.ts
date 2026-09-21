import { handle, json, limit, readJson } from "@/server/http";
import { requireUser } from "@/server/auth";
import { deletePlan, getPlan, updatePlan } from "@/server/plans";
import { planSchema } from "@/server/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req, ctx: Ctx) => {
  const u = await requireUser(req);
  const { id } = await ctx.params;
  return json({ data: await getPlan(u.id, id) }, { cache: "private, no-store" });
});

export const PUT = handle(async (req, ctx: Ctx) => {
  const u = await requireUser(req);
  limit(req, "plan", 60);
  const { id } = await ctx.params;
  return json({ data: await updatePlan(u.id, id, planSchema.parse(await readJson(req))) });
});

export const DELETE = handle(async (req, ctx: Ctx) => {
  const u = await requireUser(req);
  const { id } = await ctx.params;
  await deletePlan(u.id, id);
  return json({ ok: true });
});
