export type AnalyticsEvent =
  | "pandal_viewed"
  | "food_place_viewed"
  | "directions_clicked"
  | "external_navigation_clicked"
  | "location_permission_granted"
  | "location_permission_denied"
  | "pandal_saved"
  | "pandal_visited"
  | "pandal_added_to_plan"
  | "food_recommendation_submitted"
  | "pandal_submitted"
  | "route_created"
  | "route_optimized";

/** Fire-and-forget product event. Never includes coordinates. */
export function track(name: AnalyticsEvent, entity?: { type: "PANDAL" | "FOOD"; id: string }) {
  try {
    const body = JSON.stringify({ name, entityType: entity?.type, entityId: entity?.id });
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // analytics must never break the UI
  }
}
