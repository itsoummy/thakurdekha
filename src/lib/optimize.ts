import { haversineDistance } from "./geo";
import type { LatLng } from "./geo";
import type { TravelMode } from "./spatial";

export interface OptimizeStop extends LatLng {
  id: string;
}

export interface RouteLeg {
  fromId: string | null;
  toId: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface OptimizeResult {
  orderedStops: OptimizeStop[];
  totalDistance: number;
  totalDuration: number;
  legs: RouteLeg[];
  estimated: true;
}

const SPEED_MPS: Record<TravelMode, number> = { WALKING: 1.25, DRIVING: 5.5, TRANSIT: 3.5 };

export function pathLength(origin: LatLng | undefined, order: LatLng[]): number {
  let total = 0;
  let cur = origin;
  for (const s of order) {
    if (cur) total += haversineDistance(cur, s);
    cur = s;
  }
  return total;
}

/** Nearest-neighbour seed refined with 2-opt. Pure and deterministic. */
export function optimizeStops(
  origin: LatLng | undefined,
  stops: OptimizeStop[],
  mode: TravelMode
): OptimizeResult {
  const remaining = [...stops];
  let order: OptimizeStop[] = [];
  let cur: LatLng | undefined = origin ?? remaining.shift();
  if (!origin && cur) order.push(cur as OptimizeStop);
  while (remaining.length) {
    let bi = 0;
    let bd = Infinity;
    remaining.forEach((s, i) => {
      const d = cur ? haversineDistance(cur, s) : 0;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    const [next] = remaining.splice(bi, 1);
    order.push(next);
    cur = next;
  }

  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const cand = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (pathLength(origin, cand) + 1e-6 < pathLength(origin, order)) {
          order = cand;
          improved = true;
        }
      }
    }
  }

  const legs: RouteLeg[] = [];
  let prev: OptimizeStop | undefined;
  let from: LatLng | undefined = origin;
  for (const s of order) {
    if (from) {
      const d = haversineDistance(from, s);
      legs.push({
        fromId: prev?.id ?? null,
        toId: s.id,
        distanceMeters: Math.round(d),
        durationSeconds: Math.round(d / SPEED_MPS[mode]),
      });
    }
    prev = s;
    from = s;
  }
  return {
    orderedStops: order,
    totalDistance: legs.reduce((a, l) => a + l.distanceMeters, 0),
    totalDuration: legs.reduce((a, l) => a + l.durationSeconds, 0),
    legs,
    estimated: true,
  };
}
