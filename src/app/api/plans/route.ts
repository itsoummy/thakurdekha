import { handle, json, limit, readJson } from "@/server/http";
import { requireUser } from "@/server/auth";
import { createPlan, listPlans } from "@/server/plans";
import { planSchema } from "@/server/validation";

export const GET = handle(async (req) => {
  const u = await requireUser(req);
  return json({ data: await listPlans(u.id) }, { cache: "private, no-store" });
});

export const POST = handle(async (req) => {
  const u = await requireUser(req);
  limit(req, "plan", 60);
  const plan = await createPlan(u.id, planSchema.parse(await readJson(req)));
  return json({ data: plan }, { status: 201 });
});
