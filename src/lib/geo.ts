import { FoodSpot, MetroStation, Pandal } from "@/types";
import { metroStations } from "@/data/metroStations";
import { foodSpots } from "@/data/foodSpots";

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance between two points, in meters. */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Rough walking time estimate at ~4.5 km/h. */
export function walkTimeMinutes(distanceM: number): number {
  return Math.max(1, Math.round(distanceM / (4500 / 60)));
}

export function nearestMetroStations(
  point: LatLng,
  count = 3
): { station: MetroStation; distanceM: number; walkMin: number }[] {
  return metroStations
    .map((station) => {
      const distanceM = haversineDistance(point, station);
      return { station, distanceM, walkMin: walkTimeMinutes(distanceM) };
    })
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, count);
}

export function nearbyFoodSpots(
  pandal: Pandal,
  count = 4
): { spot: FoodSpot; distanceM: number }[] {
  const curated = new Set(pandal.nearestFoodIds);
  return foodSpots
    .map((spot) => ({ spot, distanceM: haversineDistance(pandal, spot) }))
    .sort((a, b) => {
      const aCurated = curated.has(a.spot.id) ? 0 : 1;
      const bCurated = curated.has(b.spot.id) ? 0 : 1;
      if (aCurated !== bCurated) return aCurated - bCurated;
      return a.distanceM - b.distanceM;
    })
    .slice(0, count);
}

/**
 * Nearest-neighbor route heuristic (stands in for the doc's
 * Distance Matrix + 2-opt approach) — good enough for small hopping lists.
 */
export function optimizeRoute(start: LatLng, stops: Pandal[]): Pandal[] {
  const remaining = [...stops];
  const ordered: Pandal[] = [];
  let current = start;

  while (remaining.length) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    remaining.forEach((stop, idx) => {
      const d = haversineDistance(current, stop);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = idx;
      }
    });
    const [next] = remaining.splice(nearestIdx, 1);
    ordered.push(next);
    current = next;
  }

  return ordered;
}

export function totalRouteDistanceM(start: LatLng, stops: Pandal[]): number {
  let total = 0;
  let current = start;
  for (const stop of stops) {
    total += haversineDistance(current, stop);
    current = stop;
  }
  return total;
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/** Builds a Google Maps multi-stop directions deep link (no API key required). */
export function googleMapsRouteUrl(stops: Pandal[], origin?: LatLng): string {
  if (stops.length === 0) return "https://www.google.com/maps";

  const points = stops.map((s) => `${s.lat},${s.lng}`);
  const destination = points[points.length - 1];
  const waypoints = points.slice(0, -1);

  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "walking",
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
