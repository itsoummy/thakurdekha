"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import Link from "next/link";
import { Pandal } from "@/types";
import { LatLng } from "@/lib/geo";

const pandalIcon = new L.DivIcon({
  className: "",
  html: `<div style="background:#c0392b;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.2)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const userIcon = new L.DivIcon({
  className: "",
  html: `<div style="background:#2a72d6;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 4px rgba(42,114,214,.25)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    map.fitBounds(
      points.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [32, 32] }
    );
  }, [points, map]);
  return null;
}

export default function MapView({
  pandals,
  userLocation,
  routeOrder,
  height = 420,
}: {
  pandals: Pandal[];
  userLocation?: LatLng | null;
  routeOrder?: Pandal[];
  height?: number;
}) {
  const center = pandals[0] ?? { lat: 22.5645, lng: 88.3522 };
  const boundsPoints = [
    ...pandals.map((p) => ({ lat: p.lat, lng: p.lng })),
    ...(userLocation ? [userLocation] : []),
  ];

  const routeLine: [number, number][] | null = routeOrder
    ? [
        ...(userLocation ? [[userLocation.lat, userLocation.lng] as [number, number]] : []),
        ...routeOrder.map((p) => [p.lat, p.lng] as [number, number]),
      ]
    : null;

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      style={{ height, width: "100%", borderRadius: 12 }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={boundsPoints} />

      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      {pandals.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={pandalIcon}>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-neutral-600">{p.theme}</div>
              <Link href={`/pandal/${p.id}`} className="text-xs text-blue-600 underline">
                View details
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}

      {routeLine && routeLine.length > 1 && (
        <Polyline positions={routeLine} pathOptions={{ color: "#c0392b", weight: 3, dashArray: "6 6" }} />
      )}
    </MapContainer>
  );
}
