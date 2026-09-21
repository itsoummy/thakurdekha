import { getDb } from "@/server/db";
import { handle, json, limit, readJson } from "@/server/http";
import { getUser } from "@/server/auth";
import { analyticsSchema } from "@/server/validation";

/** Product interaction events only — never coordinates or movement history. */
export const POST = handle(async (req) => {
  limit(req, "analytics", 240);
  const b = analyticsSchema.parse(await readJson(req));
  await getDb()
    .prepare("INSERT INTO analytics_events (name,entity_type,entity_id,user_id) VALUES (?,?,?,?)")
    .run(b.name, b.entityType ?? null, b.entityId ?? null, (await getUser(req))?.id ?? null);
  return json({ ok: true }, { status: 202 });
});
