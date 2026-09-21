"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

export type LocationPermission = "unknown" | "prompt" | "granted" | "denied" | "unavailable";
export type LocationError = "denied" | "unavailable" | "timeout" | null;

export interface UserLocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  loading: boolean;
  error: LocationError;
  permission: LocationPermission;
  watching: boolean;
}

const INITIAL: UserLocationState = {
  latitude: null,
  longitude: null,
  accuracy: null,
  heading: null,
  speed: null,
  loading: false,
  error: null,
  permission: "unknown",
  watching: false,
};

export function mapGeoError(code: number): Exclude<LocationError, null> {
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

/**
 * Location is only tracked between start() and stop(); nothing is stored or sent anywhere.
 * `getOnce()` takes a single fix without leaving a watcher running.
 */
export function useUserLocation() {
  const [state, setState] = useState<UserLocationState>(INITIAL);
  const watchId = useRef<number | null>(null);
  const permRef = useRef<LocationPermission>("unknown");

  useEffect(() => {
    permRef.current = state.permission;
  }, [state.permission]);

  const apply = useCallback((pos: GeolocationPosition) => {
    setState((s) => ({
      ...s,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      loading: false,
      error: null,
      permission: "granted",
    }));
  }, []);

  const fail = useCallback((err: GeolocationPositionError) => {
    const e = mapGeoError(err.code);
    if (e === "denied") track("location_permission_denied");
    setState((s) => ({
      ...s,
      loading: false,
      error: e,
      permission: e === "denied" ? "denied" : s.permission,
    }));
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!navigator.geolocation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState((s) => ({ ...s, permission: "unavailable", error: "unavailable" }));
      return;
    }
    let status: PermissionStatus | undefined;
    const sync = () => {
      if (!status) return;
      setState((s) => ({ ...s, permission: status!.state as LocationPermission }));
    };
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        status = p;
        sync();
        p.addEventListener("change", sync);
      })
      .catch(() => {});
    return () => status?.removeEventListener("change", sync);
  }, []);

  const stop = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setState((s) => (s.watching ? { ...s, watching: false } : s));
  }, []);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, permission: "unavailable", error: "unavailable" }));
      return;
    }
    if (watchId.current !== null) return;
    setState((s) => ({ ...s, loading: true, watching: true }));
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        if (permRef.current !== "granted") track("location_permission_granted");
        apply(p);
      },
      (e) => {
        fail(e);
        if (e.code === 1) stop();
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );
  }, [apply, fail, stop]);

  const getOnce = useCallback(
    () =>
      new Promise<{ lat: number; lng: number; accuracy: number }>((resolve, reject) => {
        if (!navigator.geolocation) {
          setState((s) => ({ ...s, permission: "unavailable", error: "unavailable" }));
          reject(new Error("unavailable"));
          return;
        }
        setState((s) => ({ ...s, loading: true }));
        navigator.geolocation.getCurrentPosition(
          (p) => {
            apply(p);
            track("location_permission_granted");
            resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
          },
          (e) => {
            fail(e);
            reject(new Error(mapGeoError(e.code)));
          },
          { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 }
        );
      }),
    [apply, fail]
  );

  useEffect(
    () => () => {
      if (watchId.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    },
    []
  );

  return { ...state, start, stop, getOnce };
}
