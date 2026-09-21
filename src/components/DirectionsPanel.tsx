"use client";

import type { Route } from "@/lib/map/types";
import { formatDuration, formatMeters, googleMapsDirectionsUrl, TRAVEL_MODES } from "@/lib/spatial";
import type { TravelMode } from "@/lib/spatial";
import { track } from "@/lib/analytics";
import { btnGhost, btnPrimary, Notice, Skeleton } from "./ui";

const MODE_LABEL: Record<TravelMode, string> = { WALKING: "Walking", DRIVING: "Driving", TRANSIT: "Transit" };

export default function DirectionsPanel({
  destinationName,
  destination,
  origin,
  originLabel = "Your location",
  route,
  mode,
  onMode,
  loading,
  error,
  transitAvailable,
  onClose,
}: {
  destinationName: string;
  destination: { lat: number; lng: number };
  origin: { lat: number; lng: number };
  originLabel?: string;
  route: Route | null;
  mode: TravelMode;
  onMode: (m: TravelMode) => void;
  loading: boolean;
  error: string | null;
  transitAvailable: boolean;
  onClose: () => void;
}) {
  const modes = TRAVEL_MODES.filter((m) => m !== "TRANSIT" || transitAvailable);
  const url = googleMapsDirectionsUrl(destination, { origin, mode });

  return (
    <section className="flex flex-col gap-3" aria-label="Directions">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Directions</h2>
        <button aria-label="Close directions" onClick={onClose} className="min-h-9 min-w-9 rounded-full text-smoke hover:bg-black/5 dark:hover:bg-white/10">
          ✕
        </button>
      </div>

      <div role="radiogroup" aria-label="Travel mode" className="flex gap-1">
        {modes.map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => onMode(m)}
            className={`min-h-10 px-3 rounded-full text-sm ${mode === m ? "bg-sindoor text-white" : "border border-black/15 dark:border-white/20"}`}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      {loading && (
        <div data-testid="route-skeleton" className="flex flex-col gap-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      {route && !loading && (
        <div className="text-sm flex flex-col gap-1" data-testid="route-summary">
          <div className="font-medium">{originLabel}</div>
          <div className="pl-2 border-l-2 border-sindoor ml-1 py-2 text-smoke">
            <div>{formatMeters(route.distanceMeters)}</div>
            <div>{formatDuration(route.durationSeconds)}</div>
          </div>
          <div className="font-medium">{destinationName}</div>
          {route.estimated && (
            <Notice tone="warn">
              Estimated from a straight line — real roads and paths will differ. Open Google Maps for exact directions.
            </Notice>
          )}
        </div>
      )}

      <a
        className={route ? btnPrimary : btnGhost}
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={() => track("external_navigation_clicked")}
      >
        Open in Google Maps ↗
      </a>
    </section>
  );
}
