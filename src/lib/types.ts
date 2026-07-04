export type CategoryGroup = "한식" | "중식" | "양식" | "일식" | "분식" | "카페" | "채식" | "기타";
// "기타" isn't user-selectable — it's an internal bucket for places that don't
// match any named group (bars, buffets, fast food, ...), only surfaced via "아무거나".
export type CategorySelection = CategoryGroup | "아무거나";
// A continuous slider value (분), not a fixed set — see WALK_MINUTES_MIN/MAX
// in lib/kakao.ts for the allowed range.
export type WalkMinutes = number;
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
  rating?: number;
  userRatingCount?: number;
  // Internal ranking hint: true when this restaurant is farther than
  // previousWalkMinutes from the last request (i.e. newly reachable after
  // the slider was dragged out). Not meaningful to the client beyond how the
  // list is already ordered.
  priorityZone?: boolean;
}

export interface RecommendRequestBody {
  lat?: number;
  lng?: number;
  walkMinutes: WalkMinutes;
  // The walkMinutes used in this session's previous successful recommend, if
  // any. Lets the server prioritize the newly-reachable distance band when
  // the slider is dragged further out, instead of re-surfacing places
  // already shown at the smaller distance.
  previousWalkMinutes?: number;
  category: CategorySelection;
  priceTier?: PriceTier;
  excludeIds?: string[];
}

export interface RecommendResponseBody {
  restaurants: Restaurant[];
  usedFallback: boolean;
  empty: boolean;
}
