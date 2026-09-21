import { getDb, newId } from "@/server/db";
import { ApiError, handle, json, limit, rateLimit, readJson } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getPandal } from "@/server/repo";
import { photoSubmitSchema } from "@/server/validation";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req, ctx: Ctx) => {
  const u = await requireUser(req);
  limit(req, "photo-ip", 30, 3_600_000);
  rateLimit(`photo-user:${u.id}`, 20, 3_600_000);
  const { id } = await ctx.params;
  if (!(await getPandal(id))) throw new ApiError(404, "NOT_FOUND", "Pandal not found.");
  const { images } = photoSubmitSchema.parse(await readJson(req));
  const pending = Number((await getDb().prepare("SELECT COUNT(*) AS c FROM pandal_photos WHERE user_id = ? AND pandal_id = ? AND status = 'PENDING'").get(u.id, id))?.c ?? 0);
  if (pending + images.length > 8) {
    throw new ApiError(429, "TOO_MANY_PENDING", "You already have several photos waiting for review on this pandal.");
  }
  for (const image of new Set(images)) {
    await getDb().prepare("INSERT INTO pandal_photos (id,pandal_id,user_id,image) VALUES (?,?,?,?)").run(newId("ph_"), id, u.id, image);
  }
  return json({ ok: true, pending: images.length }, { status: 201 });
});
