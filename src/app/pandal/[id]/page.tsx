"use client";

import { use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { pandals } from "@/data/pandals";
import { useHoppingList } from "@/context/HoppingListContext";
import { nearestMetroStations, nearbyFoodSpots, formatDistance } from "@/lib/geo";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
  ),
});

export default function PandalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pandal = pandals.find((p) => p.id === id);
  const { isInList, togglePandal } = useHoppingList();

  if (!pandal) notFound();

  const metros = nearestMetroStations(pandal, 3);
  const food = nearbyFoodSpots(pandal, 4);
  const inList = isInList(pandal.id);

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${pandal.lat},${pandal.lng}&travelmode=walking`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-6">
      <Link href="/" className="text-sm text-smoke hover:text-sindoor w-fit">
        ← Back to discovery
      </Link>

      <section className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{pandal.name}</h1>
            <p className="text-smoke">{pandal.nameBn}</p>
          </div>
          <span className="text-xs uppercase tracking-wide rounded-full bg-marigold/20 text-marigold px-3 py-1.5 whitespace-nowrap">
            {pandal.zone} Kolkata
          </span>
        </div>
        <p className="text-sm">{pandal.description}</p>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Stat label="Established" value={String(pandal.establishedYear)} />
        <Stat label="Budget" value={pandal.budgetRange} />
        <Stat label="Crowd rating" value={`${pandal.crowdRating}/5`} />
        <Stat label="Hours" value={`${pandal.openingTime}–${pandal.closingTime}`} />
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => togglePandal(pandal.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            inList ? "bg-sindoor text-white" : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
          }`}
        >
          {inList ? "Added to My List ✓" : "+ Add to My Pandal-Hopping List"}
        </button>
        <a
          href={navUrl}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded-full text-sm font-medium border border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10"
        >
          Navigate here →
        </a>
      </section>

      <section>
        <MapView pandals={[pandal]} height={320} />
        <p className="text-xs text-smoke mt-1">{pandal.address}</p>
      </section>

      <section className="grid sm:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold mb-2">Nearest Metro Stations</h2>
          <ul className="flex flex-col gap-2">
            {metros.map(({ station, distanceM, walkMin }) => (
              <li key={station.id} className="flex items-center justify-between text-sm border border-black/10 dark:border-white/10 rounded-lg px-3 py-2">
                <span>
                  <span className="font-medium">{station.name}</span>{" "}
                  <span className="text-xs text-smoke">({station.line} Line)</span>
                </span>
                <span className="text-xs text-smoke whitespace-nowrap">
                  {formatDistance(distanceM)} · {walkMin} min walk
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Food Nearby</h2>
          <ul className="flex flex-col gap-2">
            {food.map(({ spot, distanceM }) => (
              <li key={spot.id} className="flex items-center justify-between text-sm border border-black/10 dark:border-white/10 rounded-lg px-3 py-2">
                <span>
                  <span className="font-medium">{spot.name}</span>
                  {spot.pujoSpecial && <span className="ml-1 text-[10px] text-marigold">★ pujo special</span>}
                  <div className="text-xs text-smoke">{spot.cuisineTags.join(", ")} · {spot.priceRange}</div>
                </span>
                <span className="text-xs text-smoke whitespace-nowrap">{formatDistance(distanceM)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2">
      <div className="text-[10px] uppercase text-smoke">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
