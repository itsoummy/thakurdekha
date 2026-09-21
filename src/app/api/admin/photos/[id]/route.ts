import { handle, json, readJson } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { moderatePhoto } from "@/server/moderation";
import { photoModerationSchema } from "@/server/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, ctx: Ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const { action } = photoModerationSchema.parse(await readJson(req));
  await moderatePhoto(id, action);
  return json({ ok: true });
});
