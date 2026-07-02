import { NextRequest, NextResponse } from "next/server";
import { WALK_BAND_METERS, getOfficeFallbackCoords, searchRestaurants } from "@/lib/kakao";
import { checkPlaceDetails, priceOverlapsTier } from "@/lib/google";
import {
  CategorySelection,
  PriceTier,
  RecommendRequestBody,
  RecommendResponseBody,
  Restaurant,
  WalkMinutes,
} from "@/lib/types";

const VALID_WALK_MINUTES: WalkMinutes[] = [5, 10, 15];
const VALID_CATEGORIES: CategorySelection[] = [
  "한식",
  "중식",
  "양식",
  "일식",
  "분식",
  "카페",
  "채식",
  "아무거나",
];
const VALID_PRICE_TIERS: PriceTier[] = ["under10k", "10to15k", "15to20k", "over20k"];

// Bounds how many Places API calls one "추천받기" click can spend — we only
// need 3 final picks, not a lunch-hours/price check on the whole candidate pool.
const MAX_PLACE_CHECKS = 12;

async function pickThreeMatching(
  pool: Restaurant[],
  excludeIds: string[],
  priceTier: PriceTier | undefined
): Promise<Restaurant[]> {
  let avail = pool.filter((r) => !excludeIds.includes(r.id));
  if (avail.length < 3) avail = pool;

  const shuffled = [...avail].sort(() => Math.random() - 0.5);
  const picked: Restaurant[] = [];

  for (let i = 0; i < shuffled.length && i < MAX_PLACE_CHECKS && picked.length < 3; i++) {
    const candidate = shuffled[i];
    const details = await checkPlaceDetails(candidate.id, candidate.name, candidate.lat, candidate.lng);
    if (details.lunchStatus === "closed") continue;

    if (priceTier && details.priceMin !== null && details.priceMax !== null) {
      if (!priceOverlapsTier(details.priceMin, details.priceMax, priceTier)) continue;
    }

    picked.push({
      ...candidate,
      lunchHoursStatus: details.lunchStatus,
      priceMin: details.priceMin ?? undefined,
      priceMax: details.priceMax ?? undefined,
    });
  }

  return picked;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RecommendRequestBody;
  const { lat, lng, walkMinutes, category, priceTier, excludeIds } = body;

  if (
    !VALID_WALK_MINUTES.includes(walkMinutes) ||
    !VALID_CATEGORIES.includes(category) ||
    (priceTier !== undefined && !VALID_PRICE_TIERS.includes(priceTier))
  ) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  try {
    let coords: { lat: number; lng: number };
    let usedFallback = false;

    if (typeof lat === "number" && typeof lng === "number") {
      coords = { lat, lng };
    } else {
      coords = await getOfficeFallbackCoords();
      usedFallback = true;
    }

    const band = WALK_BAND_METERS[walkMinutes];
    const pool = await searchRestaurants(coords.lat, coords.lng, band, category);

    if (pool.length === 0) {
      const response: RecommendResponseBody = { restaurants: [], usedFallback, empty: true };
      return NextResponse.json(response);
    }

    const restaurants = await pickThreeMatching(pool, excludeIds ?? [], priceTier);
    const response: RecommendResponseBody = {
      restaurants,
      usedFallback,
      empty: restaurants.length === 0,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/recommend]", err);
    return NextResponse.json({ error: "지도 정보를 불러오지 못했어요." }, { status: 502 });
  }
}
