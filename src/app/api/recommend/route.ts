import { NextRequest, NextResponse } from "next/server";
import {
  WALK_MINUTES_MAX,
  WALK_MINUTES_MIN,
  getOfficeFallbackCoords,
  metersForWalkMinutes,
  searchRestaurants,
} from "@/lib/kakao";
import { checkPlaceDetails, priceOverlapsTier } from "@/lib/google";
import {
  CategorySelection,
  PriceTier,
  RecommendRequestBody,
  RecommendResponseBody,
  Restaurant,
} from "@/lib/types";

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

// Hard cap on Places API calls one "추천받기" click can spend. Rating is an
// "Enterprise"-tier Places field (the priciest, smallest-free-quota SKU), so
// this loop is written to stop well before this cap whenever possible —
// see QUALIFYING_POOL_SIZE below.
const MAX_PLACE_CHECKS = 12;

// A candidate only needs to clear this bar, not win a beauty contest — we no
// longer rank the whole checked batch by rating and take the top 3, which
// let us stop checking as soon as we have enough good options instead of
// always spending the full Places-check budget.
const RATING_THRESHOLD = 4;

// Stop checking once this many qualifying (rating >= threshold) candidates
// are found, then pick 3 at random from them — a little buffer beyond 3 so
// "random 3" isn't just "first 3 found". Keeps the common case well under
// MAX_PLACE_CHECKS.
const QUALIFYING_POOL_SIZE = 5;

// Priority zone (farther than the previous walkMinutes, i.e. newly
// reachable after dragging the slider out) goes first so its candidates are
// the ones spent against the Places-check budget; within a zone, Kakao's
// own nearest-first order is kept until we know ratings.
function orderForChecking(pool: Restaurant[]): Restaurant[] {
  return [...pool].sort((a, b) => Number(b.priorityZone) - Number(a.priorityZone));
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

// Fills 3 picks from preference-ordered pools (e.g. priority-zone-and-rated
// first, down to deprioritized-zone-and-unrated last), randomizing within
// each pool so results vary between clicks without breaking zone/rating
// preference across pools.
function fillThree(pools: Restaurant[][]): Restaurant[] {
  const result: Restaurant[] = [];
  for (const pool of pools) {
    if (result.length >= 3) break;
    result.push(...shuffle(pool).slice(0, 3 - result.length));
  }
  return result;
}

async function pickThreeMatching(
  pool: Restaurant[],
  excludeIds: string[],
  priceTier: PriceTier | undefined
): Promise<Restaurant[]> {
  let avail = pool.filter((r) => !excludeIds.includes(r.id));
  // Only fall back to re-showing excluded places when there's truly nothing
  // else left — filling the missing slots from excludeIds (rather than
  // discarding the exclusion entirely) avoids repeating already-seen
  // restaurants just because the non-excluded pool dipped below 3.
  if (avail.length === 0) avail = pool;

  const ordered = orderForChecking(avail);
  const qualifying: Restaurant[] = [];
  const fallback: Restaurant[] = [];

  for (let i = 0; i < ordered.length && i < MAX_PLACE_CHECKS && qualifying.length < QUALIFYING_POOL_SIZE; i++) {
    const candidate = ordered[i];
    const details = await checkPlaceDetails(candidate.id, candidate.name, candidate.lat, candidate.lng);
    if (details.lunchStatus === "closed") continue;

    if (priceTier && details.priceMin !== null && details.priceMax !== null) {
      if (!priceOverlapsTier(details.priceMin, details.priceMax, priceTier)) continue;
    }

    const withDetails: Restaurant = {
      ...candidate,
      lunchHoursStatus: details.lunchStatus,
      priceMin: details.priceMin ?? undefined,
      priceMax: details.priceMax ?? undefined,
      rating: details.rating ?? undefined,
      userRatingCount: details.userRatingCount ?? undefined,
    };

    if (details.rating !== null && details.rating >= RATING_THRESHOLD) {
      qualifying.push(withDetails);
    } else {
      fallback.push(withDetails);
    }
  }

  const byZone = (items: Restaurant[], zone: boolean) => items.filter((r) => r.priorityZone === zone);

  // Preference order: priority-zone + rated-well first, down to
  // deprioritized-zone + unrated/low-rated last — only reached if there
  // weren't enough qualifying candidates to fill 3 on their own.
  return fillThree([
    byZone(qualifying, true),
    byZone(qualifying, false),
    byZone(fallback, true),
    byZone(fallback, false),
  ]);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RecommendRequestBody;
  const { lat, lng, walkMinutes, previousWalkMinutes, category, priceTier, excludeIds } = body;

  if (
    typeof walkMinutes !== "number" ||
    walkMinutes < WALK_MINUTES_MIN ||
    walkMinutes > WALK_MINUTES_MAX ||
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

    const targetMeters = metersForWalkMinutes(walkMinutes);
    const rawPool = await searchRestaurants(coords.lat, coords.lng, targetMeters, category);

    // Only treat the previous distance as "already seen" when the slider
    // moved outward — dragging it back in shouldn't deprioritize anything,
    // since nothing new was revealed.
    const alreadySeenMeters =
      typeof previousWalkMinutes === "number" && previousWalkMinutes < walkMinutes
        ? metersForWalkMinutes(previousWalkMinutes)
        : 0;
    const pool: Restaurant[] = rawPool.map((r) => ({ ...r, priorityZone: r.distance_m > alreadySeenMeters }));

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
