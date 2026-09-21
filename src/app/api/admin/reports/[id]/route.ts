import { z } from "zod";
import { getDb } from "@/server/db";
import { ApiError, handle, json, readJson } from "@/server/http";
import { requireAdmin } from "@/server/auth";

export const PATCH = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const { status } = z.object({ status: z.enum(["RESOLVED", "DISMISSED"]) }).parse(await readJson(req));
  const r = await getDb().prepare("UPDATE reports SET status = ? WHERE id = ?").run(status, id);
  if (!r.changes) throw new ApiError(404, "NOT_FOUND", "Report not found.");
  return json({ ok: true });
});
