import { handle, json } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { listFood } from "@/server/repo";
import { adminListQuery } from "@/server/validation";
import type { Status } from "@/server/repo";

const ALL: Status[] = ["PENDING", "APPROVED", "REJECTED", "FLAGGED"];

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const q = adminListQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const r = await listFood({
    q: q.q || undefined,
    includeStatuses: q.status === "ALL" ? ALL : [q.status],
    sort: "name",
    limit: q.limit,
    offset: q.offset,
  });
  return json(r, { cache: "private, no-store" });
});
