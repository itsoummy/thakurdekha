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
    const map: Record<string, string> =
      table === "pandals"
        ? { name: "name", description: "description", currentTheme: "current_theme", address: "address", category: "category", images: "images" }
        : { name: "name", description: "description", address: "address", category: "category", recommendedDish: "recommended_dish", priceRange: "price_range", images: "images" };
    const sets: string[] = [];
    const vals: (string | null)[] = [];
    for (const [k, col] of Object.entries(map)) {
      const raw = (e as Record<string, string | string[] | undefined>)[k];
      const v = Array.isArray(raw) ? JSON.stringify(raw) : raw;
      if (v !== undefined) {
        sets.push(`${col} = ?`);
        vals.push(v);
      }
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
