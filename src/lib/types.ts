export type CategoryGroup = "한식" | "중식" | "양식" | "일식" | "분식" | "카페" | "기타";
// "기타" isn't user-selectable — it's an internal bucket for places that don't
// match any named group (bars, buffets, fast food, ...), only surfaced via "아무거나".
export type CategorySelection = CategoryGroup | "아무거나";
export type WalkMinutes = 5 | 10 | 15;

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
  // Populated only after the lunch-hours check; absent on raw Kakao candidates.
  lunchHoursStatus?: "open" | "unknown";
}

export interface RecommendRequestBody {
  lat?: number;
  lng?: number;
  walkMinutes: WalkMinutes;
  category: CategorySelection;
  excludeIds?: string[];
}

export interface RecommendResponseBody {
  restaurants: Restaurant[];
  usedFallback: boolean;
  empty: boolean;
}
