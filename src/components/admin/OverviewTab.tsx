"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { btnGhost, Notice, Skeleton } from "@/components/ui";

interface Stats {
  pandals: { total: number; verified: number; community: number; pending: number; flagged: number };
  food: { total: number; approved: number; pending: number; flagged: number };
  users: number;
  approvedReviews: number;
  plans: number;
  pendingRecommendations: number;
  pendingPhotos: number;
  openReports: number;
  events7d: { name: string; count: number }[];
}

const EVENT_LABEL: Record<string, string> = {
  pandal_viewed: "Pandal views",
  food_place_viewed: "Food place views",
  directions_clicked: "Directions clicked",
  external_navigation_clicked: "Opened in Google Maps",
  location_permission_granted: "Location allowed",
  location_permission_denied: "Location denied",
  pandal_saved: "Pandals saved",
  pandal_visited: "Pandals marked visited",
  pandal_added_to_plan: "Added to plan",
  food_recommendation_submitted: "Food recommendations",
  pandal_submitted: "Pandals submitted",
  route_created: "Routes created",
  route_optimized: "Routes optimized",
};

function Card({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm">{label}</div>
      {hint && <div className="text-xs text-smoke">{hint}</div>}
    </div>
  );
}

export default function OverviewTab({ goTo }: { goTo: (s: "moderation" | "pandals" | "food" | "users") => void }) {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Stats>("/api/admin/stats").then(setS).catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!s) return <Skeleton className="h-40 w-full" />;

  const attention = s.pandals.pending + s.food.pending + s.pendingRecommendations + s.pendingPhotos + s.openReports + s.pandals.flagged + s.food.flagged;

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Needs attention" className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{attention ? `${attention} item${attention === 1 ? "" : "s"} need attention` : "Nothing waiting for review"}</h2>
          <button className={btnGhost} onClick={() => goTo("moderation")}>Open moderation</button>
        </div>
        <ul className="flex flex-wrap gap-2 text-sm">
          {[
            ["Pending pandals", s.pandals.pending],
            ["Pending food places", s.food.pending],
            ["Pending recommendations", s.pendingRecommendations],
            ["Pending photos", s.pendingPhotos],
            ["Open reports", s.openReports],
            ["Flagged pandals", s.pandals.flagged],
            ["Flagged food", s.food.flagged],
          ].map(([label, n]) => (
            <li key={label as string} className={`rounded-full px-3 py-1 border ${Number(n) ? "border-sindoor text-sindoor" : "border-black/10 dark:border-white/10 text-smoke"}`}>
              {label}: {n}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Content" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Pandals live" value={s.pandals.verified + s.pandals.community} hint={`${s.pandals.verified} verified · ${s.pandals.community} community/unverified`} />
        <Card label="Food places live" value={s.food.approved} hint={`${s.food.total} total`} />
        <Card label="Approved reviews" value={s.approvedReviews} />
        <Card label="Saved routes" value={s.plans} />
      </section>

      <section aria-label="Users" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Registered users" value={s.users} />
      </section>

      <section aria-label="Activity" className="flex flex-col gap-2">
        <h2 className="font-semibold">Last 7 days</h2>
        {s.events7d.length === 0 ? (
          <p className="text-sm text-smoke">No activity recorded yet.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2 text-sm">
            {s.events7d.map((e) => (
              <li key={e.name} className="flex justify-between rounded-lg border border-black/10 dark:border-white/10 px-3 py-2">
                <span>{EVENT_LABEL[e.name] ?? e.name}</span>
                <strong>{e.count}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
