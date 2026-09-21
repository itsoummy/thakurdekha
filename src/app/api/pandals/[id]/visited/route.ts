import { getDb, newId } from "@/server/db";
import { ApiError, handle, json, limit } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getPandal } from "@/server/repo";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req, ctx: Ctx) => {
  const u = await requireUser(req);
  limit(req, "visited", 120);
  const { id } = await ctx.params;
  if (!await getPandal(id)) throw new ApiError(404, "NOT_FOUND", "Pandal not found.");
  await getDb().prepare("INSERT OR IGNORE INTO visited_pandals (id,user_id,pandal_id) VALUES (?,?,?)").run(newId("v_"), u.id, id);
  return json({ visited: true });
});

export const DELETE = handle(async (req, ctx: Ctx) => {
  const u = await requireUser(req);
  const { id } = await ctx.params;
  await getDb().prepare("DELETE FROM visited_pandals WHERE user_id = ? AND pandal_id = ?").run(u.id, id);
  return json({ visited: false });
});
