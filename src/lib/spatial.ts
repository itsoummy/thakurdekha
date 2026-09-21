import { haversineDistance } from "./geo";
import type { LatLng } from "./geo";

export type TravelMode = "WALKING" | "DRIVING" | "TRANSIT";
export const TRAVEL_MODES: TravelMode[] = ["WALKING", "DRIVING", "TRANSIT"];

/** Greater Kolkata service area used to reject obviously wrong submissions. */
export const KOLKATA_BOUNDS = { minLat: 22.25, maxLat: 23.0, minLng: 87.95, maxLng: 88.75 };

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function isWithinKolkata(lat: number, lng: number): boolean {
  return (
    lat >= KOLKATA_BOUNDS.minLat &&
    lat <= KOLKATA_BOUNDS.maxLat &&
    lng >= KOLKATA_BOUNDS.minLng &&
    lng <= KOLKATA_BOUNDS.maxLng
  );
}

/** Bounding box used to pre-filter rows before exact haversine distance. */
export function boundingBox(center: LatLng, radiusM: number) {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01));
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  return Math.round(haversineDistance(a, b));
}

export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function googleMapsDirectionsUrl(
  destination: LatLng,
  opts: { origin?: LatLng; mode?: TravelMode; waypoints?: LatLng[] } = {}
): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
    travelmode: (opts.mode ?? "WALKING").toLowerCase(),
  });
  if (opts.origin) params.set("origin", `${opts.origin.lat},${opts.origin.lng}`);
  if (opts.waypoints?.length) {
    params.set("waypoints", opts.waypoints.map((w) => `${w.lat},${w.lng}`).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Similarity 0..1 on token overlap; used for duplicate detection. */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(" ").filter(Boolean));
  const tb = new Set(norm(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

export interface DuplicateCandidate {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
}

/**
 * A candidate is a likely duplicate when the name is near-identical, or the name is
 * similar and the location is within radiusM, or (for identical addresses) very close.
 */
export function findDuplicates<T extends DuplicateCandidate>(
  input: { name: string; latitude: number; longitude: number; address?: string | null },
  existing: T[],
  radiusM: number
): T[] {
  return existing.filter((e) => {
    const sim = nameSimilarity(input.name, e.name);
    const dist = distanceMeters(
      { lat: input.latitude, lng: input.longitude },
      { lat: e.latitude, lng: e.longitude }
    );
    if (sim >= 0.999) return true;
    if (sim >= 0.5 && dist <= radiusM) return true;
    const sameAddress =
      input.address && e.address && norm(input.address) === norm(e.address) && dist <= radiusM;
    return Boolean(sameAddress);
  });
}
