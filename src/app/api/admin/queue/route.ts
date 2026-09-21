import { getDb } from "@/server/db";
import { handle, json } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { duplicateFood, duplicatePandals, listFood, listPandals } from "@/server/repo";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const db = getDb();

  const pendingPandals = (await listPandals({ includeStatuses: ["PENDING"], limit: 200, sort: "name" })).data;
  const pendingFood = (await listFood({ includeStatuses: ["PENDING"], limit: 200 })).data;
  const flagged = {
    pandals: (await listPandals({ includeStatuses: ["FLAGGED"], limit: 100 })).data,
    food: (await listFood({ includeStatuses: ["FLAGGED"], limit: 100 })).data,
  };

  const pendingRecommendations = await db
    .prepare(
      `SELECT r.id, r.rating, r.comment, r.recommended_dish AS recommendedDish, r.created_at AS createdAt,
              f.id AS foodPlaceId, f.name AS foodPlaceName, u.name AS author
       FROM food_recommendations r JOIN food_places f ON f.id = r.food_place_id JOIN users u ON u.id = r.user_id
       WHERE r.status = 'PENDING' AND f.status = 'APPROVED' ORDER BY r.created_at LIMIT 200`
    )
    .all();

  const pendingPhotos = await db
    .prepare(
      `SELECT ph.id, ph.image, ph.created_at AS createdAt, p.id AS pandalId, p.name AS pandalName, u.name AS author
       FROM pandal_photos ph JOIN pandals p ON p.id = ph.pandal_id JOIN users u ON u.id = ph.user_id
       WHERE ph.status = 'PENDING' ORDER BY ph.created_at LIMIT 200`
    )
    .all();

  const reports = (await db
    .prepare(
      `SELECT rp.id, rp.entity_type AS entityType, rp.entity_id AS entityId, rp.reason, rp.description,
              rp.created_at AS createdAt, u.name AS reporter,
              CASE rp.entity_type
                WHEN 'PANDAL' THEN (SELECT name FROM pandals WHERE id = rp.entity_id)
                WHEN 'FOOD' THEN (SELECT name FROM food_places WHERE id = rp.entity_id)
                WHEN 'PANDAL_REVIEW' THEN (SELECT comment FROM pandal_reviews WHERE id = rp.entity_id)
                ELSE (SELECT comment FROM food_recommendations WHERE id = rp.entity_id) END AS entityLabel
       FROM reports rp JOIN users u ON u.id = rp.user_id WHERE rp.status = 'OPEN' ORDER BY rp.created_at LIMIT 200`
    )
    .all()) as { entityType: string }[];

  const pandalDupes = await Promise.all(pendingPandals.map((p) => duplicatePandals(p)));
  const foodDupes = await Promise.all(pendingFood.map((f) => duplicateFood(f)));
  const duplicates = [
    ...pendingPandals.flatMap((p, i) =>
      pandalDupes[i].filter((d) => d.id !== p.id).map((d) => ({ kind: "PANDAL", item: { id: p.id, name: p.name }, candidate: { id: d.id, name: d.name } }))
    ),
    ...pendingFood.flatMap((f, i) =>
      foodDupes[i].filter((d) => d.id !== f.id).map((d) => ({ kind: "FOOD", item: { id: f.id, name: f.name }, candidate: { id: d.id, name: d.name } }))
    ),
  ];

  return json(
    {
      pendingPandals,
      pendingFood,
      pendingRecommendations,
      pendingPhotos,
      flagged,
      reportedContent: reports.filter((r) => r.entityType === "PANDAL" || r.entityType === "FOOD"),
      reportedReviews: reports.filter((r) => r.entityType === "PANDAL_REVIEW" || r.entityType === "FOOD_RECOMMENDATION"),
      duplicates,
    },
    { cache: "private, no-store" }
  );
});
