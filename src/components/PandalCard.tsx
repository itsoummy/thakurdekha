"use client";

import Link from "next/link";
import type { PandalDTO } from "@/server/repo";
import { useHoppingList } from "@/context/HoppingListContext";
import { formatDistance } from "@/lib/geo";
import { track } from "@/lib/analytics";
import { PlaceImage, Rating, TrustBadge } from "./ui";

export default function PandalCard({ pandal, distanceM }: { pandal: PandalDTO; distanceM?: number }) {
  const { isInList, togglePandal } = useHoppingList();
  const inList = isInList(pandal.id);
  const blurb = pandal.currentTheme ? `2026 theme: ${pandal.currentTheme}` : (pandal.category ?? "2026 theme not announced yet");

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col hover:shadow-md transition-shadow bg-white/60 dark:bg-white/5">
      <PlaceImage images={pandal.images} alt={pandal.name} className="h-28 w-full" />
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/pandal/${pandal.id}`} className="font-semibold hover:text-sindoor">
              {pandal.name}
            </Link>
            {pandal.nameBn && <div className="text-xs text-smoke">{pandal.nameBn}</div>}
          </div>
          {pandal.zone && (
            <span className="text-[10px] uppercase tracking-wide rounded-full bg-marigold/20 text-marigold px-2 py-1 whitespace-nowrap">
              {pandal.zone}
            </span>
          )}
        </div>

        <p className="text-sm text-smoke line-clamp-2">{blurb}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-smoke">
          <Rating rating={pandal.rating} count={pandal.reviewCount} />
          {pandal.budgetRange && <span>· {pandal.budgetRange}</span>}
          {pandal.crowdRating && <span>· Crowd ~{pandal.crowdRating}/5</span>}
          {distanceM !== undefined && <span>· {formatDistance(distanceM)} away</span>}
        </div>
        <TrustBadge trust={pandal.trust} />

        <div className="mt-auto pt-1 flex items-center gap-2">
          <Link
            href={`/pandal/${pandal.id}`}
            className="text-sm px-3 min-h-10 inline-flex items-center rounded-full border border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Details
          </Link>
          <button
            onClick={() => {
              togglePandal(pandal.id);
              if (!inList) track("pandal_added_to_plan", { type: "PANDAL", id: pandal.id });
            }}
            aria-pressed={inList}
            className={`text-sm px-3 min-h-10 rounded-full transition-colors ${
              inList ? "bg-sindoor text-white" : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
            }`}
          >
            {inList ? "Added ✓" : "+ Add to Puja List"}
          </button>
        </div>
      </div>
    </div>
  );
}
