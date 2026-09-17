"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { pandals } from "@/data/pandals";
import { useHoppingList } from "@/context/HoppingListContext";
import SortablePandalItem from "@/components/SortablePandalItem";
import { useGeolocation, KOLKATA_FALLBACK } from "@/hooks/useGeolocation";
import {
  haversineDistance,
  optimizeRoute,
  totalRouteDistanceM,
  formatDistance,
  walkTimeMinutes,
  googleMapsRouteUrl,
} from "@/lib/geo";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-[380px] rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
  ),
});

export default function MyListPage() {
  const { pandalIds, removePandal, reorder, clear } = useHoppingList();
  const { position, status, request } = useGeolocation();
  const [optimized, setOptimized] = useState(false);

  const origin = position ?? KOLKATA_FALLBACK;

  const listPandals = useMemo(
    () => pandalIds.map((id) => pandals.find((p) => p.id === id)).filter((p): p is (typeof pandals)[number] => !!p),
    [pandalIds]
  );

  const orderedPandals = useMemo(() => {
    if (!optimized) return listPandals;
    return optimizeRoute(origin, listPandals);
  }, [optimized, listPandals, origin]);

  const totalDistanceM = useMemo(
    () => totalRouteDistanceM(origin, orderedPandals),
    [origin, orderedPandals]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedPandals.findIndex((p) => p.id === active.id);
    const newIndex = orderedPandals.findIndex((p) => p.id === over.id);
    const newOrder = arrayMove(orderedPandals, oldIndex, newIndex);
    setOptimized(false);
    reorder(newOrder.map((p) => p.id));
  }

  const legLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    let current = origin;
    for (const p of orderedPandals) {
      const d = haversineDistance(current, p);
      labels[p.id] = `${formatDistance(d)} · ${walkTimeMinutes(d)} min`;
      current = p;
    }
    return labels;
  }, [orderedPandals, origin]);

  if (listPandals.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center flex flex-col items-center gap-3">
        <h1 className="text-xl font-bold">Your pandal-hopping list is empty</h1>
        <p className="text-smoke text-sm">
          Browse pandals and tap &quot;+ Add to list&quot; to start planning your route.
        </p>
        <Link
          href="/"
          className="mt-2 px-4 py-2 rounded-full bg-sindoor text-white text-sm font-medium"
        >
          Discover pandals
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Pandal-Hopping List</h1>
          <p className="text-smoke text-sm">
            {orderedPandals.length} stops · ~{formatDistance(totalDistanceM)} total ·{" "}
            {walkTimeMinutes(totalDistanceM)} min walking
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status !== "granted" && (
            <button
              onClick={request}
              className="text-sm px-3 py-2 rounded-lg border border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10"
            >
              📍 Use my location
            </button>
          )}
          <button
            onClick={() => setOptimized(true)}
            className="text-sm px-3 py-2 rounded-lg bg-marigold text-white font-medium hover:opacity-90"
          >
            ⚡ Optimize route
          </button>
          <a
            href={googleMapsRouteUrl(orderedPandals, position ?? undefined)}
            target="_blank"
            rel="noreferrer"
            className="text-sm px-3 py-2 rounded-lg bg-sindoor text-white font-medium hover:opacity-90"
          >
            Export to Google Maps →
          </a>
          <button
            onClick={() => {
              clear();
              setOptimized(false);
            }}
            className="text-sm px-3 py-2 rounded-lg border border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Clear list
          </button>
        </div>
      </div>

      <MapView pandals={orderedPandals} userLocation={position} routeOrder={orderedPandals} height={380} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedPandals.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {orderedPandals.map((p, i) => (
              <SortablePandalItem
                key={p.id}
                pandal={p}
                index={i}
                legDistanceLabel={legLabels[p.id]}
                onRemove={(id) => {
                  removePandal(id);
                  setOptimized(false);
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <p className="text-xs text-smoke">
        Drag stops to reorder manually, or use &quot;Optimize route&quot; to auto-sequence by
        nearest-neighbor distance from your location. Distances are straight-line estimates;
        actual walking distance may vary.
      </p>
    </div>
  );
}
