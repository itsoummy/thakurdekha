"use client";

import { useEffect, useRef } from "react";
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import type { FoodDTO, PandalDTO } from "@/server/repo";
import type { Coordinates } from "@/lib/map/types";

export interface Selection {
  type: "PANDAL" | "FOOD";
  id: string;
}

const size = (sel: boolean) => (sel ? 28 : 18);

const pandalIcon = (sel: boolean) =>
  L.divIcon({
    className: "",
    html: `<div class="td-pin td-pandal${sel ? " td-sel" : ""}"></div>`,
    iconSize: [size(sel), size(sel)],
    iconAnchor: [size(sel) / 2, size(sel) / 2],
  });

const foodIcon = (sel: boolean) =>
  L.divIcon({
    className: "",
    html: `<div class="td-pin td-food${sel ? " td-sel" : ""}"></div>`,
    iconSize: [size(sel), size(sel)],
    iconAnchor: [size(sel) / 2, size(sel) / 2],
  });

const userIcon = L.divIcon({
  className: "",
  html: '<div class="td-user"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const pickIcon = L.divIcon({
  className: "",
  html: '<div class="td-pick"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const clusterIcon = (kind: "pandal" | "food") => (c: L.MarkerCluster) =>
  L.divIcon({
    className: "",
    html: `<div class="td-cluster td-cluster-${kind}">${c.getChildCount()}</div>`,
    iconSize: [34, 34],
  });

function Markers({
  pandals,
  food,
  selected,
  onSelect,
}: {
  pandals: PandalDTO[];
  food: FoodDTO[];
  selected?: Selection | null;
  onSelect?: (s: Selection) => void;
}) {
  const map = useMap();
  const markers = useRef(new Map<string, L.Marker>());
  const selectRef = useRef(onSelect);
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const pg = L.markerClusterGroup({ iconCreateFunction: clusterIcon("pandal"), maxClusterRadius: 45, showCoverageOnHover: false });
    const fg = L.markerClusterGroup({ iconCreateFunction: clusterIcon("food"), maxClusterRadius: 45, showCoverageOnHover: false });
    const index = markers.current;
    index.clear();
    for (const p of pandals) {
      const m = L.marker([p.latitude, p.longitude], { icon: pandalIcon(false), title: p.name, keyboard: true });
      m.on("click", () => selectRef.current?.({ type: "PANDAL", id: p.id }));
      index.set(`PANDAL:${p.id}`, m);
      pg.addLayer(m);
    }
    for (const f of food) {
      const m = L.marker([f.latitude, f.longitude], { icon: foodIcon(false), title: f.name, keyboard: true });
      m.on("click", () => selectRef.current?.({ type: "FOOD", id: f.id }));
      index.set(`FOOD:${f.id}`, m);
      fg.addLayer(m);
    }
    map.addLayer(pg);
    map.addLayer(fg);
    return () => {
      map.removeLayer(pg);
      map.removeLayer(fg);
      index.clear();
    };
  }, [pandals, food, map]);

  useEffect(() => {
    const index = markers.current;
    for (const [key, m] of index) {
      const isSel = selected ? key === `${selected.type}:${selected.id}` : false;
      m.setIcon(key.startsWith("PANDAL:") ? pandalIcon(isSel) : foodIcon(isSel));
      m.setZIndexOffset(isSel ? 1000 : 0);
    }
  }, [selected, pandals, food]);

  return null;
}

function View({ fit, focus }: { fit?: Coordinates[] | null; focus?: (Coordinates & { zoom?: number }) | null }) {
  const map = useMap();
  useEffect(() => {
    if (!fit || fit.length === 0) return;
    if (fit.length === 1) map.setView([fit[0].lat, fit[0].lng], 15);
    else map.fitBounds(fit.map((p) => [p.lat, p.lng] as [number, number]), { padding: [40, 40], maxZoom: 16 });
  }, [fit, map]);
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), focus.zoom ?? 15), { duration: 0.6 });
  }, [focus, map]);
  return null;
}

function ClickHandler({ onClick }: { onClick?: (c: Coordinates) => void }) {
  useMapEvents({ click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export interface MapCanvasProps {
  pandals?: PandalDTO[];
  food?: FoodDTO[];
  user?: (Coordinates & { accuracy?: number | null }) | null;
  route?: [number, number][] | null;
  selected?: Selection | null;
  onSelect?: (s: Selection) => void;
  onMapClick?: (c: Coordinates) => void;
  pick?: Coordinates | null;
  radius?: { center: Coordinates; meters: number } | null;
  fit?: Coordinates[] | null;
  focus?: (Coordinates & { zoom?: number }) | null;
  className?: string;
}

const KOLKATA: [number, number] = [22.5726, 88.3639];

export default function MapCanvas({
  pandals = [],
  food = [],
  user,
  route,
  selected,
  onSelect,
  onMapClick,
  pick,
  radius,
  fit,
  focus,
  className = "h-full w-full",
}: MapCanvasProps) {
  return (
    <MapContainer center={KOLKATA} zoom={12} className={className} scrollWheelZoom preferCanvas>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Markers pandals={pandals} food={food} selected={selected} onSelect={onSelect} />
      <View fit={fit} focus={focus} />
      <ClickHandler onClick={onMapClick} />
      {radius && (
        <Circle
          center={[radius.center.lat, radius.center.lng]}
          radius={radius.meters}
          pathOptions={{ color: "#2a72d6", weight: 1, fillOpacity: 0.05 }}
        />
      )}
      {user && (
        <>
          {user.accuracy ? (
            <Circle center={[user.lat, user.lng]} radius={user.accuracy} pathOptions={{ color: "#2a72d6", weight: 1, fillOpacity: 0.08 }} />
          ) : null}
          <Marker position={[user.lat, user.lng]} icon={userIcon} interactive={false} />
        </>
      )}
      {pick && <Marker position={[pick.lat, pick.lng]} icon={pickIcon} interactive={false} />}
      {route && route.length > 1 && (
        <Polyline positions={route} pathOptions={{ color: "#c0392b", weight: 5, opacity: 0.85 }} />
      )}
    </MapContainer>
  );
}
