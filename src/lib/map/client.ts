import { api } from "@/lib/api";
import { haversineDistance } from "@/lib/geo";
import type { Address, Coordinates, Distance, Location, MapService, Place, Route } from "./types";
import type { TravelMode } from "@/lib/spatial";

/** Browser-side MapService. Provider-specific work happens server-side behind /api. */
export const clientMapService: MapService = {
  getCurrentLocation(): Promise<Location> {
    return new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new Error("unavailable"));
      navigator.geolocation.getCurrentPosition(
        (p) =>
          resolve({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy,
            heading: p.coords.heading,
            speed: p.coords.speed,
          }),
        (e) => reject(new Error(e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable")),
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 }
      );
    });
  },

  async geocode(address: string): Promise<Place | null> {
    const r = await api<{ places: Place[] }>(`/api/geocode/search?q=${encodeURIComponent(address)}`);
    return r.places[0] ?? null;
  },

  async reverseGeocode(lat: number, lng: number): Promise<Address | null> {
    const r = await api<{ data: Address | null }>(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    return r.data;
  },

  async searchPlaces(query: string, near?: Coordinates): Promise<Place[]> {
    const q = new URLSearchParams({ q: query });
    if (near) {
      q.set("lat", String(near.lat));
      q.set("lng", String(near.lng));
    }
    const r = await api<{ places: Place[] }>(`/api/geocode/search?${q}`);
    return r.places;
  },

  async calculateRoute(origin: Coordinates, destination: Coordinates, mode: TravelMode): Promise<Route> {
    const r = await api<{ data: Route }>("/api/routes", { body: { origin, destination, mode } });
    return r.data;
  },

  async calculateDistance(origin: Coordinates, destination: Coordinates): Promise<Distance> {
    return { meters: Math.round(haversineDistance(origin, destination)), estimated: true };
  },
};
