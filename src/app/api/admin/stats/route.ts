import { handle, json } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";

const count = async (sql: string, ...args: (string | number)[]) =>
  Number((await getDb().prepare(sql).get(...args))?.c ?? 0);

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [pandals, food, users, reviews, plans, events] = await Promise.all([
    getDb().prepare("SELECT status, verified, COUNT(*) AS c FROM pandals GROUP BY status, verified").all(),
    getDb().prepare("SELECT status, COUNT(*) AS c FROM food_places GROUP BY status").all(),
    count("SELECT COUNT(*) AS c FROM users"),
    count("SELECT COUNT(*) AS c FROM pandal_reviews WHERE status = 'APPROVED'"),
    count("SELECT COUNT(*) AS c FROM puja_plans"),
    getDb().prepare("SELECT name, COUNT(*) AS c FROM analytics_events WHERE created_at >= ? GROUP BY name ORDER BY c DESC").all(since),
  ]);
  const sum = (rows: { status?: unknown; verified?: unknown; c?: unknown }[], pred: (r: { status?: unknown; verified?: unknown }) => boolean) =>
    rows.filter(pred).reduce((n, r) => n + Number(r.c), 0);
  const [pendingRecs, openReports] = await Promise.all([
    count("SELECT COUNT(*) AS c FROM food_recommendations WHERE status = 'PENDING'"),
    count("SELECT COUNT(*) AS c FROM reports WHERE status = 'OPEN'"),
  ]);
  return json(
    {
      pandals: {
        total: sum(pandals, () => true),
        verified: sum(pandals, (r) => r.status === "APPROVED" && Number(r.verified) === 1),
        community: sum(pandals, (r) => r.status === "APPROVED" && Number(r.verified) !== 1),
        pending: sum(pandals, (r) => r.status === "PENDING"),
        flagged: sum(pandals, (r) => r.status === "FLAGGED"),
      },
      food: {
        total: sum(food, () => true),
        approved: sum(food, (r) => r.status === "APPROVED"),
        pending: sum(food, (r) => r.status === "PENDING"),
        flagged: sum(food, (r) => r.status === "FLAGGED"),
      },
      users,
      approvedReviews: reviews,
      plans,
      pendingRecommendations: pendingRecs,
      openReports,
      events7d: events.map((e) => ({ name: e.name as string, count: Number(e.c) })),
    },
    { cache: "private, no-store" }
  );
});
