"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { pandals } from "@/data/pandals";
import PandalCard from "@/components/PandalCard";
import FilterBar, { defaultFilters } from "@/components/FilterBar";
import { useGeolocation, KOLKATA_FALLBACK } from "@/hooks/useGeolocation";
import { haversineDistance } from "@/lib/geo";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
  ),
});

export default function Home() {
  const [view, setView] = useState<"list" | "map">("list");
  const [filters, setFilters] = useState(defaultFilters());
  const { position, status, request } = useGeolocation();

  const originForSort = position ?? KOLKATA_FALLBACK;

  const filtered = useMemo(() => {
    let list = pandals.filter((p) => {
      const q = filters.query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.theme.toLowerCase().includes(q) ||
        p.nameBn.includes(q);
      const matchesZone = filters.zone === "All" || p.zone === filters.zone;
      const matchesBudget = filters.budget === "All" || p.budgetRange === filters.budget;
      return matchesQuery && matchesZone && matchesBudget;
    });

    if (filters.sortBy === "trending") {
      list = [...list].sort((a, b) => b.trendingScore - a.trendingScore);
    } else if (filters.sortBy === "crowd") {
      list = [...list].sort((a, b) => a.crowdRating - b.crowdRating);
    } else {
      list = [...list].sort(
        (a, b) =>
          haversineDistance(originForSort, a) - haversineDistance(originForSort, b)
      );
    }
    return list;
  }, [filters, originForSort]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col gap-5">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">
          <span className="text-sindoor">Ei Pujo,</span> Ekhane Dekha
        </h1>
        <p className="text-smoke text-sm">
          Discover Kolkata&apos;s famous Durga Pujo pandals, nearby metro &amp; food,
          and build your own pandal-hopping route.
        </p>
      </section>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FilterBar filters={filters} onChange={setFilters} />
        <div className="flex items-center gap-2">
          {status !== "granted" && (
            <button
              onClick={request}
              className="text-sm px-3 py-2 rounded-lg border border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10 whitespace-nowrap"
            >
              📍 Use my location
            </button>
          )}
          <div className="flex rounded-lg border border-black/15 dark:border-white/20 overflow-hidden">
            <button
              onClick={() => setView("list")}
              className={`px-3 py-2 text-sm ${view === "list" ? "bg-sindoor text-white" : "hover:bg-black/5 dark:hover:bg-white/10"}`}
            >
              List
            </button>
            <button
              onClick={() => setView("map")}
              className={`px-3 py-2 text-sm ${view === "map" ? "bg-sindoor text-white" : "hover:bg-black/5 dark:hover:bg-white/10"}`}
            >
              Map
            </button>
          </div>
        </div>
      </div>

      {status === "denied" && (
        <p className="text-xs text-smoke">
          Location access denied — showing distances from central Kolkata (Esplanade) instead.
        </p>
      )}

      <p className="text-sm text-smoke">{filtered.length} pandals found</p>

      {view === "map" ? (
        <MapView pandals={filtered} userLocation={position} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <PandalCard
              key={p.id}
              pandal={p}
              distanceM={haversineDistance(originForSort, p)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-sm text-smoke py-10 text-center">
              No pandals match your filters. Try widening your search.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
