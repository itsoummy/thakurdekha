import { getDb } from "@/server/db";
import { handle, json } from "@/server/http";
import { requireUser } from "@/server/auth";
import { listPandals } from "@/server/repo";

export const GET = handle(async (req) => {
  const u = await requireUser(req);
  const ids = (
    (await getDb().prepare("SELECT pandal_id FROM saved_pandals WHERE user_id = ? ORDER BY created_at DESC").all(u.id)) as {
      pandal_id: string;
    }[]
  ).map((r) => r.pandal_id);
  const { data } = ids.length ? await listPandals({ ids, limit: 200 }) : { data: [] };
  return json({ data }, { cache: "private, no-store" });
});
