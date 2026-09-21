import type { TravelMode } from "@/lib/spatial";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Location extends Coordinates {
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
}

export interface Address {
  formatted: string;
  neighbourhood?: string;
}

export interface Place extends Coordinates {
  id: string;
  name: string;
  address?: string;
  source: "google" | "nominatim" | "community";
}

export interface Distance {
  meters: number;
  estimated: boolean;
}

export interface Route {
  distanceMeters: number;
  durationSeconds: number;
  polyline: [number, number][];
  mode: TravelMode;
  /** True when produced by straight-line math rather than a road network. */
  estimated: boolean;
  provider: "google" | "estimate";
}

export interface MapService {
  getCurrentLocation(): Promise<Location>;
  geocode(address: string): Promise<Place | null>;
  reverseGeocode(lat: number, lng: number): Promise<Address | null>;
  searchPlaces(query: string, near?: Coordinates): Promise<Place[]>;
  calculateRoute(origin: Coordinates, destination: Coordinates, mode: TravelMode): Promise<Route>;
  calculateDistance(origin: Coordinates, destination: Coordinates): Promise<Distance>;
}
