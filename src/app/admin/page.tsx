"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import OverviewTab from "@/components/admin/OverviewTab";
import ContentTab from "@/components/admin/ContentTab";
import UsersTab from "@/components/admin/UsersTab";
import type { FoodDTO, PandalDTO } from "@/server/repo";
import { btnGhost, btnPrimary, fullUrl, inputCls, Notice, Skeleton, thumbUrl, TrustBadge } from "@/components/ui";

interface Report {
  id: string;
  entityType: string;
  entityId: string;
  reason: string;
  description: string | null;
  entityLabel: string | null;
  reporter: string;
}
interface Reco {
  id: string;
  rating: number | null;
  comment: string | null;
  recommendedDish: string | null;
  foodPlaceName: string;
  author: string;
}
interface PendingPhoto {
  id: string;
  image: string;
  pandalId: string;
  pandalName: string;
  author: string;
}
interface Dupe {
  kind: "PANDAL" | "FOOD";
  item: { id: string; name: string };
  candidate: { id: string; name: string };
}
interface Queue {
  pendingPandals: PandalDTO[];
  pendingFood: FoodDTO[];
  pendingRecommendations: Reco[];
  pendingPhotos: PendingPhoto[];
  flagged: { pandals: PandalDTO[]; food: FoodDTO[] };
  reportedContent: Report[];
  reportedReviews: Report[];
  duplicates: Dupe[];
}

const TABS = [
  ["pandals", "Pending Pandals"],
  ["food", "Pending Food Places"],
  ["photos", "Pending Photos"],
  ["reported", "Reported Content"],
  ["reviews", "Reported Reviews"],
  ["duplicates", "Duplicate Candidates"],
] as const;
type Tab = (typeof TABS)[number][0];

function Moderation() {
  const [q, setQ] = useState<Queue | null>(null);
  const [tab, setTab] = useState<Tab>("pandals");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Queue>("/api/admin/queue").then(setQ).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const counts: Record<Tab, number> = {
    pandals: (q?.pendingPandals.length ?? 0) + (q?.flagged.pandals.length ?? 0),
    food: (q?.pendingFood.length ?? 0) + (q?.pendingRecommendations.length ?? 0) + (q?.flagged.food.length ?? 0),
    photos: q?.pendingPhotos.length ?? 0,
    reported: q?.reportedContent.length ?? 0,
    reviews: q?.reportedReviews.length ?? 0,
    duplicates: q?.duplicates.length ?? 0,
  };

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="flex gap-1 overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`shrink-0 min-h-10 px-3 rounded-full text-sm ${tab === id ? "bg-sindoor text-white" : "border border-black/15 dark:border-white/20"}`}>
            {label} ({counts[id]})
          </button>
        ))}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!q && !error && <Skeleton className="h-32 w-full" />}

      {q && tab === "pandals" && (
        <List empty="Nothing waiting for review.">
          {[...q.pendingPandals, ...q.flagged.pandals].map((p) => (
            <ModRow
              key={p.id}
              kind="pandal"
              item={p}
              subtitle={`${p.address ?? ""} · ${p.currentTheme ?? "no theme"} · ${p.status}`}
              onAct={(body) => act(() => api(`/api/admin/pandals/${p.id}`, { method: "PATCH", body }))}
              onDelete={() => act(() => api(`/api/admin/pandals/${p.id}`, { method: "DELETE" }))}
            />
          ))}
        </List>
      )}

      {q && tab === "food" && (
        <>
          <List empty="No pending food places.">
            {[...q.pendingFood, ...q.flagged.food].map((f) => (
              <ModRow
                key={f.id}
                kind="food"
                item={f}
                subtitle={`${f.category ?? "—"} · ${f.recommendedDish ?? "—"} · ${f.status}`}
                onAct={(body) => act(() => api(`/api/admin/food/${f.id}`, { method: "PATCH", body }))}
                onDelete={() => act(() => api(`/api/admin/food/${f.id}`, { method: "DELETE" }))}
              />
            ))}
          </List>
          <h2 className="font-semibold mt-2">Pending recommendations</h2>
          <List empty="No pending recommendations.">
            {q.pendingRecommendations.map((r) => (
              <li key={r.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm flex flex-col gap-2">
                <div><strong>{r.foodPlaceName}</strong> · {r.author} · {r.rating ? `${r.rating}★` : "no rating"} {r.recommendedDish && `· ${r.recommendedDish}`}</div>
                {r.comment && <p>{r.comment}</p>}
                <div className="flex gap-2">
                  <button className={btnPrimary} onClick={() => act(() => api(`/api/admin/content/recommendations/${r.id}`, { method: "PATCH", body: { action: "approve" } }))}>Approve</button>
                  <button className={btnGhost} onClick={() => act(() => api(`/api/admin/content/recommendations/${r.id}`, { method: "PATCH", body: { action: "reject" } }))}>Reject</button>
                </div>
              </li>
            ))}
          </List>
        </>
      )}

      {q && tab === "photos" && (
        <List empty="No photos waiting for review.">
          {q.pendingPhotos.map((ph) => (
            <li key={ph.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm flex flex-wrap items-center gap-3">
              <a href={fullUrl(ph.image)} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl(ph.image)} alt={`Submitted photo for ${ph.pandalName}`} className="h-24 w-24 rounded-md object-cover" />
              </a>
              <div className="flex-1 min-w-40">
                <Link className="font-medium underline" href={`/pandal/${ph.pandalId}`}>{ph.pandalName}</Link>
                <div className="text-xs text-smoke">by {ph.author}</div>
              </div>
              <div className="flex gap-2">
                <button className={btnPrimary} onClick={() => act(() => api(`/api/admin/photos/${ph.id}`, { method: "PATCH", body: { action: "approve" } }))}>Approve</button>
                <button className={btnGhost} onClick={() => act(() => api(`/api/admin/photos/${ph.id}`, { method: "PATCH", body: { action: "reject" } }))}>Reject</button>
              </div>
            </li>
          ))}
        </List>
      )}

      {q && tab === "reported" && (
        <List empty="No open reports.">
          {q.reportedContent.map((r) => (
            <ReportRow
              key={r.id}
              r={r}
              onResolve={(status) => act(() => api(`/api/admin/reports/${r.id}`, { method: "PATCH", body: { status } }))}
              onFlag={() => act(async () => { await api(`/api/admin/${r.entityType === "PANDAL" ? "pandals" : "food"}/${r.entityId}`, { method: "PATCH", body: { action: "flag" } }); })}
              onDelete={() => act(async () => { await api(`/api/admin/${r.entityType === "PANDAL" ? "pandals" : "food"}/${r.entityId}`, { method: "DELETE" }); })}
            />
          ))}
        </List>
      )}

      {q && tab === "reviews" && (
        <List empty="No reported reviews.">
          {q.reportedReviews.map((r) => {
            const kind = r.entityType === "PANDAL_REVIEW" ? "reviews" : "recommendations";
            return (
              <ReportRow
                key={r.id}
                r={r}
                onResolve={(status) => act(() => api(`/api/admin/reports/${r.id}`, { method: "PATCH", body: { status } }))}
                onFlag={() => act(() => api(`/api/admin/content/${kind}/${r.entityId}`, { method: "PATCH", body: { action: "flag" } }))}
                onDelete={() => act(() => api(`/api/admin/content/${kind}/${r.entityId}`, { method: "DELETE" }))}
              />
            );
          })}
        </List>
      )}

      {q && tab === "duplicates" && (
        <List empty="No duplicate candidates.">
          {q.duplicates.map((d, i) => (
            <li key={i} className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>{d.item.name}</strong> may duplicate <strong>{d.candidate.name}</strong> ({d.kind.toLowerCase()})
              </span>
              <button
                className={btnPrimary}
                onClick={() => act(() => api(`/api/admin/${d.kind === "PANDAL" ? "pandals" : "food"}/${d.item.id}`, { body: { intoId: d.candidate.id } }))}
              >
                Merge into existing
              </button>
            </li>
          ))}
        </List>
      )}
    </div>
  );
}

function List({ children, empty }: { children: React.ReactNode; empty: string }) {
  const items = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : [];
  if (!items.length) return <p className="text-sm text-smoke">{empty}</p>;
  return <ul className="flex flex-col gap-2">{children}</ul>;
}

function ModRow({
  kind,
  item,
  subtitle,
  onAct,
  onDelete,
}: {
  kind: "pandal" | "food";
  item: PandalDTO | FoodDTO;
  subtitle: string;
  onAct: (body: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [verified, setVerified] = useState(false);

  return (
    <li className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link className="font-medium underline" href={kind === "pandal" ? `/pandal/${item.id}` : `/food/${item.id}`}>{item.name}</Link>
          <div className="text-xs text-smoke">{subtitle}</div>
          {item.description && <p className="mt-1">{item.description}</p>}
        </div>
        <TrustBadge trust={item.trust} />
      </div>
      {editing && (
        <div className="flex flex-col gap-2">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
          <textarea className={`${inputCls} py-2`} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" />
          <button className={btnGhost} onClick={() => { onAct({ action: "edit", edits: { name, description } }); setEditing(false); }}>Save edits</button>
        </div>
      )}
      <input className={inputCls} placeholder="Moderator notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> Mark as verified when approving</label>
      <div className="flex flex-wrap gap-2">
        <button className={btnPrimary} onClick={() => onAct({ action: "approve", verified, moderatorNotes: notes || undefined })}>Approve</button>
        <button className={btnGhost} onClick={() => onAct({ action: "reject", moderatorNotes: notes || undefined })}>Reject</button>
        <button className={btnGhost} onClick={() => onAct({ action: "flag", moderatorNotes: notes || undefined })}>Flag</button>
        <button className={btnGhost} onClick={() => setEditing((v) => !v)}>Edit</button>
        <button className={btnGhost} onClick={() => confirm(`Delete "${item.name}" permanently?`) && onDelete()}>Delete</button>
      </div>
    </li>
  );
}

function ReportRow({
  r,
  onResolve,
  onFlag,
  onDelete,
}: {
  r: Report;
  onResolve: (s: "RESOLVED" | "DISMISSED") => void;
  onFlag: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm flex flex-col gap-2">
      <div>
        <strong>{r.entityLabel ?? "(deleted)"}</strong> <span className="text-xs text-smoke">{r.entityType} · {r.reason} · by {r.reporter}</span>
      </div>
      {r.description && <p>{r.description}</p>}
      <div className="flex flex-wrap gap-2">
        <button className={btnPrimary} onClick={() => onResolve("RESOLVED")}>Resolve</button>
        <button className={btnGhost} onClick={() => onResolve("DISMISSED")}>Dismiss</button>
        <button className={btnGhost} onClick={onFlag}>Flag item</button>
        <button className={btnGhost} onClick={() => confirm("Delete the reported item permanently?") && onDelete()}>Delete item</button>
      </div>
    </li>
  );
}

const SECTIONS = [
  ["overview", "Overview"],
  ["moderation", "Moderation"],
  ["pandals", "Pandals"],
  ["food", "Food places"],
  ["users", "Users"],
] as const;
type Section = (typeof SECTIONS)[number][0];

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [section, setSection] = useState<Section>("overview");

  if (loading) return <div className="p-6"><Skeleton className="h-8 w-48" /></div>;
  if (user?.role !== "ADMIN")
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center flex flex-col items-center gap-3">
        <h1 className="text-xl font-bold">Admin access required</h1>
        <Link className={btnPrimary} href={user ? "/" : "/login?next=/admin"}>{user ? "Go home" : "Sign in"}</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Admin portal</h1>
      <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto border-b border-black/10 dark:border-white/10 pb-2">
        {SECTIONS.map(([id, label]) => (
          <button
            key={id}
            aria-current={section === id ? "page" : undefined}
            onClick={() => setSection(id)}
            className={`shrink-0 min-h-10 px-4 rounded-full text-sm font-medium ${section === id ? "bg-sindoor text-white" : "text-smoke hover:bg-black/5 dark:hover:bg-white/10"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {section === "overview" && <OverviewTab goTo={(s) => setSection(s)} />}
      {section === "moderation" && <Moderation />}
      {section === "pandals" && <ContentTab kind="pandals" />}
      {section === "food" && <ContentTab kind="food" />}
      {section === "users" && <UsersTab selfId={user.id} />}
    </div>
  );
}
