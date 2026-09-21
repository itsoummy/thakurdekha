"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { FoodDTO, PandalDTO } from "@/server/repo";
import { api, errorMessage } from "@/lib/api";
import { track } from "@/lib/analytics";
import { haversineDistance } from "@/lib/geo";
import { pathLength } from "@/lib/optimize";
import { formatDuration, formatMeters, googleMapsDirectionsUrl, TRAVEL_MODES, type TravelMode } from "@/lib/spatial";
import { clientMapService } from "@/lib/map/client";
import { useHoppingList } from "@/context/HoppingListContext";
import { useAuth } from "@/context/AuthContext";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useConfig } from "@/hooks/useConfig";
import SortableStopItem, { type StopView } from "@/components/SortablePandalItem";
import LocationPermissionDialog from "@/components/LocationPermissionDialog";
import { btnGhost, btnPrimary, inputCls, Notice, Skeleton } from "@/components/ui";

const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-black/5 dark:bg-white/5" />,
});

interface Plan {
  id: string;
  name: string;
  travelMode: string | null;
  stops: { type: "PANDAL" | "FOOD"; id: string }[];
}

const SPEED: Record<TravelMode, number> = { WALKING: 1.25, DRIVING: 5.5, TRANSIT: 3.5 };
const MODE_LABEL: Record<TravelMode, string> = { WALKING: "Walking", DRIVING: "Driving", TRANSIT: "Transit" };
const typeOf = (id: string): "PANDAL" | "FOOD" => (id.startsWith("f") ? "FOOD" : "PANDAL");

export default function MyListPage() {
  const { pandalIds, removePandal, reorder, clear } = useHoppingList();
  const auth = useAuth();
  const loc = useUserLocation();
  const cfg = useConfig();

  const [stopsData, setStopsData] = useState<Map<string, StopView> | null>(null);
  const [mode, setMode] = useState<TravelMode>("WALKING");
  const [showPermission, setShowPermission] = useState(false);
  const [busy, setBusy] = useState<null | "optimize" | "route" | "save">(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [routeResult, setRouteResult] = useState<{
    legs: { toId: string; distanceMeters: number; durationSeconds: number; estimated: boolean }[];
    polyline: [number, number][];
  } | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planName, setPlanName] = useState("My Puja route");

  const origin = useMemo(
    () => (loc.latitude !== null && loc.longitude !== null ? { lat: loc.latitude, lng: loc.longitude } : null),
    [loc.latitude, loc.longitude]
  );

  const idKey = pandalIds.join(",");
  useEffect(() => {
    if (!pandalIds.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStopsData(new Map());
      return;
    }
    const ac = new AbortController();
    const pIds = pandalIds.filter((i) => typeOf(i) === "PANDAL");
    const fIds = pandalIds.filter((i) => typeOf(i) === "FOOD");
    Promise.all([
      pIds.length ? api<{ data: PandalDTO[] }>(`/api/pandals?ids=${pIds.join(",")}&limit=100`, { signal: ac.signal }) : { data: [] as PandalDTO[] },
      fIds.length ? api<{ data: FoodDTO[] }>(`/api/food?ids=${fIds.join(",")}&limit=100`, { signal: ac.signal }) : { data: [] as FoodDTO[] },
    ])
      .then(([p, f]) => {
        const m = new Map<string, StopView>();
        for (const x of p.data) m.set(x.id, { id: x.id, type: "PANDAL", name: x.name, sub: x.neighbourhood ?? x.zone, lat: x.latitude, lng: x.longitude });
        for (const x of f.data) m.set(x.id, { id: x.id, type: "FOOD", name: x.name, sub: x.category, lat: x.latitude, lng: x.longitude });
        setStopsData(m);
      })
      .catch((e) => e.name !== "AbortError" && setMessage({ tone: "error", text: "We couldn't load your stops. Please try again." }));
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  const loadPlans = useCallback(() => {
    if (!auth.user) return;
    api<{ data: Plan[] }>("/api/plans").then((r) => setPlans(r.data)).catch(() => {});
  }, [auth.user]);
  useEffect(() => {
     
    loadPlans();
  }, [loadPlans]);

  const stops = useMemo(() => pandalIds.map((id) => stopsData?.get(id)).filter((s): s is StopView => !!s), [pandalIds, stopsData]);

  const estimate = useMemo(() => {
    const d = pathLength(origin ?? undefined, stops);
    return { distance: Math.round(d), duration: Math.round(d / SPEED[mode]) };
  }, [stops, origin, mode]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = stops.findIndex((s) => s.id === e.active.id);
    const to = stops.findIndex((s) => s.id === e.over!.id);
    reorder(arrayMove(stops, from, to).map((s) => s.id));
    setRouteResult(null);
  }

  const legLabels = useMemo(() => {
    const out: Record<string, string> = {};
    if (routeResult) {
      for (const l of routeResult.legs) out[l.toId] = `${formatMeters(l.distanceMeters)} · ${formatDuration(l.durationSeconds)}`;
      return out;
    }
    let cur = origin;
    for (const s of stops) {
      if (cur) {
        const d = haversineDistance(cur, s);
        out[s.id] = `~${formatMeters(d)} · ~${formatDuration(d / SPEED[mode])}`;
      }
      cur = s;
    }
    return out;
  }, [stops, origin, mode, routeResult]);

  async function withOrigin(then: (o: { lat: number; lng: number } | null) => Promise<void>) {
    if (origin) return then(origin);
    if (loc.permission === "granted") {
      try {
        const c = await loc.getOnce();
        return then({ lat: c.lat, lng: c.lng });
      } catch {
        return then(null);
      }
    }
    return then(null);
  }

  async function optimize() {
    setBusy("optimize");
    setMessage(null);
    await withOrigin(async (o) => {
      try {
        const r = await api<{ data: { orderedStops: { id: string }[] } }>("/api/routes/optimize", {
          body: { origin: o ?? undefined, stops: stops.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng })), travelMode: mode },
        });
        reorder(r.data.orderedStops.map((s) => s.id));
        setRouteResult(null);
        track("route_optimized");
        setMessage({ tone: "info", text: "Route reordered to shorten the total distance. Drag stops to adjust." });
      } catch (e) {
        setMessage({ tone: "error", text: errorMessage(e) });
      }
    });
    setBusy(null);
  }

  async function calculate() {
    setBusy("route");
    setMessage(null);
    await withOrigin(async (o) => {
      const points = [...(o ? [{ id: "origin", lat: o.lat, lng: o.lng }] : []), ...stops];
      const legs: NonNullable<typeof routeResult>["legs"] = [];
      const line: [number, number][] = [];
      try {
        for (let i = 1; i < points.length; i++) {
          const r = await clientMapService.calculateRoute(points[i - 1], points[i], mode);
          legs.push({ toId: points[i].id, distanceMeters: r.distanceMeters, durationSeconds: r.durationSeconds, estimated: r.estimated });
          line.push(...r.polyline);
        }
        setRouteResult({ legs, polyline: line });
        track("route_created");
      } catch (e) {
        setRouteResult(null);
        setMessage({ tone: "error", text: errorMessage(e) });
      }
    });
    setBusy(null);
  }

  async function save() {
    setBusy("save");
    setMessage(null);
    try {
      await api("/api/plans", { body: { name: planName, travelMode: mode, stops: stops.map((s) => ({ type: s.type, id: s.id })) } });
      setMessage({ tone: "info", text: "Route saved to your account." });
      loadPlans();
    } catch (e) {
      setMessage({ tone: "error", text: errorMessage(e) });
    }
    setBusy(null);
  }

  const totals = routeResult
    ? { distance: routeResult.legs.reduce((a, l) => a + l.distanceMeters, 0), duration: routeResult.legs.reduce((a, l) => a + l.durationSeconds, 0), estimated: routeResult.legs.some((l) => l.estimated) }
    : { ...estimate, estimated: true };

  const exportUrl = stops.length
    ? googleMapsDirectionsUrl(stops[stops.length - 1], { origin: origin ?? undefined, mode, waypoints: stops.slice(0, -1) })
    : "https://www.google.com/maps";

  if (stopsData === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (stops.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center flex flex-col items-center gap-3">
        <h1 className="text-xl font-bold">Your Puja route is empty</h1>
        <p className="text-smoke text-sm">Add pandals and food stops from the map or discovery page.</p>
        <div className="flex gap-2">
          <Link href="/map" className={btnPrimary}>Explore the map</Link>
          <Link href="/" className={btnGhost}>Browse pandals</Link>
        </div>
        {auth.user && plans.length > 0 && <SavedPlans plans={plans} onLoad={(p) => reorder(p.stops.map((s) => s.id))} onDelete={async (id) => { await api(`/api/plans/${id}`, { method: "DELETE" }); loadPlans(); }} />}
      </div>
    );
  }

  const transitOk = cfg?.routing?.transit ?? false;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">My Puja Route</h1>
        <p className="text-smoke text-sm" data-testid="route-summary">
          {stops.length} stop{stops.length === 1 ? "" : "s"} · {totals.estimated ? "~" : ""}{formatMeters(totals.distance)} · {totals.estimated ? "~" : ""}{formatDuration(totals.duration)} {MODE_LABEL[mode].toLowerCase()}
          {totals.estimated && <span className="text-xs"> (straight-line estimate{routeResult ? "" : " — press Calculate route for road distances"})</span>}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div role="radiogroup" aria-label="Travel mode" className="flex gap-1">
          {TRAVEL_MODES.filter((m) => m !== "TRANSIT" || transitOk).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => { setMode(m); setRouteResult(null); }} className={`min-h-10 px-3 rounded-full text-sm ${mode === m ? "bg-sindoor text-white" : "border border-black/15 dark:border-white/20"}`}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        {!origin && loc.permission !== "denied" && (
          <button className={btnGhost} onClick={() => setShowPermission(true)}>📍 Start from my location</button>
        )}
        <button className={btnPrimary} onClick={() => void optimize()} disabled={busy !== null || stops.length < 2}>
          {busy === "optimize" ? "Optimizing…" : "⚡ Optimize Route"}
        </button>
        <button className={btnGhost} onClick={() => void calculate()} disabled={busy !== null || stops.length + (origin ? 1 : 0) < 2}>
          {busy === "route" ? "Calculating…" : "Calculate route"}
        </button>
        <a className={btnGhost} href={exportUrl} target="_blank" rel="noreferrer" onClick={() => track("external_navigation_clicked")}>
          Open in Google Maps ↗
        </a>
        <button className={btnGhost} onClick={() => { clear(); setRouteResult(null); }}>Clear</button>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {loc.error === "denied" && <Notice tone="warn">Location is off, so the route starts at your first stop. You can still reorder and export it.</Notice>}

      <div className="h-80 overflow-hidden rounded-xl">
        <MapCanvas
          pandals={stops.filter((s) => s.type === "PANDAL").map((s) => ({ id: s.id, name: s.name, latitude: s.lat, longitude: s.lng }) as PandalDTO)}
          food={stops.filter((s) => s.type === "FOOD").map((s) => ({ id: s.id, name: s.name, latitude: s.lat, longitude: s.lng }) as FoodDTO)}
          user={origin}
          route={routeResult?.polyline ?? [...(origin ? [[origin.lat, origin.lng] as [number, number]] : []), ...stops.map((s) => [s.lat, s.lng] as [number, number])]}
          fit={[...stops, ...(origin ? [origin] : [])]}
        />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-2">
            {stops.map((s, i) => (
              <SortableStopItem key={s.id} stop={s} index={i} legLabel={legLabels[s.id]} onRemove={(id) => { removePandal(id); setRouteResult(null); }} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <div className="flex gap-2 flex-wrap">
        <Link className={btnGhost} href="/map">+ Add a pandal or food stop</Link>
      </div>

      <section className="flex flex-col gap-2 rounded-xl border border-black/10 dark:border-white/10 p-3">
        <h2 className="font-semibold text-sm">Save this route</h2>
        {auth.user ? (
          <div className="flex gap-2 flex-wrap">
            <input className={`${inputCls} !w-64`} aria-label="Route name" value={planName} onChange={(e) => setPlanName(e.target.value)} maxLength={80} />
            <button className={btnPrimary} onClick={() => void save()} disabled={busy !== null || !planName.trim()}>{busy === "save" ? "Saving…" : "Save route"}</button>
          </div>
        ) : (
          <p className="text-sm text-smoke"><Link className="underline" href="/login?next=/my-list">Sign in</Link> to save routes to your account. Until then your list is kept on this device.</p>
        )}
        {auth.user && plans.length > 0 && <SavedPlans plans={plans} onLoad={(p) => { reorder(p.stops.map((s) => s.id)); if (p.travelMode) setMode(p.travelMode as TravelMode); setRouteResult(null); }} onDelete={async (id) => { await api(`/api/plans/${id}`, { method: "DELETE" }); loadPlans(); }} />}
      </section>

      {showPermission && (
        <LocationPermissionDialog
          onAllow={async () => { setShowPermission(false); try { await loc.getOnce(); } catch {} }}
          onCancel={() => setShowPermission(false)}
        />
      )}
    </div>
  );
}

function SavedPlans({ plans, onLoad, onDelete }: { plans: Plan[]; onLoad: (p: Plan) => void; onDelete: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <h3 className="text-xs uppercase text-smoke">Saved routes</h3>
      {plans.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2">
          <span>{p.name} <span className="text-xs text-smoke">({p.stops.length} stops)</span></span>
          <span className="flex gap-2">
            <button className="underline" onClick={() => onLoad(p)}>Load</button>
            <button className="underline text-smoke" onClick={() => onDelete(p.id)}>Delete</button>
          </span>
        </div>
      ))}
    </div>
  );
}
