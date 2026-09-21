import { getDb } from "./db";
import type { Row } from "./db";
import { boundingBox, distanceMeters, findDuplicates } from "@/lib/spatial";
import type { DuplicateCandidate } from "@/lib/spatial";

export type Status = "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";

export interface PandalDTO {
  id: string;
  name: string;
  slug: string;
  nameBn: string | null;
  description: string | null;
  history: string | null;
  establishedYear: number | null;
  currentTheme: string | null;
  themeStatus: string | null;
  category: string | null;
  zone: string | null;
  budgetRange: string | null;
  openingTime: string | null;
  closingTime: string | null;
  crowdRating: number | null;
  latitude: number;
  longitude: number;
  address: string | null;
  neighbourhood: string | null;
  nearestMetro: string | null;
  nearestBusStop: string | null;
  googleMapsUrl: string | null;
  images: string[];
  verified: boolean;
  status: Status;
  trust: "VERIFIED" | "COMMUNITY" | "PENDING";
  rating: number | null;
  reviewCount: number;
  popularity: number;
  createdAt: string;
  distanceMeters?: number;
}

export interface FoodDTO {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  recommendedDish: string | null;
  priceRange: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  images: string[];
  pujoSpecial: boolean;
  verified: boolean;
  status: Status;
  trust: "VERIFIED" | "COMMUNITY" | "PENDING";
  rating: number | null;
  reviewCount: number;
  createdAt: string;
  distanceMeters?: number;
}


function trustOf(verified: boolean, status: string): "VERIFIED" | "COMMUNITY" | "PENDING" {
  if (status === "PENDING") return "PENDING";
  return verified && status === "APPROVED" ? "VERIFIED" : "COMMUNITY";
}

const parseImages = (v: unknown): string[] => {
  try {
    const a = JSON.parse(String(v ?? "[]"));
    return Array.isArray(a) ? a.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const PANDAL_SELECT = `
  p.*,
  (SELECT AVG(r.rating) FROM pandal_reviews r WHERE r.pandal_id = p.id AND r.status='APPROVED') AS avg_rating,
  (SELECT COUNT(*) FROM pandal_reviews r WHERE r.pandal_id = p.id AND r.status='APPROVED') AS review_count,
  ((SELECT COUNT(*) FROM saved_pandals s WHERE s.pandal_id = p.id)
   + (SELECT COUNT(*) FROM visited_pandals v WHERE v.pandal_id = p.id)
   + (SELECT COUNT(*) FROM pandal_reviews r WHERE r.pandal_id = p.id AND r.status='APPROVED')) AS popularity
`;

const FOOD_SELECT = `
  f.*,
  (SELECT AVG(r.rating) FROM food_recommendations r WHERE r.food_place_id = f.id AND r.status='APPROVED' AND r.rating IS NOT NULL) AS avg_rating,
  (SELECT COUNT(*) FROM food_recommendations r WHERE r.food_place_id = f.id AND r.status='APPROVED') AS review_count,
  (SELECT r.recommended_dish FROM food_recommendations r WHERE r.food_place_id = f.id AND r.status='APPROVED'
     AND r.recommended_dish IS NOT NULL GROUP BY r.recommended_dish ORDER BY COUNT(*) DESC LIMIT 1) AS top_dish
`;

export function toPandal(r: Row, distance?: number): PandalDTO {
  const verified = Boolean(r.verified);
  const status = r.status as Status;
  const avg = r.avg_rating as number | null;
  return {
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    nameBn: (r.name_bn as string) ?? null,
    description: (r.description as string) ?? null,
    history: (r.history as string) ?? null,
    establishedYear: (r.established_year as number) ?? null,
    currentTheme: (r.current_theme as string) ?? null,
    themeStatus: (r.theme_status as string) ?? null,
    category: (r.category as string) ?? null,
    zone: (r.zone as string) ?? null,
    budgetRange: (r.budget_range as string) ?? null,
    openingTime: (r.opening_time as string) ?? null,
    closingTime: (r.closing_time as string) ?? null,
    crowdRating: (r.crowd_rating as number) ?? null,
    latitude: r.latitude as number,
    longitude: r.longitude as number,
    address: (r.address as string) ?? null,
    neighbourhood: (r.neighbourhood as string) ?? null,
    nearestMetro: (r.nearest_metro as string) ?? null,
    nearestBusStop: (r.nearest_bus_stop as string) ?? null,
    googleMapsUrl: (r.google_maps_url as string) ?? null,
    images: parseImages(r.images),
    verified,
    status,
    trust: trustOf(verified, status),
    rating: avg == null ? null : Math.round(avg * 10) / 10,
    reviewCount: Number(r.review_count ?? 0),
    popularity: Number(r.popularity ?? 0),
    createdAt: r.created_at as string,
    ...(distance !== undefined ? { distanceMeters: distance } : {}),
  };
}

export function toFood(r: Row, distance?: number): FoodDTO {
  const verified = Boolean(r.verified);
  const status = r.status as Status;
  const avg = r.avg_rating as number | null;
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    category: (r.category as string) ?? null,
    recommendedDish: ((r.top_dish as string) ?? (r.recommended_dish as string)) ?? null,
    priceRange: (r.price_range as string) ?? null,
    latitude: r.latitude as number,
    longitude: r.longitude as number,
    address: (r.address as string) ?? null,
    images: parseImages(r.images),
    pujoSpecial: Boolean(r.pujo_special),
    verified,
    status,
    trust: trustOf(verified, status),
    rating: avg == null ? null : Math.round(avg * 10) / 10,
    reviewCount: Number(r.review_count ?? 0),
    createdAt: r.created_at as string,
    ...(distance !== undefined ? { distanceMeters: distance } : {}),
  };
}

export interface ListOpts {
  q?: string;
  zone?: string;
  budget?: string;
  category?: string;
  ids?: string[];
  center?: { lat: number; lng: number };
  radius?: number;
  sort?: "trending" | "distance" | "crowd" | "popular" | "rating" | "name";
  limit?: number;
  offset?: number;
  includeStatuses?: Status[];
  createdBy?: string;
}

const like = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

export async function listPandals(o: ListOpts = {}): Promise<{ data: PandalDTO[]; total: number }> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  const statuses = o.includeStatuses ?? ["APPROVED"];
  where.push(`p.status IN (${statuses.map(() => "?").join(",")})`);
  params.push(...statuses);
  if (o.q) {
    where.push(
      `(p.name LIKE ? ESCAPE '\\' OR p.address LIKE ? ESCAPE '\\' OR p.neighbourhood LIKE ? ESCAPE '\\' OR p.zone LIKE ? ESCAPE '\\' OR p.current_theme LIKE ? ESCAPE '\\' OR p.nearest_metro LIKE ? ESCAPE '\\' OR p.name_bn LIKE ? ESCAPE '\\')`
    );
    for (let i = 0; i < 7; i++) params.push(like(o.q));
  }
  if (o.zone) {
    where.push("p.zone = ?");
    params.push(o.zone);
  }
  if (o.budget) {
    where.push("p.budget_range = ?");
    params.push(o.budget);
  }
  if (o.category) {
    where.push("p.category LIKE ? ESCAPE '\\'");
    params.push(like(o.category));
  }
  if (o.createdBy) {
    where.push("p.created_by = ?");
    params.push(o.createdBy);
  }
  if (o.ids?.length) {
    where.push(`p.id IN (${o.ids.map(() => "?").join(",")})`);
    params.push(...o.ids);
  }
  if (o.center && o.radius) {
    const b = boundingBox(o.center, o.radius);
    where.push("p.latitude BETWEEN ? AND ? AND p.longitude BETWEEN ? AND ?");
    params.push(b.minLat, b.maxLat, b.minLng, b.maxLng);
  }

  const rows = await getDb()
    .prepare(`SELECT ${PANDAL_SELECT} FROM pandals p WHERE ${where.join(" AND ")}`)
    .all(...params);

  let items = rows.map((r) =>
    toPandal(r, o.center ? distanceMeters(o.center, { lat: r.latitude as number, lng: r.longitude as number }) : undefined)
  );
  if (o.center && o.radius) items = items.filter((p) => (p.distanceMeters ?? 0) <= o.radius!);

  const sort = o.sort ?? (o.center ? "distance" : "trending");
  const trend = new Map(rows.map((r) => [r.id as string, Number(r.trending_score ?? 0)]));
  items.sort((a, b) => {
    switch (sort) {
      case "distance":
        return (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity);
      case "crowd":
        return (a.crowdRating ?? 99) - (b.crowdRating ?? 99);
      case "rating":
        return (b.rating ?? -1) - (a.rating ?? -1);
      case "name":
        return a.name.localeCompare(b.name);
      case "popular":
        return b.popularity - a.popularity || (trend.get(b.id) ?? 0) - (trend.get(a.id) ?? 0);
      default:
        return (trend.get(b.id) ?? 0) - (trend.get(a.id) ?? 0);
    }
  });

  const total = items.length;
  const offset = o.offset ?? 0;
  return { data: items.slice(offset, offset + (o.limit ?? 100)), total };
}

export async function getPandal(id: string, opts: { includeAny?: boolean } = {}): Promise<PandalDTO | null> {
  const r = await getDb().prepare(`SELECT ${PANDAL_SELECT} FROM pandals p WHERE p.id = ?`).get(id);
  if (!r) return null;
  if (!opts.includeAny && r.status !== "APPROVED") return null;
  return toPandal(r);
}

export async function listFood(o: ListOpts & { pandalId?: string } = {}): Promise<{ data: FoodDTO[]; total: number }> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  const statuses = o.includeStatuses ?? ["APPROVED"];
  where.push(`f.status IN (${statuses.map(() => "?").join(",")})`);
  params.push(...statuses);
  if (o.q) {
    where.push("(f.name LIKE ? ESCAPE '\\' OR f.category LIKE ? ESCAPE '\\' OR f.address LIKE ? ESCAPE '\\' OR f.recommended_dish LIKE ? ESCAPE '\\')");
    for (let i = 0; i < 4; i++) params.push(like(o.q));
  }
  if (o.category) {
    where.push("f.category LIKE ? ESCAPE '\\'");
    params.push(like(o.category));
  }
  if (o.createdBy) {
    where.push("f.created_by = ?");
    params.push(o.createdBy);
  }
  if (o.ids?.length) {
    where.push(`f.id IN (${o.ids.map(() => "?").join(",")})`);
    params.push(...o.ids);
  }
  if (o.center && o.radius) {
    const b = boundingBox(o.center, o.radius);
    where.push("f.latitude BETWEEN ? AND ? AND f.longitude BETWEEN ? AND ?");
    params.push(b.minLat, b.maxLat, b.minLng, b.maxLng);
  }
  const rows = await getDb()
    .prepare(`SELECT ${FOOD_SELECT} FROM food_places f WHERE ${where.join(" AND ")}`)
    .all(...params);

  const linked = new Set<string>();
  if (o.pandalId) {
    for (const r of await getDb().prepare("SELECT food_place_id FROM pandal_food_links WHERE pandal_id = ?").all(o.pandalId))
      linked.add(r.food_place_id as string);
  }

  let items = rows.map((r) =>
    toFood(r, o.center ? distanceMeters(o.center, { lat: r.latitude as number, lng: r.longitude as number }) : undefined)
  );
  if (o.center && o.radius) items = items.filter((f) => (f.distanceMeters ?? 0) <= o.radius!);

  const sort = o.sort ?? (o.center ? "distance" : "name");
  items.sort((a, b) => {
    if (sort === "rating") return (b.rating ?? -1) - (a.rating ?? -1) || (b.reviewCount - a.reviewCount);
    if (sort === "popular") return b.reviewCount - a.reviewCount || (b.rating ?? -1) - (a.rating ?? -1);
    if (sort === "distance") return (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity);
    return a.name.localeCompare(b.name);
  });

  const total = items.length;
  const offset = o.offset ?? 0;
  return { data: items.slice(offset, offset + (o.limit ?? 100)), total };
}

export async function getFood(id: string, opts: { includeAny?: boolean } = {}): Promise<FoodDTO | null> {
  const r = await getDb().prepare(`SELECT ${FOOD_SELECT} FROM food_places f WHERE f.id = ?`).get(id);
  if (!r) return null;
  if (!opts.includeAny && r.status !== "APPROVED") return null;
  return toFood(r);
}

export async function duplicatePandals(
  input: { name: string; latitude: number; longitude: number; address?: string | null },
  radiusM = 150
): Promise<DuplicateCandidate[]> {
  const b = boundingBox({ lat: input.latitude, lng: input.longitude }, 2000);
  const rows = (await getDb()
    .prepare(
      `SELECT id, name, latitude, longitude, address FROM pandals
       WHERE status IN ('APPROVED','PENDING') AND (name LIKE ? ESCAPE '\\' OR (latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?))`
    )
    .all(like(input.name.split(/\s+/)[0] ?? input.name), b.minLat, b.maxLat, b.minLng, b.maxLng)) as unknown as DuplicateCandidate[];
  return findDuplicates(input, rows, radiusM);
}

export async function duplicateFood(
  input: { name: string; latitude: number; longitude: number; address?: string | null },
  radiusM = 50
): Promise<DuplicateCandidate[]> {
  const b = boundingBox({ lat: input.latitude, lng: input.longitude }, 1000);
  const rows = (await getDb()
    .prepare(
      `SELECT id, name, latitude, longitude, address FROM food_places
       WHERE status IN ('APPROVED','PENDING') AND (name LIKE ? ESCAPE '\\' OR (latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?))`
    )
    .all(like(input.name.split(/\s+/)[0] ?? input.name), b.minLat, b.maxLat, b.minLng, b.maxLng)) as unknown as DuplicateCandidate[];
  return findDuplicates(input, rows, radiusM);
}
