"use client";

import Link from "next/link";
import { Pandal } from "@/types";
import { useHoppingList } from "@/context/HoppingListContext";
import { formatDistance } from "@/lib/geo";

export default function PandalCard({
  pandal,
  distanceM,
}: {
  pandal: Pandal;
  distanceM?: number;
}) {
  const { isInList, togglePandal } = useHoppingList();
  const inList = isInList(pandal.id);

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow bg-white/60 dark:bg-white/5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/pandal/${pandal.id}`} className="font-semibold hover:text-sindoor">
            {pandal.name}
          </Link>
          <div className="text-xs text-smoke">{pandal.nameBn}</div>
        </div>
        <span className="text-[10px] uppercase tracking-wide rounded-full bg-marigold/20 text-marigold px-2 py-1 whitespace-nowrap">
          {pandal.zone}
        </span>
      </div>

      <p className="text-sm text-smoke line-clamp-2">{pandal.theme}</p>

      <div className="flex flex-wrap items-center gap-2 text-xs text-smoke">
        <span>{pandal.budgetRange}</span>
        <span>·</span>
        <span>Crowd {pandal.crowdRating}/5</span>
        {distanceM !== undefined && (
          <>
            <span>·</span>
            <span>{formatDistance(distanceM)} away</span>
          </>
        )}
      </div>

      <div className="mt-1 flex items-center gap-2">
        <Link
          href={`/pandal/${pandal.id}`}
          className="text-sm px-3 py-1.5 rounded-full border border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10"
        >
          Details
        </Link>
        <button
          onClick={() => togglePandal(pandal.id)}
          className={`text-sm px-3 py-1.5 rounded-full transition-colors ${
            inList
              ? "bg-sindoor text-white"
              : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
          }`}
        >
          {inList ? "Added ✓" : "+ Add to list"}
        </button>
      </div>
    </div>
  );
}
