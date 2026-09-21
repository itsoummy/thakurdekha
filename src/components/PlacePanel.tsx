"use client";

import Link from "next/link";
import type { FoodDTO, PandalDTO } from "@/server/repo";
import { useHoppingList } from "@/context/HoppingListContext";
import { useAuth } from "@/context/AuthContext";
import { formatMeters } from "@/lib/spatial";
import { haversineDistance } from "@/lib/geo";
import { track } from "@/lib/analytics";
import { btnGhost, btnPrimary, PlaceImage, Rating, TrustBadge } from "./ui";

export type PlaceItem = { type: "PANDAL"; data: PandalDTO } | { type: "FOOD"; data: FoodDTO };

export default function PlacePanel({
  item,
  user,
  onDirections,
  onClose,
  directionsBusy,
}: {
  item: PlaceItem;
  user?: { lat: number; lng: number } | null;
  onDirections: (item: PlaceItem) => void;
  onClose?: () => void;
  directionsBusy?: boolean;
}) {
  const { isInList, togglePandal } = useHoppingList();
  const auth = useAuth();
  const d = item.data;
  const inList = isInList(d.id);
  const distance =
    d.distanceMeters ?? (user ? Math.round(haversineDistance(user, { lat: d.latitude, lng: d.longitude })) : undefined);
  const isPandal = item.type === "PANDAL";
  const p = isPandal ? (d as PandalDTO) : null;
  const f = !isPandal ? (d as FoodDTO) : null;
  const detailHref = isPandal ? `/pandal/${d.id}` : `/food/${d.id}`;

  return (
    <article className="flex flex-col gap-3" aria-label={d.name}>
      <div className="flex gap-3">
        <PlaceImage images={d.images} alt={d.name} className="h-24 w-24 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-semibold leading-tight">{d.name}</h2>
            {onClose && (
              <button aria-label="Close details" onClick={onClose} className="min-h-9 min-w-9 rounded-full text-smoke hover:bg-black/5 dark:hover:bg-white/10">
                ✕
              </button>
            )}
          </div>
          <p className="text-xs text-smoke truncate">
            {isPandal ? (p!.neighbourhood ?? p!.zone ?? p!.address) : (f!.category ?? f!.address)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Rating rating={d.rating} count={d.reviewCount} />
            {distance !== undefined && <span className="text-xs text-smoke">{formatMeters(distance)} away</span>}
          </div>
          <div className="mt-1">
            <TrustBadge trust={d.trust} />
          </div>
        </div>
      </div>

      {isPandal ? (
        <p className="text-sm">
          {p!.currentTheme ? (<><span className="text-smoke">Theme: </span>{p!.currentTheme}</>) : p!.category ? (<><span className="text-smoke">Known for: </span>{p!.category}</>) : (<><span className="text-smoke">Theme: </span>Not announced yet</>)}
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-smoke">Recommended dish</dt>
          <dd>{f!.recommendedDish ?? "—"}</dd>
          <dt className="text-smoke">Price range</dt>
          <dd>{f!.priceRange ?? "—"}</dd>
        </dl>
      )}

      <div className="flex flex-wrap gap-2">
        <button className={btnPrimary} onClick={() => onDirections(item)} disabled={directionsBusy}>
          {directionsBusy ? "Finding route…" : "Get Directions"}
        </button>
        <button
          className={inList ? `${btnPrimary} !bg-emerald-600` : btnGhost}
          aria-pressed={inList}
          onClick={() => {
            togglePandal(d.id);
            if (!inList) track("pandal_added_to_plan", { type: item.type, id: d.id });
          }}
        >
          {inList ? "In Puja List ✓" : "Add to Puja List"}
        </button>
        <Link className={btnGhost} href={detailHref}>
          {isPandal ? "View Details" : "View Place"}
        </Link>
        {isPandal &&
          (auth.user ? (
            <button className={btnGhost} aria-pressed={auth.saved.has(d.id)} onClick={() => void auth.toggleSaved(d.id)}>
              {auth.saved.has(d.id) ? "Saved ✓" : "Save"}
            </button>
          ) : (
            <Link className={btnGhost} href="/login">
              Sign in to save
            </Link>
          ))}
      </div>
    </article>
  );
}
