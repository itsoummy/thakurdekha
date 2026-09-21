import { getDb, newId } from "@/server/db";
import { ApiError, handle, json, limit, readJson } from "@/server/http";
import { requireUser } from "@/server/auth";
import { reportSchema } from "@/server/validation";

const TABLE = {
  PANDAL: "pandals",
  FOOD: "food_places",
  PANDAL_REVIEW: "pandal_reviews",
  FOOD_RECOMMENDATION: "food_recommendations",
} as const;

export const POST = handle(async (req) => {
  const u = await requireUser(req);
  limit(req, "report", 20, 3_600_000);
  const b = reportSchema.parse(await readJson(req));
  const db = getDb();
  if (!await db.prepare(`SELECT 1 FROM ${TABLE[b.entityType]} WHERE id = ?`).get(b.entityId)) {
    throw new ApiError(404, "NOT_FOUND", "The reported item no longer exists.");
  }
  await db.prepare("INSERT INTO reports (id,user_id,entity_type,entity_id,reason,description) VALUES (?,?,?,?,?,?)").run(
    newId("rp_"), u.id, b.entityType, b.entityId, b.reason, b.description ?? null
  );
  return json({ ok: true }, { status: 201 });
});
