import { getDb, transaction } from "./db";
import { ApiError } from "./http";
import { moderationSchema } from "./validation";
import type { z } from "zod";

type Mod = z.infer<typeof moderationSchema>;
type Kind = "pandals" | "food_places" | "food_recommendations" | "pandal_reviews";

const STATUS = { approve: "APPROVED", reject: "REJECTED", flag: "FLAGGED" } as const;

async function assertExists(table: Kind, id: string) {
  if (!(await getDb().prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id))) {
    throw new ApiError(404, "NOT_FOUND", "Item not found.");
  }
}

export async function moderate(table: Kind, id: string, body: Mod) {
  await assertExists(table, id);
  const db = getDb();
  const hasNotes = table === "pandals" || table === "food_places";

  if (body.action === "edit") {
    if (table !== "pandals" && table !== "food_places") throw new ApiError(400, "NOT_EDITABLE", "This item can't be edited.");
    const e = body.edits ?? {};
    const geo = { latitude: "latitude", longitude: "longitude" };
    const map: Record<string, string> =
      table === "pandals"
        ? {
            name: "name", description: "description", history: "history", currentTheme: "current_theme", themeStatus: "theme_status",
            address: "address", category: "category", zone: "zone", budgetRange: "budget_range", nearestMetro: "nearest_metro",
            openingTime: "opening_time", closingTime: "closing_time", establishedYear: "established_year", crowdRating: "crowd_rating",
            googleMapsUrl: "google_maps_url", images: "images", ...geo,
          }
        : {
            name: "name", description: "description", address: "address", category: "category", recommendedDish: "recommended_dish",
            priceRange: "price_range", pujoSpecial: "pujo_special", images: "images", ...geo,
          };
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    for (const [k, col] of Object.entries(map)) {
      const raw = (e as Record<string, string | number | boolean | string[] | undefined>)[k];
      if (raw === undefined) continue;
      const v = Array.isArray(raw) ? JSON.stringify(raw) : typeof raw === "boolean" ? (raw ? 1 : 0) : raw === "" ? null : raw;
      if (col === "name" && v === null) continue;
      sets.push(`${col} = ?`);
      vals.push(v);
    }
    if (body.moderatorNotes !== undefined) {
      sets.push("moderator_notes = ?");
      vals.push(body.moderatorNotes);
    }
    if (!sets.length) throw new ApiError(400, "NO_CHANGES", "Nothing to change.");
    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
    await db.prepare(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
    return;
  }

  const status = STATUS[body.action];
  if (hasNotes) {
    const verified = body.action === "approve" ? (body.verified ? 1 : 0) : 0;
    await db.prepare(
      `UPDATE ${table} SET status = ?, verified = ?, moderator_notes = COALESCE(?, moderator_notes),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
    ).run(status, verified, body.moderatorNotes ?? null, id);
  } else {
    await db.prepare(`UPDATE ${table} SET status = ? WHERE id = ?`).run(status, id);
  }
}

export async function deleteItem(table: Kind, id: string) {
  await assertExists(table, id);
  await getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
}

/** Moves community engagement from `fromId` onto `intoId`, then removes the duplicate. */
export async function mergePandals(fromId: string, intoId: string) {
  if (fromId === intoId) throw new ApiError(400, "SAME_ITEM", "Can't merge an item into itself.");
  await assertExists("pandals", fromId);
  await assertExists("pandals", intoId);
  await transaction(async () => {
    const db = getDb();
    for (const t of ["saved_pandals", "visited_pandals", "pandal_reviews"]) {
      await db.prepare(`UPDATE OR IGNORE ${t} SET pandal_id = ? WHERE pandal_id = ?`).run(intoId, fromId);
    }
    await db.prepare("UPDATE OR IGNORE pandal_food_links SET pandal_id = ? WHERE pandal_id = ?").run(intoId, fromId);
    await db.prepare("UPDATE puja_plan_stops SET entity_id = ? WHERE entity_type = 'PANDAL' AND entity_id = ?").run(intoId, fromId);
    await db.prepare("UPDATE food_recommendations SET pandal_id = ? WHERE pandal_id = ?").run(intoId, fromId);
    await db.prepare("DELETE FROM pandals WHERE id = ?").run(fromId);
  });
}

export async function mergeFood(fromId: string, intoId: string) {
  if (fromId === intoId) throw new ApiError(400, "SAME_ITEM", "Can't merge an item into itself.");
  await assertExists("food_places", fromId);
  await assertExists("food_places", intoId);
  await transaction(async () => {
    const db = getDb();
    await db.prepare("UPDATE food_recommendations SET food_place_id = ? WHERE food_place_id = ?").run(intoId, fromId);
    await db.prepare("UPDATE OR IGNORE pandal_food_links SET food_place_id = ? WHERE food_place_id = ?").run(intoId, fromId);
    await db.prepare("UPDATE puja_plan_stops SET entity_id = ? WHERE entity_type = 'FOOD' AND entity_id = ?").run(intoId, fromId);
    await db.prepare("DELETE FROM food_places WHERE id = ?").run(fromId);
  });
}

export const MAX_PANDAL_PHOTOS = 12;

export async function moderatePhoto(id: string, action: "approve" | "reject") {
  const photo = await getDb().prepare("SELECT pandal_id, image, status FROM pandal_photos WHERE id = ?").get(id);
  if (!photo) throw new ApiError(404, "NOT_FOUND", "Photo not found.");
  if (photo.status !== "PENDING") throw new ApiError(409, "ALREADY_DECIDED", "This photo was already reviewed.");
  if (action === "reject") {
    await getDb().prepare("UPDATE pandal_photos SET status = 'REJECTED' WHERE id = ?").run(id);
    return;
  }
  await transaction(async () => {
    const db = getDb();
    const p = await db.prepare("SELECT images FROM pandals WHERE id = ?").get(photo.pandal_id as string);
    if (!p) throw new ApiError(404, "NOT_FOUND", "Pandal not found.");
    let images: string[] = [];
    try {
      images = JSON.parse(String(p.images ?? "[]"));
    } catch {
      images = [];
    }
    if (!images.includes(photo.image as string)) {
      if (images.length >= MAX_PANDAL_PHOTOS) {
        throw new ApiError(409, "PHOTO_LIMIT", `This pandal already has ${MAX_PANDAL_PHOTOS} photos. Remove one first.`);
      }
      images.push(photo.image as string);
      await db.prepare("UPDATE pandals SET images = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(JSON.stringify(images), photo.pandal_id as string);
    }
    await db.prepare("UPDATE pandal_photos SET status = 'APPROVED' WHERE id = ?").run(id);
  });
}
