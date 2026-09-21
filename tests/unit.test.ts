import { describe, expect, it } from "vitest";
import {
  boundingBox,
  distanceMeters,
  findDuplicates,
  formatDuration,
  formatMeters,
  googleMapsDirectionsUrl,
  isValidCoordinate,
  isWithinKolkata,
  nameSimilarity,
} from "@/lib/spatial";
import { optimizeStops, pathLength } from "@/lib/optimize";
import { decodePolyline } from "@/lib/map/polyline";
import { recommendSchema, foodCreateSchema, pandalSubmissionSchema } from "@/server/validation";

describe("distance calculation", () => {
  it("returns ~0 for identical points and a sane figure for known points", () => {
    expect(distanceMeters({ lat: 22.5726, lng: 88.3639 }, { lat: 22.5726, lng: 88.3639 })).toBe(0);
    const d = distanceMeters({ lat: 22.5726, lng: 88.3639 }, { lat: 22.5958, lng: 88.4192 });
    expect(d).toBeGreaterThan(6000);
    expect(d).toBeLessThan(6600);
  });

  it("bounding box always contains points inside the radius", () => {
    const c = { lat: 22.57, lng: 88.36 };
    const b = boundingBox(c, 2000);
    const p = { lat: c.lat + 0.015, lng: c.lng };
    expect(distanceMeters(c, p)).toBeLessThan(2000);
    expect(p.lat).toBeLessThanOrEqual(b.maxLat);
  });
});

describe("location validation", () => {
  it("rejects invalid coordinates", () => {
    expect(isValidCoordinate(22.5, 88.3)).toBe(true);
    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(0, 181)).toBe(false);
    expect(isValidCoordinate(NaN, 0)).toBe(false);
    expect(isValidCoordinate("22" as unknown, 88)).toBe(false);
  });

  it("limits submissions to Greater Kolkata", () => {
    expect(isWithinKolkata(22.57, 88.36)).toBe(true);
    expect(isWithinKolkata(28.6, 77.2)).toBe(false);
  });
});

describe("duplicate detection", () => {
  const existing = [
    { id: "1", name: "Suruchi Sangha", latitude: 22.4907, longitude: 88.355, address: "Golf Green" },
    { id: "2", name: "Some Cafe", latitude: 22.5, longitude: 88.36, address: "Road 1" },
  ];
  it("matches identical names anywhere", () => {
    expect(findDuplicates({ name: "suruchi sangha", latitude: 22.6, longitude: 88.4 }, existing, 150)).toHaveLength(1);
  });
  it("matches similar names only when nearby", () => {
    expect(findDuplicates({ name: "Suruchi Sangha Club", latitude: 22.4908, longitude: 88.3551 }, existing, 150)).toHaveLength(1);
    expect(findDuplicates({ name: "Suruchi Sangha Club", latitude: 22.6, longitude: 88.4 }, existing, 150)).toHaveLength(0);
  });
  it("does not flag unrelated places", () => {
    expect(findDuplicates({ name: "Totally Different", latitude: 22.4907, longitude: 88.355 }, existing, 150)).toHaveLength(0);
  });
  it("name similarity is symmetric-ish and bounded", () => {
    expect(nameSimilarity("a b", "a b")).toBe(1);
    expect(nameSimilarity("a b", "c d")).toBe(0);
  });
});

describe("route formatting", () => {
  it("formats duration and distance", () => {
    expect(formatDuration(20)).toBe("1 min");
    expect(formatDuration(1440)).toBe("24 min");
    expect(formatDuration(3900)).toBe("1 h 5 min");
    expect(formatMeters(742)).toBe("742 m");
    expect(formatMeters(1800)).toBe("1.8 km");
  });
  it("builds a Google Maps URL with mode, origin and waypoints", () => {
    const url = googleMapsDirectionsUrl(
      { lat: 22.6, lng: 88.4 },
      { origin: { lat: 22.5, lng: 88.3 }, mode: "TRANSIT", waypoints: [{ lat: 22.55, lng: 88.35 }] }
    );
    expect(url).toContain("destination=22.6%2C88.4");
    expect(url).toContain("travelmode=transit");
    expect(url).toContain("origin=22.5%2C88.3");
    expect(url).toContain("waypoints=22.55%2C88.35");
  });
  it("decodes Google encoded polylines", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });
});

describe("route optimization", () => {
  const stops = [
    { id: "a", lat: 22.5, lng: 88.3 },
    { id: "far", lat: 22.9, lng: 88.7 },
    { id: "b", lat: 22.51, lng: 88.31 },
    { id: "c", lat: 22.52, lng: 88.32 },
  ];
  it("never lengthens the route vs. the input order and returns legs", () => {
    const origin = { lat: 22.5, lng: 88.3 };
    const r = optimizeStops(origin, stops, "WALKING");
    expect(r.orderedStops).toHaveLength(4);
    expect(pathLength(origin, r.orderedStops)).toBeLessThanOrEqual(pathLength(origin, stops));
    expect(r.legs).toHaveLength(4);
    expect(r.totalDistance).toBe(r.legs.reduce((s, l) => s + l.distanceMeters, 0));
    expect(r.totalDuration).toBeGreaterThan(0);
  });
  it("works without an origin", () => {
    expect(optimizeStops(undefined, stops, "DRIVING").orderedStops).toHaveLength(4);
  });
});

describe("recommendation / submission validation", () => {
  it("bounds ratings and image refs", () => {
    expect(recommendSchema.safeParse({ rating: 6 }).success).toBe(false);
    expect(recommendSchema.safeParse({ rating: 5, images: ["../../etc/passwd"] }).success).toBe(false);
    expect(recommendSchema.safeParse({ rating: 5, comment: "great" }).success).toBe(true);
  });
  it("rejects out-of-area or invalid coordinates", () => {
    expect(pandalSubmissionSchema.safeParse({ name: "X Pandal", latitude: 28.6, longitude: 77.2 }).success).toBe(false);
    expect(pandalSubmissionSchema.safeParse({ name: "X Pandal", latitude: 200, longitude: 88 }).success).toBe(false);
    expect(foodCreateSchema.safeParse({ name: "Shop", latitude: 22.57, longitude: 88.36 }).success).toBe(true);
  });
});
