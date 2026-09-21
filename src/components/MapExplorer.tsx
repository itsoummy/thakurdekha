"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { FoodDTO, PandalDTO } from "@/server/repo";
import { api, ApiClientError } from "@/lib/api";
import { track } from "@/lib/analytics";
import { clientMapService } from "@/lib/map/client";
import type { Route } from "@/lib/map/types";
import { haversineDistance } from "@/lib/geo";
import { formatMeters, isValidCoordinate } from "@/lib/spatial";
import type { TravelMode } from "@/lib/spatial";
import { useAuth } from "@/context/AuthContext";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useConfig } from "@/hooks/useConfig";
import MapFilters, { type MapFilter } from "./MapFilters";
import PlacePanel, { type PlaceItem } from "./PlacePanel";
import DirectionsPanel from "./DirectionsPanel";
import LocationPermissionDialog, { locationErrorText } from "./LocationPermissionDialog";
import { BottomSheet, btnGhost, btnPrimary, CardSkeleton, Notice, PlaceImage, Rating } from "./ui";
import type { Selection } from "./MapCanvas";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-black/5 dark:bg-white/5" />,
});

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export default function MapExplorer() {
  const params = useSearchParams();
  const auth = useAuth();
  const loc = useUserLocation();
  const cfg = useConfig();

  const [filter, setFilter] = useState<MapFilter>("all");
  const [radius, setRadius] = useState(2000);
  const [pandals, setPandals] = useState<PandalDTO[]>([]);
  const [food, setFood] = useState<FoodDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<PlaceItem | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  const [showPermission, setShowPermission] = useState(false);
  const [pending, setPending] = useState<PlaceItem | null>(null);
  const [locNotice, setLocNotice] = useState<string | null>(null);
  const [pickingOrigin, setPickingOrigin] = useState(false);
  const [manualOrigin, setManualOrigin] = useState<{ lat: number; lng: number } | null>(null);

  const [directionsFor, setDirectionsFor] = useState<PlaceItem | null>(null);
  const [mode, setMode] = useState<TravelMode>("WALKING");
  const [route, setRoute] = useState<Route | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [fit, setFit] = useState<{ lat: number; lng: number }[] | null>(null);

  const gps = useMemo(
    () => (loc.latitude !== null && loc.longitude !== null ? { lat: loc.latitude, lng: loc.longitude } : null),
    [loc.latitude, loc.longitude]
  );
  const origin = manualOrigin ?? gps;
  const originKey = origin ? `${round3(origin.lat)},${round3(origin.lng)}` : "none";

  // ---- data ----
  useEffect(() => {
    const ac = new AbortController();
    const [olat, olng] = originKey === "none" ? [0, 0] : originKey.split(",").map(Number);
    const near = filter === "nearby" && originKey !== "none";
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        let p: PandalDTO[] = [];
        let f: FoodDTO[] = [];
        const get = <T,>(url: string) => api<{ data: T[] }>(url, { signal: ac.signal }).then((r) => r.data);
        if (filter === "saved") {
          p = auth.user ? await get<PandalDTO>("/api/users/me/saved-pandals") : [];
        } else if (near) {
          const q = `lat=${olat}&lng=${olng}&radius=${radius}`;
          [p, f] = await Promise.all([get<PandalDTO>(`/api/pandals/nearby?${q}`), get<FoodDTO>(`/api/food/nearby?${q}`)]);
        } else if (filter === "popular") {
          [p, f] = await Promise.all([get<PandalDTO>("/api/pandals?sort=popular&limit=40"), get<FoodDTO>("/api/food?sort=popular&limit=40")]);
        } else {
          [p, f] = await Promise.all([get<PandalDTO>("/api/pandals?limit=500"), get<FoodDTO>("/api/food?limit=500")]);
        }
        if (filter === "pandals") f = [];
        if (filter === "food") p = [];
        if (!ac.signal.aborted) {
          setPandals(p);
          setFood(f);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setLoadError("We couldn't load the map data. Please try again.");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [filter, radius, originKey, auth.user]);

  // ---- deep link: /map?select=PANDAL:id ----
  const deepLinked = useRef(false);
  useEffect(() => {
    const sel = params.get("select");
    if (!sel || deepLinked.current) return;
    deepLinked.current = true;
    const [type, id] = sel.split(":");
    if (!id || (type !== "PANDAL" && type !== "FOOD")) return;
    api<{ data: PandalDTO & FoodDTO }>(`/api/${type === "PANDAL" ? "pandals" : "food"}/${encodeURIComponent(id)}`)
      .then((r) => {
        setSelected({ type, data: r.data } as PlaceItem);
        setFocus({ lat: r.data.latitude, lng: r.data.longitude });
      })
      .catch(() => {});
  }, [params]);

  // ---- location lifecycle: only watch while a location feature is in use ----
  const needsLive = (filter === "nearby" || !!route) && loc.permission === "granted";
  const { start, stop, getOnce } = loc;
  useEffect(() => {
    if (needsLive) start();
    else stop();
  }, [needsLive, start, stop]);

  const autoLocated = useRef(false);
  useEffect(() => {
    if (loc.permission === "granted" && !autoLocated.current && !gps) {
      autoLocated.current = true;
      getOnce()
        .then((c) => {
          setFilter("nearby");
          setFocus({ lat: c.lat, lng: c.lng, zoom: 15 });
        })
        .catch(() => {});
    }
  }, [loc.permission, gps, getOnce]);

  const locate = useCallback(async () => {
    setLocNotice(null);
    try {
      const c = await getOnce();
      setManualOrigin(null);
      setFocus({ lat: c.lat, lng: c.lng, zoom: 15 });
      return c;
    } catch (e) {
      setLocNotice(locationErrorText((e as Error).message as "denied" | "unavailable" | "timeout"));
      return null;
    }
  }, [getOnce]);

  const requestLocation = useCallback(
    async (then?: (c: { lat: number; lng: number }) => void) => {
      if (loc.permission === "granted") {
        const c = await locate();
        if (c) then?.(c);
      } else {
        setShowPermission(true);
      }
    },
    [loc.permission, locate]
  );

  // ---- directions ----
  const runRoute = useCallback(
    async (item: PlaceItem, from: { lat: number; lng: number }, m: TravelMode) => {
      const dest = { lat: item.data.latitude, lng: item.data.longitude };
      if (!isValidCoordinate(dest.lat, dest.lng) || !isValidCoordinate(from.lat, from.lng)) {
        setRouteError("This location doesn't have valid coordinates, so we can't route to it.");
        return;
      }
      setRouteLoading(true);
      setRouteError(null);
      try {
        const r = await clientMapService.calculateRoute(from, dest, m);
        setRoute(r);
        setFit([from, dest, ...r.polyline.map(([lat, lng]) => ({ lat, lng }))]);
        track("route_created");
      } catch (e) {
        setRoute(null);
        setRouteError(
          e instanceof ApiClientError && (e.code === "MODE_UNAVAILABLE" || e.code === "NO_ROUTE")
            ? e.message
            : "We couldn't find a route for this destination right now."
        );
      } finally {
        setRouteLoading(false);
      }
    },
    []
  );

  const getDirections = useCallback(
    async (item: PlaceItem) => {
      track("directions_clicked", { type: item.type, id: item.data.id });
      setDirectionsFor(item);
      setRoute(null);
      setRouteError(null);
      const from = manualOrigin ?? gps;
      if (from) return runRoute(item, from, mode);
      if (loc.permission === "denied" || loc.permission === "unavailable") {
        setRouteError(locationErrorText(loc.permission === "denied" ? "denied" : "unavailable"));
        return;
      }
      if (loc.permission !== "granted") {
        setPending(item);
        setShowPermission(true);
        return;
      }
      setRouteLoading(true);
      const c = await locate();
      setRouteLoading(false);
      if (c) await runRoute(item, c, mode);
      else setRouteError(locationErrorText("unavailable"));
    },
    [manualOrigin, gps, mode, loc.permission, locate, runRoute]
  );

  const onAllow = useCallback(async () => {
    setShowPermission(false);
    const c = await locate();
    if (!c) {
      if (pending) setRouteError(locationErrorText("denied"));
      return;
    }
    if (pending) {
      const item = pending;
      setPending(null);
      await runRoute(item, c, mode);
    } else {
      setFilter("nearby");
    }
  }, [locate, pending, runRoute, mode]);

  const changeMode = (m: TravelMode) => {
    setMode(m);
    const from = manualOrigin ?? gps;
    if (directionsFor && from) void runRoute(directionsFor, from, m);
  };

  const closeDirections = () => {
    setDirectionsFor(null);
    setRoute(null);
    setRouteError(null);
    setPickingOrigin(false);
  };

  const onSelect = useCallback(
    (s: Selection) => {
      const item =
        s.type === "PANDAL"
          ? pandals.find((p) => p.id === s.id) && ({ type: "PANDAL", data: pandals.find((p) => p.id === s.id)! } as PlaceItem)
          : food.find((f) => f.id === s.id) && ({ type: "FOOD", data: food.find((f) => f.id === s.id)! } as PlaceItem);
      if (!item) return;
      setSelected(item);
      if (directionsFor && directionsFor.data.id !== s.id) closeDirections();
      track(s.type === "PANDAL" ? "pandal_viewed" : "food_place_viewed", { type: s.type, id: s.id });
    },
    [pandals, food, directionsFor]
  );

  const selection: Selection | null = selected ? { type: selected.type, id: selected.data.id } : null;

  const visible = useMemo(() => {
    const items: PlaceItem[] = [
      ...pandals.map((data) => ({ type: "PANDAL" as const, data })),
      ...food.map((data) => ({ type: "FOOD" as const, data })),
    ];
    if (origin) {
      const d = (i: PlaceItem) => haversineDistance(origin, { lat: i.data.latitude, lng: i.data.longitude });
      items.sort((a, b) => d(a) - d(b));
    }
    return items;
  }, [pandals, food, origin]);

  const transitOk = cfg?.routing?.transit ?? false;

  const panel = (
    <div className="flex flex-col gap-4">
      {selected && (
        <PlacePanel
          item={selected}
          user={origin}
          onDirections={getDirections}
          directionsBusy={routeLoading}
          onClose={() => {
            setSelected(null);
            closeDirections();
          }}
        />
      )}
      {directionsFor && (
        <>
          {!origin && !routeLoading && (
            <div className="flex flex-col gap-2">
              {routeError && <Notice tone="error">{routeError}</Notice>}
              <button className={btnGhost} onClick={() => setPickingOrigin(true)}>
                {pickingOrigin ? "Tap the map to set your start…" : "Choose start point on map"}
              </button>
            </div>
          )}
          {origin && (
            <DirectionsPanel
              destinationName={directionsFor.data.name}
              destination={{ lat: directionsFor.data.latitude, lng: directionsFor.data.longitude }}
              origin={origin}
              originLabel={manualOrigin ? "Chosen start point" : "Your location"}
              route={route}
              mode={mode}
              onMode={changeMode}
              loading={routeLoading}
              error={routeError}
              transitAvailable={transitOk}
              onClose={closeDirections}
            />
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="relative flex h-[calc(100dvh-57px)] w-full">
      <aside className="hidden lg:flex w-96 shrink-0 flex-col gap-3 overflow-y-auto border-r border-black/10 dark:border-white/10 p-4" aria-label="Results">
        {selected || directionsFor ? (
          panel
        ) : (
          <>
            <h1 className="font-semibold">
              {visible.length} place{visible.length === 1 ? "" : "s"} {origin ? "nearest first" : ""}
            </h1>
            {loading && [0, 1, 2].map((i) => <CardSkeleton key={i} />)}
            {!loading && visible.length === 0 && <EmptyState filter={filter} hasOrigin={!!origin} signedIn={!!auth.user} />}
            {!loading &&
              visible.slice(0, 80).map((it) => (
                <button
                  key={`${it.type}:${it.data.id}`}
                  onClick={() => {
                    setSelected(it);
                    setFocus({ lat: it.data.latitude, lng: it.data.longitude });
                  }}
                  className="flex gap-3 rounded-xl border border-black/10 dark:border-white/10 p-2 text-left hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <PlaceImage images={it.data.images} alt={it.data.name} className="h-14 w-14 shrink-0 rounded-md" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-sm">
                      {it.type === "FOOD" ? "🍴 " : ""}
                      {it.data.name}
                    </span>
                    <span className="flex gap-2 items-center">
                      <Rating rating={it.data.rating} count={it.data.reviewCount} />
                      {origin && (
                        <span className="text-xs text-smoke">
                          {formatMeters(haversineDistance(origin, { lat: it.data.latitude, lng: it.data.longitude }))}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              ))}
          </>
        )}
      </aside>

      <div className="relative flex-1 min-w-0">
        <MapCanvas
          pandals={pandals}
          food={food}
          user={origin ? { ...origin, accuracy: manualOrigin ? null : loc.accuracy } : null}
          route={route?.polyline ?? null}
          selected={selection}
          onSelect={onSelect}
          onMapClick={pickingOrigin ? (c) => { setManualOrigin(c); setPickingOrigin(false); if (directionsFor) void runRoute(directionsFor, c, mode); } : undefined}
          radius={filter === "nearby" && origin ? { center: origin, meters: radius } : null}
          fit={fit}
          focus={focus}
        />

        <div className="absolute left-2 right-2 top-2 z-[1000] flex flex-col gap-2 items-start pointer-events-none [&>*]:pointer-events-auto">
          <MapFilters
            filter={filter}
            onFilter={(f) => {
              setFilter(f);
              if (f === "nearby" && !origin) void requestLocation();
            }}
            radius={radius}
            onRadius={setRadius}
          />
          {loading && <span className="rounded-full bg-background/95 px-3 py-1 text-xs shadow">Loading…</span>}
          {loadError && <Notice tone="error">{loadError}</Notice>}
          {locNotice && (
            <Notice tone="warn">
              {locNotice}{" "}
              <button className="underline" onClick={() => { setPickingOrigin(true); setLocNotice(null); }}>
                Choose on map
              </button>
            </Notice>
          )}
          {pickingOrigin && <Notice>Tap the map to set your starting point.</Notice>}
          {!origin && !locNotice && !showPermission && loc.permission !== "denied" && (
            <button className={`${btnPrimary} shadow-lg`} onClick={() => void requestLocation()}>
              📍 Find pandals near me
            </button>
          )}
        </div>

        <div className="absolute bottom-3 right-3 z-[1000] hidden lg:flex flex-col gap-1">
          <Link href="/pandals/new" className={`${btnGhost} bg-background shadow`}>+ Add a Pandal</Link>
          <Link href="/food/new" className={`${btnGhost} bg-background shadow`}>+ Recommend Food</Link>
        </div>

        <button
          aria-label="Center on my location"
          onClick={() => void requestLocation()}
          className="absolute right-3 bottom-24 lg:bottom-20 z-[1000] h-11 w-11 rounded-full bg-background shadow-lg border border-black/10 dark:border-white/15 flex items-center justify-center"
        >
          ◎
        </button>

        <div className="absolute left-3 bottom-3 z-[1000] hidden sm:flex gap-3 rounded-lg bg-background/90 px-2 py-1 text-xs shadow">
          <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-sindoor align-middle" /> Pandal</span>
          <span><span className="inline-block h-2.5 w-2.5 rotate-45 bg-marigold align-middle" /> Food</span>
        </div>
      </div>

      {(selected || directionsFor) && (
        <BottomSheet
          label={directionsFor ? "Directions" : "Place details"}
          onClose={() => {
            setSelected(null);
            closeDirections();
          }}
        >
          {panel}
        </BottomSheet>
      )}

      {showPermission && (
        <LocationPermissionDialog
          onAllow={() => void onAllow()}
          onCancel={() => {
            setShowPermission(false);
            setPending(null);
            if (directionsFor) setRouteError(locationErrorText("denied"));
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ filter, hasOrigin, signedIn }: { filter: MapFilter; hasOrigin: boolean; signedIn: boolean }) {
  if (filter === "saved" && !signedIn)
    return (
      <Notice>
        <Link className="underline" href="/login">Sign in</Link> to see the pandals you&apos;ve saved.
      </Notice>
    );
  if (filter === "saved") return <Notice>You haven&apos;t saved any pandals yet.</Notice>;
  if (filter === "nearby" && !hasOrigin) return <Notice>Allow location access, or choose a point on the map, to see what&apos;s nearby.</Notice>;
  if (filter === "food") return <Notice>No food recommendations found nearby yet.</Notice>;
  return <Notice>We couldn&apos;t find anything matching that.</Notice>;
}

