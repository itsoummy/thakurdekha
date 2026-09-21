import { z } from "zod";
import { isWithinKolkata } from "@/lib/spatial";

const ZONES = ["North", "South", "Central", "South-East", "South-West", "East", "Central-East", "Salt Lake", "New Town", "Howrah"] as const;
const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) =>
  text(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const latitude = z.number().finite().min(-90).max(90);
export const longitude = z.number().finite().min(-180).max(180);

export const coords = z.object({ lat: latitude, lng: longitude });

const imageRef = z.string().regex(/^[a-zA-Z0-9_-]{6,64}\.webp$/, "Invalid image reference");
export const images = z.array(imageRef).max(6).default([]);

const kolkataPoint = (v: { latitude: number; longitude: number }) => isWithinKolkata(v.latitude, v.longitude);
const kolkataMsg = { message: "Location must be within Greater Kolkata.", path: ["latitude"] };

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: text(80).min(1),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export const pandalSubmissionSchema = z
  .object({
    name: text(120).min(2),
    latitude,
    longitude,
    address: optText(300),
    description: optText(2000),
    history: optText(4000),
    currentTheme: optText(200),
    establishedYear: z.number().int().min(1600).max(new Date().getFullYear()).optional(),
    nearestMetro: optText(100),
    nearestBusStop: optText(100),
    neighbourhood: optText(100),
    images,
    force: z.boolean().optional(),
  })
  .refine(kolkataPoint, kolkataMsg);

export const foodCreateSchema = z
  .object({
    name: text(120).min(2),
    latitude,
    longitude,
    address: optText(300),
    description: optText(1000),
    category: optText(60),
    recommendedDish: optText(120),
    priceRange: z.enum(["₹", "₹₹", "₹₹₹"]).optional(),
    rating: z.number().int().min(1).max(5).optional(),
    comment: optText(1000),
    pandalIds: z.array(z.string().min(1).max(64)).max(10).default([]),
    images,
    force: z.boolean().optional(),
  })
  .refine(kolkataPoint, kolkataMsg);

export const recommendSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: optText(1000),
  recommendedDish: optText(120),
  pandalId: z.string().min(1).max(64).optional(),
  images,
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: optText(1000),
  images,
});

export const routeSchema = z.object({
  origin: coords,
  destination: coords,
  mode: z.enum(["WALKING", "DRIVING", "TRANSIT"]).default("WALKING"),
});

export const optimizeSchema = z.object({
  origin: coords.optional(),
  stops: z
    .array(z.object({ id: z.string().min(1).max(64), lat: latitude, lng: longitude }))
    .min(1)
    .max(25),
  travelMode: z.enum(["WALKING", "DRIVING", "TRANSIT"]).default("WALKING"),
});

export const planSchema = z.object({
  name: text(80).min(1),
  travelMode: z.enum(["WALKING", "DRIVING", "TRANSIT"]).optional(),
  stops: z
    .array(z.object({ type: z.enum(["PANDAL", "FOOD"]), id: z.string().min(1).max(64) }))
    .max(40),
});

export const reportSchema = z.object({
  entityType: z.enum(["PANDAL", "FOOD", "PANDAL_REVIEW", "FOOD_RECOMMENDATION"]),
  entityId: z.string().min(1).max(64),
  reason: z.enum(["INCORRECT_INFO", "DUPLICATE", "CLOSED", "WRONG_LOCATION", "SPAM", "INAPPROPRIATE", "OTHER"]),
  description: optText(1000),
});

export const moderationSchema = z.object({
  action: z.enum(["approve", "reject", "flag", "edit"]),
  moderatorNotes: optText(1000),
  verified: z.boolean().optional(),
  edits: z
    .object({
      name: text(120).min(2).optional(),
      description: text(2000).optional(),
      history: text(4000).optional(),
      currentTheme: text(200).optional(),
      themeStatus: text(200).optional(),
      address: text(300).optional(),
      category: text(120).optional(),
      zone: z.enum(ZONES).optional(),
      budgetRange: z.enum(["Budget", "Mid", "Big Budget", "Theme Heavyweight"]).optional(),
      nearestMetro: text(120).optional(),
      openingTime: text(30).optional(),
      closingTime: text(30).optional(),
      establishedYear: z.number().int().min(1800).max(2100).optional(),
      crowdRating: z.number().int().min(1).max(5).optional(),
      googleMapsUrl: z.union([z.literal(""), z.string().trim().url().max(500).startsWith("https://")]).optional(),
      latitude: latitude.optional(),
      longitude: longitude.optional(),
      pujoSpecial: z.boolean().optional(),
      recommendedDish: text(120).optional(),
      priceRange: z.enum(["₹", "₹₹", "₹₹₹"]).optional(),
      images: z.array(imageRef).max(6).optional(),
    })
    .refine(
      (e) => (e.latitude === undefined) === (e.longitude === undefined) && (e.latitude === undefined || isWithinKolkata(e.latitude, e.longitude!)),
      { message: "Provide both coordinates, within Greater Kolkata.", path: ["latitude"] }
    )
    .optional(),
});

export const adminListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED", "FLAGGED"]).default("ALL"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

export const roleSchema = z.object({ role: z.enum(["USER", "ADMIN"]) });

export const analyticsSchema = z.object({
  name: z.enum([
    "pandal_viewed",
    "food_place_viewed",
    "directions_clicked",
    "external_navigation_clicked",
    "location_permission_granted",
    "location_permission_denied",
    "pandal_saved",
    "pandal_visited",
    "pandal_added_to_plan",
    "food_recommendation_submitted",
    "pandal_submitted",
    "route_created",
    "route_optimized",
  ]),
  entityType: z.enum(["PANDAL", "FOOD"]).optional(),
  entityId: z.string().max(64).optional(),
});

export const nearbyQuery = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
  radius: z.coerce.number().int().min(50).max(50_000).default(2000),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export function parseQuery<T extends z.ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  return schema.parse(Object.fromEntries(new URL(req.url).searchParams));
}

export const assistantSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "model"]), text: z.string().trim().min(1).max(1000) }))
    .min(1)
    .max(12)
    .refine((m) => m.at(-1)?.role === "user", "Last message must be from the user."),
});
