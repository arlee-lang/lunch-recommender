export type CategoryGroup = "한식" | "중식" | "양식" | "일식" | "분식" | "카페" | "채식" | "기타";
// "기타" isn't user-selectable — it's an internal bucket for places that don't
// match any named group (bars, buffets, fast food, ...), only surfaced via "아무거나".
export type CategorySelection = CategoryGroup | "아무거나";
export type WalkMinutes = 5 | 10 | 15;
export type PriceTier = "under10k" | "10to15k" | "15to20k" | "over20k";

export interface Restaurant {
  id: string;
  name: string;
  category_raw: string;
  category_group: CategoryGroup;
  distance_m: number;
  walk_minutes: number;
  lat: number;
  lng: number;
  road_address?: string;
  phone?: string;
  kakao_map_url: string;
  // Populated only after the lunch-hours/price check; absent on raw Kakao candidates.
  lunchHoursStatus?: "open" | "unknown";
  priceMin?: number;
  priceMax?: number;
}

export interface RecommendRequestBody {
  lat?: number;
  lng?: number;
  walkMinutes: WalkMinutes;
  category: CategorySelection;
  priceTier?: PriceTier;
  excludeIds?: string[];
}

export interface RecommendResponseBody {
  restaurants: Restaurant[];
  usedFallback: boolean;
  empty: boolean;
}
