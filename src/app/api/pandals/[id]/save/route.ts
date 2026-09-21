import { getDb, newId } from "@/server/db";
import { ApiError, handle, json, limit } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getPandal } from "@/server/repo";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req, ctx: Ctx) => {
  const u = await requireUser(req);
  limit(req, "save", 120);
  const { id } = await ctx.params;
  if (!await getPandal(id)) throw new ApiError(404, "NOT_FOUND", "Pandal not found.");
  await getDb().prepare("INSERT OR IGNORE INTO saved_pandals (id,user_id,pandal_id) VALUES (?,?,?)").run(newId("s_"), u.id, id);
  return json({ saved: true });
});

export const DELETE = handle(async (req, ctx: Ctx) => {
  const u = await requireUser(req);
  const { id } = await ctx.params;
  await getDb().prepare("DELETE FROM saved_pandals WHERE user_id = ? AND pandal_id = ?").run(u.id, id);
  return json({ saved: false });
});
