"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { PandalDTO } from "@/server/repo";
import { unverifiedPandals } from "@/data/unverifiedPandals";
import { api } from "@/lib/api";
import PandalCard from "@/components/PandalCard";
import FilterBar, { defaultFilters } from "@/components/FilterBar";
import LocationPermissionDialog from "@/components/LocationPermissionDialog";
import { useDebounced } from "@/components/GlobalSearch";
import { btnGhost, btnPrimary, CardSkeleton, Notice } from "@/components/ui";
import { useGeolocation } from "@/hooks/useGeolocation";

const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-black/5 dark:bg-white/5" />,
});

const PAGE = 24;
const SORT = { trending: "trending", distance: "distance", crowd: "crowd" } as const;

export default function Home() {
  return (
    <Suspense>
      <Discover />
    </Suspense>
  );
}

function Discover() {
  const initialQ = useSearchParams().get("q") ?? "";
  const [view, setView] = useState<"list" | "map">("list");
  const [filters, setFilters] = useState({ ...defaultFilters(), query: initialQ });
  const [items, setItems] = useState<PandalDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [offset, setOffset] = useState(0);
  const [askLocation, setAskLocation] = useState(false);
  const { position, status, request } = useGeolocation();
  const query = useDebounced(filters.query.trim(), 300);

  const needsOrigin = filters.sortBy === "distance";

  useEffect(() => {
    const ac = new AbortController();
    const p = new URLSearchParams({ limit: String(view === "map" ? 500 : PAGE), offset: String(offset) });
    if (query) p.set("q", query);
    if (filters.zone !== "All") p.set("zone", filters.zone);
    if (filters.budget !== "All") p.set("budget", filters.budget);
    if (needsOrigin && position) {
      p.set("sort", "distance");
      p.set("lat", String(position.lat));
      p.set("lng", String(position.lng));
    } else p.set("sort", needsOrigin ? "trending" : SORT[filters.sortBy]);
    if (position && !needsOrigin) {
      p.set("lat", String(position.lat));
      p.set("lng", String(position.lng));
      p.set("radius", "50000");
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    api<{ data: PandalDTO[]; total: number }>(`/api/pandals?${p}`, { signal: ac.signal })
      .then((r) => {
        setItems((prev) => (offset === 0 ? r.data : [...prev, ...r.data]));
        setTotal(r.total);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(true);
          setLoading(false);
        }
      });
    return () => ac.abort();
  }, [query, filters.zone, filters.budget, filters.sortBy, needsOrigin, position, offset, view]);

  const change = (f: typeof filters) => {
    setOffset(0);
    setFilters(f);
    if (f.sortBy === "distance" && !position && status !== "denied") setAskLocation(true);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">
          <span className="text-sindoor">Ei Pujo,</span> Ekhane Dekha
        </h1>
        <p className="text-smoke text-sm">
          Discover Kolkata&apos;s Durga Pujo pandals and food around them, get directions, and build your own pandal-hopping route.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/map" className={btnPrimary}>Open the map</Link>
          <Link href="/pandals/new" className={btnGhost}>+ Add a Pandal</Link>
          <Link href="/food/new" className={btnGhost}>+ Recommend Food</Link>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FilterBar filters={filters} onChange={change} />
        <div className="flex items-center gap-2">
          {!position && status !== "loading" && (
            <button onClick={() => setAskLocation(true)} className={btnGhost}>📍 Use my location</button>
          )}
          <div className="flex rounded-lg border border-black/15 dark:border-white/20 overflow-hidden">
            {(["list", "map"] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setOffset(0); setView(v); }}
                aria-pressed={view === v}
                className={`px-3 min-h-11 text-sm capitalize ${view === v ? "bg-sindoor text-white" : "hover:bg-black/5 dark:hover:bg-white/10"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {status === "denied" && (
        <Notice tone="warn">
          We couldn&apos;t access your location. You can still browse and search — distances just aren&apos;t shown.
        </Notice>
      )}
      {error && <Notice tone="error">We couldn&apos;t load pandals right now. Please try again.</Notice>}

      <p className="text-sm text-smoke" aria-live="polite">{loading && offset === 0 ? "Loading…" : `${total} pandals found`}</p>

      {view === "map" ? (
        <div className="h-[60dvh] overflow-hidden rounded-xl">
          <MapCanvas pandals={items} user={position} fit={items.map((p) => ({ lat: p.latitude, lng: p.longitude }))} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((p) => (
              <PandalCard key={p.id} pandal={p} distanceM={p.distanceMeters} />
            ))}
            {loading && offset === 0 && [0, 1, 2].map((i) => <CardSkeleton key={i} />)}
            {!loading && items.length === 0 && (
              <p className="col-span-full text-sm text-smoke py-10 text-center">We couldn&apos;t find anything matching that search.</p>
            )}
          </div>
          {items.length < total && (
            <button className={`${btnGhost} self-center`} disabled={loading} onClick={() => setOffset(items.length)}>
              {loading ? "Loading…" : `Load more (${total - items.length} left)`}
            </button>
          )}
        </>
      )}

      <section className="flex flex-col gap-2 pt-4 border-t border-black/10 dark:border-white/10">
        <h2 className="font-semibold">
          More pandals from the 2026 directory{" "}
          <span className="text-xs font-normal text-smoke">({unverifiedPandals.length}, pending committee/map verification)</span>
        </h2>
        <p className="text-xs text-smoke">
          Named in this year&apos;s directory, but zone, theme and history couldn&apos;t be confirmed yet — shown by name only until verified.
        </p>
        <div className="flex flex-wrap gap-2">
          {unverifiedPandals.map((p) => (
            <a key={p.id} href={p.googleMapsUrl} target="_blank" rel="noreferrer" className="text-xs px-3 py-2 rounded-full border border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10">
              {p.name}
            </a>
          ))}
        </div>
      </section>

      {askLocation && (
        <LocationPermissionDialog
          onAllow={() => {
            setAskLocation(false);
            request();
          }}
          onCancel={() => setAskLocation(false)}
        />
      )}
    </div>
  );
}
