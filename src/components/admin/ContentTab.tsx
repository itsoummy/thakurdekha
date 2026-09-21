"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/api";
import type { FoodDTO, PandalDTO } from "@/server/repo";
import ImageUploader from "@/components/ImageUploader";
import { btnGhost, btnPrimary, inputCls, Notice, Skeleton, TrustBadge } from "@/components/ui";

type Kind = "pandals" | "food";
type Item = PandalDTO | FoodDTO;

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox";
  options?: string[];
}

const ZONES = ["North", "South", "Central", "South-East", "South-West", "East", "Central-East", "Salt Lake", "New Town", "Howrah"];

const FIELDS: Record<Kind, FieldDef[]> = {
  pandals: [
    { key: "name", label: "Name", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "history", label: "History", type: "textarea" },
    { key: "currentTheme", label: "2026 theme", type: "text" },
    { key: "themeStatus", label: "Theme status note", type: "text" },
    { key: "category", label: "Category", type: "text" },
    { key: "zone", label: "Zone", type: "select", options: ZONES },
    { key: "budgetRange", label: "Budget", type: "select", options: ["Budget", "Mid", "Big Budget", "Theme Heavyweight"] },
    { key: "address", label: "Address", type: "text" },
    { key: "nearestMetro", label: "Nearest metro", type: "text" },
    { key: "openingTime", label: "Opens", type: "text" },
    { key: "closingTime", label: "Closes", type: "text" },
    { key: "establishedYear", label: "Established (year)", type: "number" },
    { key: "crowdRating", label: "Crowd (1-5)", type: "number" },
    { key: "googleMapsUrl", label: "Google Maps link", type: "text" },
    { key: "latitude", label: "Latitude", type: "number" },
    { key: "longitude", label: "Longitude", type: "number" },
  ],
  food: [
    { key: "name", label: "Name", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "category", label: "Category / cuisine", type: "text" },
    { key: "recommendedDish", label: "Recommended dish", type: "text" },
    { key: "priceRange", label: "Price", type: "select", options: ["₹", "₹₹", "₹₹₹"] },
    { key: "address", label: "Address", type: "text" },
    { key: "pujoSpecial", label: "Pujo special", type: "checkbox" },
    { key: "latitude", label: "Latitude", type: "number" },
    { key: "longitude", label: "Longitude", type: "number" },
  ],
};

const STATUSES = ["ALL", "PENDING", "APPROVED", "REJECTED", "FLAGGED"] as const;
const PAGE = 30;

const asString = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default function ContentTab({ kind }: { kind: Kind }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const [items, setItems] = useState<Item[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (offset: number) => {
      const r = await api<{ data: Item[]; total: number }>(
        `/api/admin/${kind}?q=${encodeURIComponent(q)}&status=${status}&limit=${PAGE}&offset=${offset}`
      );
      return r;
    },
    [kind, q, status]
  );

  const reload = useCallback(() => {
    fetchPage(0)
      .then((r) => {
        setItems(r.data);
        setTotal(r.total);
        setError(null);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [fetchPage]);

  useEffect(() => {
    const t = setTimeout(reload, 250);
    return () => clearTimeout(t);
  }, [reload]);

  async function more() {
    try {
      const r = await fetchPage(items?.length ?? 0);
      setItems((cur) => [...(cur ?? []), ...r.data]);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder={`Search ${kind === "pandals" ? "pandals" : "food places"}`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className={`${inputCls} max-w-[10rem]`} value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])} aria-label="Status">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All statuses" : s[0] + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <Link className={btnGhost} href={kind === "pandals" ? "/pandals/new" : "/food/new"}>
          + Add {kind === "pandals" ? "pandal" : "food place"}
        </Link>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {!items && !error && <Skeleton className="h-40 w-full" />}
      {items && <p className="text-xs text-smoke">{total} found</p>}

      <ul className="flex flex-col gap-2">
        {items?.map((it) => (
          <Row key={it.id} kind={kind} item={it} open={openId === it.id} onToggle={() => setOpenId(openId === it.id ? null : it.id)} onChanged={reload} />
        ))}
      </ul>
      {items && items.length < total && (
        <button className={`${btnGhost} self-center`} onClick={() => void more()}>
          Load more
        </button>
      )}
    </div>
  );
}

function Row({ kind, item, open, onToggle, onChanged }: { kind: Kind; item: Item; open: boolean; onToggle: () => void; onChanged: () => void }) {
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/admin/${kind}/${encodeURIComponent(item.id)}`;
  const sub = kind === "pandals" ? (item as PandalDTO).zone : (item as FoodDTO).category;

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "info", text: done });
      onChanged();
    } catch (e) {
      setMsg({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }
  const patch = (body: Record<string, unknown>, done: string) => run(() => api(base, { method: "PATCH", body }), done);

  return (
    <li className="rounded-lg border border-black/10 dark:border-white/10 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <Link className="font-medium underline" href={kind === "pandals" ? `/pandal/${item.id}` : `/food/${item.id}`}>
            {item.name}
          </Link>
          <div className="text-xs text-smoke">
            {sub ?? "—"} · {item.status}
            {item.images.length > 0 ? ` · ${item.images.length} photo${item.images.length === 1 ? "" : "s"}` : " · no photos"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrustBadge trust={item.trust} />
          <button className={btnGhost} onClick={onToggle} aria-expanded={open}>
            {open ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-black/10 dark:border-white/10 p-3 flex flex-col gap-3">
          <Editor kind={kind} item={item} busy={busy} onSave={(edits) => patch({ action: "edit", edits }, "Saved.")} />

          <div className="flex flex-wrap gap-2 border-t border-black/10 dark:border-white/10 pt-3">
            {item.verified && item.status === "APPROVED" ? (
              <button className={btnGhost} disabled={busy} onClick={() => void patch({ action: "approve", verified: false }, "Marked unverified.")}>
                Mark unverified
              </button>
            ) : (
              <button className={btnPrimary} disabled={busy} onClick={() => void patch({ action: "approve", verified: true }, "Approved and verified.")}>
                Approve &amp; verify
              </button>
            )}
            {item.status !== "APPROVED" && (
              <button className={btnGhost} disabled={busy} onClick={() => void patch({ action: "approve", verified: false }, "Approved as community.")}>
                Approve (unverified)
              </button>
            )}
            {item.status !== "REJECTED" && (
              <button className={btnGhost} disabled={busy} onClick={() => void patch({ action: "reject" }, "Hidden (rejected).")}>
                Hide
              </button>
            )}
            {item.status !== "FLAGGED" && (
              <button className={btnGhost} disabled={busy} onClick={() => void patch({ action: "flag" }, "Flagged.")}>
                Flag
              </button>
            )}
            <button
              className={btnGhost}
              disabled={busy}
              onClick={() => confirm(`Delete "${item.name}" permanently? This also removes its reviews and links.`) && void run(() => api(base, { method: "DELETE" }), "Deleted.")}
            >
              Delete
            </button>
          </div>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        </div>
      )}
    </li>
  );
}

function Editor({ kind, item, busy, onSave }: { kind: Kind; item: Item; busy: boolean; onSave: (edits: Record<string, unknown>) => void }) {
  const defs = FIELDS[kind];
  const rec = item as unknown as Record<string, unknown>;
  const [vals, setVals] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(defs.map((d) => [d.key, d.type === "checkbox" ? Boolean(rec[d.key]) : asString(rec[d.key])]))
  );
  const [images, setImages] = useState(item.images);

  function save() {
    const edits: Record<string, unknown> = {};
    for (const d of defs) {
      const now = vals[d.key];
      const was = d.type === "checkbox" ? Boolean(rec[d.key]) : asString(rec[d.key]);
      if (now === was) continue;
      if (d.type === "number") {
        if (now === "") continue;
        edits[d.key] = Number(now);
      } else if (d.type === "select" && now === "") continue;
      else edits[d.key] = now;
    }
    if (JSON.stringify(images) !== JSON.stringify(item.images)) edits.images = images;
    if (edits.latitude !== undefined || edits.longitude !== undefined) {
      edits.latitude = Number(vals.latitude);
      edits.longitude = Number(vals.longitude);
    }
    if (Object.keys(edits).length === 0) return;
    onSave(edits);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid sm:grid-cols-2 gap-3">
        {defs.map((d) => (
          <label key={d.key} className={`flex flex-col gap-1 text-xs text-smoke ${d.type === "textarea" ? "sm:col-span-2" : ""}`}>
            {d.label}
            {d.type === "textarea" ? (
              <textarea className={`${inputCls} py-2 min-h-24 text-foreground`} value={vals[d.key] as string} onChange={(e) => setVals({ ...vals, [d.key]: e.target.value })} />
            ) : d.type === "select" ? (
              <select className={`${inputCls} text-foreground`} value={vals[d.key] as string} onChange={(e) => setVals({ ...vals, [d.key]: e.target.value })}>
                <option value="">—</option>
                {d.options!.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : d.type === "checkbox" ? (
              <input type="checkbox" className="h-5 w-5" checked={vals[d.key] as boolean} onChange={(e) => setVals({ ...vals, [d.key]: e.target.checked })} />
            ) : (
              <input
                className={`${inputCls} text-foreground`}
                type={d.type === "number" ? "number" : "text"}
                step={d.key === "latitude" || d.key === "longitude" ? "any" : undefined}
                value={vals[d.key] as string}
                onChange={(e) => setVals({ ...vals, [d.key]: e.target.value })}
              />
            )}
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-smoke">Photos (only use photos you took or have permission to use)</span>
        <ImageUploader value={images} onChange={setImages} max={12} />
      </div>
      <button className={`${btnPrimary} self-start`} disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
