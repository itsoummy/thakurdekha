export type Zone =
  | "North"
  | "South"
  | "Central"
  | "South-East"
  | "South-West"
  | "East"
  | "Central-East"
  | "Salt Lake"
  | "New Town"
  | "Howrah";

export interface MetroStation {
  id: string;
  name: string;
  line: "Blue" | "Green" | "Purple" | "Orange";
  lat: number;
  lng: number;
}

export interface FoodSpot {
  id: string;
  name: string;
  type: "street_food" | "restaurant";
  cuisineTags: string[];
  lat: number;
  lng: number;
  priceRange: "₹" | "₹₹" | "₹₹₹";
  pujoSpecial: boolean;
}

export interface Pandal {
  id: string;
  name: string;
  nameBn?: string;
  zone: Zone;
  address: string;
  lat: number;
  lng: number;
  theme: string;
  organizer?: string;
  establishedYear?: number;
  budgetRange: "Budget" | "Mid" | "Big Budget" | "Theme Heavyweight";
  openingTime: string;
  closingTime: string;
  description: string;
  crowdRating: number; // 1-5, higher = more crowded
  trendingScore: number; // 0-100, seed value standing in for real signals
  nearestFoodIds: string[];
  // 2026 committee/directory fields (Kolkata_Durga_Puja_2026_Pandal_Directory.xlsx)
  theme2026?: string;
  themeStatus?: "Confirmed" | "Not announced" | "Not verified";
  category?: string;
  sourceNearestMetro?: string;
  googleMapsUrl?: string;
}

/** Pandals listed in the 2026 directory without enough verified detail to place on the map. */
export interface UnverifiedPandal {
  id: string;
  name: string;
  googleMapsUrl?: string;
}
