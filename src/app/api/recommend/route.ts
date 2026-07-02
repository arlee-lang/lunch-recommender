import { NextRequest, NextResponse } from "next/server";
import {
  RADIUS_BY_WALK_MINUTES,
  getOfficeFallbackCoords,
  pickRandomThree,
  searchRestaurants,
} from "@/lib/kakao";
import {
  CategoryGroup,
  RecommendRequestBody,
  RecommendResponseBody,
  WalkMinutes,
} from "@/lib/types";

const VALID_WALK_MINUTES: WalkMinutes[] = [5, 10, 15];
const VALID_CATEGORIES: CategoryGroup[] = ["한식", "중식", "양식", "기타"];

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RecommendRequestBody;
  const { lat, lng, walkMinutes, category, excludeIds } = body;

  if (
    !VALID_WALK_MINUTES.includes(walkMinutes) ||
    !VALID_CATEGORIES.includes(category)
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

    const radiusM = RADIUS_BY_WALK_MINUTES[walkMinutes];
    const pool = await searchRestaurants(coords.lat, coords.lng, radiusM, category);

    if (pool.length === 0) {
      const response: RecommendResponseBody = { restaurants: [], usedFallback, empty: true };
      return NextResponse.json(response);
    }

    const restaurants = pickRandomThree(pool, excludeIds ?? []);
    const response: RecommendResponseBody = { restaurants, usedFallback, empty: false };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/recommend]", err);
    return NextResponse.json({ error: "지도 정보를 불러오지 못했어요." }, { status: 502 });
  }
}
