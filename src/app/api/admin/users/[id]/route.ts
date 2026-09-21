import { ApiError, handle, json, readJson } from "@/server/http";
import { requireAdmin, isAdminEmail } from "@/server/auth";
import { getDb } from "@/server/db";
import { roleSchema } from "@/server/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, ctx: Ctx) => {
  const admin = await requireAdmin(req);
  const { id } = await ctx.params;
  const { role } = roleSchema.parse(await readJson(req));
  if (id === admin.id) throw new ApiError(400, "SELF_CHANGE", "You can't change your own role.");
  const target = await getDb().prepare("SELECT email FROM users WHERE id = ?").get(id);
  if (!target) throw new ApiError(404, "NOT_FOUND", "User not found.");
  if (role === "USER" && isAdminEmail(target.email as string)) {
    throw new ApiError(400, "ENV_ADMIN", "This account is an admin through ADMIN_EMAILS. Remove it there first.");
  }
  await getDb().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  return json({ ok: true });
});
