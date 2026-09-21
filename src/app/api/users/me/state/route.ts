import { getDb } from "@/server/db";
import { handle, json } from "@/server/http";
import { requireUser } from "@/server/auth";

export const GET = handle(async (req) => {
  const u = await requireUser(req);
  const db = getDb();
  const ids = async (sql: string) => ((await db.prepare(sql).all(u.id)) as { pandal_id: string }[]).map((r) => r.pandal_id);
  const submissions = await db
    .prepare("SELECT id,name,status,moderator_notes AS moderatorNotes,created_at AS createdAt FROM pandals WHERE created_by = ? ORDER BY created_at DESC LIMIT 50")
    .all(u.id);
  const foodSubmissions = await db
    .prepare("SELECT id,name,status,moderator_notes AS moderatorNotes,created_at AS createdAt FROM food_places WHERE created_by = ? ORDER BY created_at DESC LIMIT 50")
    .all(u.id);
  return json(
    {
      saved: await ids("SELECT pandal_id FROM saved_pandals WHERE user_id = ?"),
      visited: await ids("SELECT pandal_id FROM visited_pandals WHERE user_id = ?"),
      submissions,
      foodSubmissions,
    },
    { cache: "private, no-store" }
  );
});
