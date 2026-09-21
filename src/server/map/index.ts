import { haversineDistance } from "@/lib/geo";
import { decodePolyline } from "@/lib/map/polyline";
import type { Address, Coordinates, Distance, MapService, Place, Route } from "@/lib/map/types";
import type { TravelMode } from "@/lib/spatial";
import { ApiError } from "../http";

type ServerMapService = Omit<MapService, "getCurrentLocation">;

const SPEED_MPS: Record<TravelMode, number> = { WALKING: 1.25, DRIVING: 5.5, TRANSIT: 0 };

function straightLine(origin: Coordinates, destination: Coordinates, mode: TravelMode): Route {
  if (mode === "TRANSIT") {
    throw new ApiError(422, "MODE_UNAVAILABLE", "Public transport routes aren't available right now.");
  }
  const d = haversineDistance(origin, destination);
  return {
    distanceMeters: Math.round(d),
    durationSeconds: Math.round(d / SPEED_MPS[mode]),
    polyline: [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng],
    ],
    mode,
    estimated: true,
    provider: "estimate",
  };
}

const KOLKATA_VIEWBOX = "87.95,23.0,88.75,22.25";
let lastNominatim = 0;

async function nominatim<T>(path: string): Promise<T> {
  const wait = 1100 - (Date.now() - lastNominatim);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const res = await fetch(`https://nominatim.openstreetmap.org/${path}`, {
    headers: { "User-Agent": "thakurdekha/1.0 (durga puja discovery)", "Accept-Language": "en" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  return (await res.json()) as T;
}

const fallbackService: ServerMapService = {
  async geocode(address) {
    const rows = await nominatim<{ place_id: number; display_name: string; lat: string; lon: string }[]>(
      `search?format=jsonv2&limit=1&countrycodes=in&viewbox=${KOLKATA_VIEWBOX}&bounded=1&q=${encodeURIComponent(address)}`
    );
    const r = rows[0];
    return r
      ? { id: String(r.place_id), name: r.display_name.split(",")[0], address: r.display_name, lat: +r.lat, lng: +r.lon, source: "nominatim" }
      : null;
  },
  async reverseGeocode(lat, lng) {
    const r = await nominatim<{ display_name?: string; address?: Record<string, string> }>(
      `reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lng}`
    );
    if (!r.display_name) return null;
    return { formatted: r.display_name, neighbourhood: r.address?.suburb ?? r.address?.neighbourhood };
  },
  async searchPlaces(query) {
    const rows = await nominatim<{ place_id: number; display_name: string; lat: string; lon: string }[]>(
      `search?format=jsonv2&limit=5&countrycodes=in&viewbox=${KOLKATA_VIEWBOX}&bounded=1&q=${encodeURIComponent(query)}`
    );
    return rows.map((r) => ({
      id: String(r.place_id),
      name: r.display_name.split(",")[0],
      address: r.display_name,
      lat: +r.lat,
      lng: +r.lon,
      source: "nominatim" as const,
    }));
  },
  async calculateRoute(o, d, mode) {
    return straightLine(o, d, mode);
  },
  async calculateDistance(o, d): Promise<Distance> {
    return { meters: Math.round(haversineDistance(o, d)), estimated: true };
  },
};

function googleService(key: string): ServerMapService {
  const gmode: Record<TravelMode, string> = { WALKING: "WALK", DRIVING: "DRIVE", TRANSIT: "TRANSIT" };

  async function calculateRoute(origin: Coordinates, destination: Coordinates, mode: TravelMode): Promise<Route> {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: gmode[mode],
        ...(mode === "DRIVING" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`routes ${res.status}`);
    const data = (await res.json()) as {
      routes?: { duration: string; distanceMeters: number; polyline?: { encodedPolyline: string } }[];
    };
    const r = data.routes?.[0];
    if (!r) throw new ApiError(404, "NO_ROUTE", "We couldn't find a route for this destination right now.");
    return {
      distanceMeters: r.distanceMeters,
      durationSeconds: parseInt(r.duration, 10),
      polyline: r.polyline ? decodePolyline(r.polyline.encodedPolyline) : [],
      mode,
      estimated: false,
      provider: "google",
    };
  }

  return {
    calculateRoute,
    async calculateDistance(o, d) {
      const r = await calculateRoute(o, d, "WALKING");
      return { meters: r.distanceMeters, estimated: false };
    },
    async geocode(address) {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&components=country:IN&key=${key}`,
        { signal: AbortSignal.timeout(6000) }
      );
      const data = (await res.json()) as {
        results?: { place_id: string; formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
      };
      const r = data.results?.[0];
      return r
        ? { id: r.place_id, name: r.formatted_address.split(",")[0], address: r.formatted_address, ...r.geometry.location, source: "google" as const }
        : null;
    },
    async reverseGeocode(lat, lng): Promise<Address | null> {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`,
        { signal: AbortSignal.timeout(6000) }
      );
      const data = (await res.json()) as { results?: { formatted_address: string }[] };
      const r = data.results?.[0];
      return r ? { formatted: r.formatted_address } : null;
    },
    async searchPlaces(query, near): Promise<Place[]> {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
        },
        body: JSON.stringify({
          textQuery: query,
          regionCode: "IN",
          maxResultCount: 5,
          locationBias: {
            circle: {
              center: { latitude: near?.lat ?? 22.5726, longitude: near?.lng ?? 88.3639 },
              radius: 20000,
            },
          },
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`places ${res.status}`);
      const data = (await res.json()) as {
        places?: { id: string; displayName?: { text: string }; formattedAddress?: string; location: { latitude: number; longitude: number } }[];
      };
      return (data.places ?? []).map((p) => ({
        id: p.id,
        name: p.displayName?.text ?? "Place",
        address: p.formattedAddress,
        lat: p.location.latitude,
        lng: p.location.longitude,
        source: "google" as const,
      }));
    },
  };
}

export function getMapService(): ServerMapService & { provider: "google" | "estimate" } {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  return key ? { ...googleService(key), provider: "google" } : { ...fallbackService, provider: "estimate" };
}
