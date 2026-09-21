import { getDb, newId } from "./db";
import { ApiError } from "./http";
import { getFood } from "./repo";
import { recommendSchema } from "./validation";
import type { z } from "zod";

export async function addRecommendation(userId: string, foodId: string, body: z.infer<typeof recommendSchema>) {
  if (!(await getFood(foodId))) throw new ApiError(404, "NOT_FOUND", "Food place not found.");
  const db = getDb();
  if (body.pandalId) {
    if (!(await db.prepare("SELECT 1 FROM pandals WHERE id = ? AND status = 'APPROVED'").get(body.pandalId))) {
      throw new ApiError(400, "BAD_PANDAL", "That pandal doesn't exist.");
    }
    await db.prepare("INSERT OR IGNORE INTO pandal_food_links (pandal_id, food_place_id) VALUES (?,?)").run(body.pandalId, foodId);
  }
  if (body.rating === undefined && !body.comment && !body.recommendedDish) {
    throw new ApiError(400, "EMPTY_RECOMMENDATION", "Add a rating, dish or comment.");
  }
  const id = newId("fr_");
  await db.prepare(
    `INSERT INTO food_recommendations (id,user_id,food_place_id,pandal_id,rating,comment,recommended_dish,images,status)
     VALUES (?,?,?,?,?,?,?,?,'PENDING')`
  ).run(id, userId, foodId, body.pandalId ?? null, body.rating ?? null, body.comment ?? null, body.recommendedDish ?? null, JSON.stringify(body.images));
  return id;
}
