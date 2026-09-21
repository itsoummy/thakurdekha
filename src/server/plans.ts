import { getDb, newId, transaction } from "./db";
import { ApiError } from "./http";
import { planSchema } from "./validation";
import type { z } from "zod";

export interface PlanDTO {
  id: string;
  name: string;
  travelMode: string | null;
  stops: { type: "PANDAL" | "FOOD"; id: string }[];
  createdAt: string;
  updatedAt: string;
}

async function load(planId: string): Promise<PlanDTO | null> {
  const db = getDb();
  const p = (await db.prepare("SELECT id,name,travel_mode,created_at,updated_at FROM puja_plans WHERE id = ?").get(planId)) as
    | { id: string; name: string; travel_mode: string | null; created_at: string; updated_at: string }
    | undefined;
  if (!p) return null;
  const stops = (await db
    .prepare("SELECT entity_type, entity_id FROM puja_plan_stops WHERE plan_id = ? ORDER BY position")
    .all(planId)) as { entity_type: "PANDAL" | "FOOD"; entity_id: string }[];
  return {
    id: p.id,
    name: p.name,
    travelMode: p.travel_mode,
    stops: stops.map((s) => ({ type: s.entity_type, id: s.entity_id })),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

async function assertStopsExist(stops: z.infer<typeof planSchema>["stops"]) {
  const db = getDb();
  for (const s of stops) {
    const table = s.type === "PANDAL" ? "pandals" : "food_places";
    if (!(await db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND status = 'APPROVED'`).get(s.id))) {
      throw new ApiError(400, "BAD_STOP", "One of the stops doesn't exist anymore.");
    }
  }
}

async function writeStops(planId: string, stops: z.infer<typeof planSchema>["stops"]) {
  const db = getDb();
  await db.prepare("DELETE FROM puja_plan_stops WHERE plan_id = ?").run(planId);
  const ins = db.prepare("INSERT INTO puja_plan_stops (id,plan_id,entity_type,entity_id,position) VALUES (?,?,?,?,?)");
  for (const [i, s] of stops.entries()) await ins.run(newId("ps_"), planId, s.type, s.id, i);
}

export async function listPlans(userId: string): Promise<PlanDTO[]> {
  const ids = (await getDb().prepare("SELECT id FROM puja_plans WHERE user_id = ? ORDER BY updated_at DESC").all(userId)) as { id: string }[];
  const plans = await Promise.all(ids.map((r) => load(r.id)));
  return plans.filter((p): p is PlanDTO => Boolean(p));
}

export async function getPlan(userId: string, id: string): Promise<PlanDTO> {
  const owner = (await getDb().prepare("SELECT user_id FROM puja_plans WHERE id = ?").get(id)) as { user_id: string } | undefined;
  if (!owner || owner.user_id !== userId) throw new ApiError(404, "NOT_FOUND", "Plan not found.");
  return (await load(id))!;
}

export async function createPlan(userId: string, body: z.infer<typeof planSchema>): Promise<PlanDTO> {
  await assertStopsExist(body.stops);
  const id = newId("pl_");
  await transaction(async () => {
    await getDb().prepare("INSERT INTO puja_plans (id,user_id,name,travel_mode) VALUES (?,?,?,?)").run(id, userId, body.name, body.travelMode ?? null);
    await writeStops(id, body.stops);
  });
  return (await load(id))!;
}

export async function updatePlan(userId: string, id: string, body: z.infer<typeof planSchema>): Promise<PlanDTO> {
  await getPlan(userId, id);
  await assertStopsExist(body.stops);
  await transaction(async () => {
    await getDb()
      .prepare("UPDATE puja_plans SET name = ?, travel_mode = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
      .run(body.name, body.travelMode ?? null, id);
    await writeStops(id, body.stops);
  });
  return (await load(id))!;
}

export async function deletePlan(userId: string, id: string) {
  await getPlan(userId, id);
  await getDb().prepare("DELETE FROM puja_plans WHERE id = ?").run(id);
}
