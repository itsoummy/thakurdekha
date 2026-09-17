"use client";

import { useCallback, useState } from "react";
import { LatLng } from "@/lib/geo";

// Central Kolkata (Esplanade) fallback when location isn't available/granted.
export const KOLKATA_FALLBACK: LatLng = { lat: 22.5645, lng: 88.3522 };

interface GeolocationState {
  position: LatLng | null;
  status: "idle" | "loading" | "granted" | "denied" | "error";
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    status: "idle",
  });

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ position: null, status: "error" });
      return;
    }
    setState((s) => ({ ...s, status: "loading" }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          status: "granted",
        });
      },
      () => setState({ position: null, status: "denied" }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  return { ...state, request };
}
