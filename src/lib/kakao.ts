import { CategoryGroup, Restaurant } from "./types";

const OFFICE_ADDRESS = "서울특별시 중구 장충단로 166 종이나라빌딩 4층";
const WALK_METERS_PER_MINUTE = 67;

// Each walk-minute option is a distinct band, not "within N minutes" —
// picking 10분 means a 6~10분 walk, not anything closer than that too.
export const WALK_BAND_METERS: Record<number, { min: number; max: number }> = {
  5: { min: 0, max: 350 },
  10: { min: 350, max: 700 },
  15: { min: 700, max: 1000 },
};

interface KakaoAddressDocument {
  x: string;
  y: string;
}

interface KakaoCategoryDocument {
  id: string;
  place_name: string;
  category_name: string;
  distance: string;
  road_address_name: string;
  phone: string;
  place_url: string;
  x: string;
  y: string;
}

function kakaoHeaders() {
  return { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` };
}

const METERS_PER_DEG_LAT = 111320;

function metersToLatDelta(m: number): number {
  return m / METERS_PER_DEG_LAT;
}

function metersToLonDelta(m: number, atLat: number): number {
  return m / (METERS_PER_DEG_LAT * Math.cos((atLat * Math.PI) / 180));
}

// Kakao's category search caps results at 45 (page 1~3 x size 15), sorted
// nearest-first. In dense areas (e.g. the office's own street of ~1000
// restaurants within 1km) those 45 slots are exhausted well inside 200m, so a
// plain radius query can never surface anything past that — a farther band
// would always look empty even though real matches exist further out. A
// single `rect` bounding box has the same cap, but splitting the outer band
// into 4 disjoint strips around a square "ring" (excluding the inner circle)
// keeps each query's candidate pool small enough to actually reach the band.
function buildAnnulusRects(lat: number, lng: number, minM: number, maxM: number): string[] {
  const dLatMin = metersToLatDelta(minM);
  const dLatMax = metersToLatDelta(maxM);
  const dLonMin = metersToLonDelta(minM, lat);
  const dLonMax = metersToLonDelta(maxM, lat);

  const north = [lng - dLonMax, lat + dLatMin, lng + dLonMax, lat + dLatMax];
  const south = [lng - dLonMax, lat - dLatMax, lng + dLonMax, lat - dLatMin];
  const east = [lng + dLonMin, lat - dLatMin, lng + dLonMax, lat + dLatMin];
  const west = [lng - dLonMax, lat - dLatMin, lng - dLonMin, lat + dLatMin];

  return [north, south, east, west].map((r) => r.join(","));
}

async function fetchCategoryPage(
  lat: number,
  lng: number,
  page: number,
  extraParams: Record<string, string>
): Promise<{ documents: KakaoCategoryDocument[]; isEnd: boolean }> {
  const url = new URL("https://dapi.kakao.com/v2/local/search/category.json");
  url.searchParams.set("category_group_code", "FD6");
  url.searchParams.set("x", String(lng));
  url.searchParams.set("y", String(lat));
  url.searchParams.set("sort", "distance");
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", "15");
  for (const [key, value] of Object.entries(extraParams)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, { headers: kakaoHeaders() });
  if (!res.ok) throw new Error(`kakao category search failed: ${res.status}`);

  const data = (await res.json()) as {
    documents: KakaoCategoryDocument[];
    meta: { is_end: boolean };
  };
  return { documents: data.documents, isEnd: data.meta.is_end };
}

export function parseCategoryGroup(categoryRaw: string): CategoryGroup {
  if (categoryRaw.includes("돈까스") || categoryRaw.includes("우동")) return "기타";
  if (
    categoryRaw.includes("한식") ||
    categoryRaw.includes("육류,고기") ||
    categoryRaw.includes("국수") ||
    categoryRaw.includes("찌개,전골")
  )
    return "한식";
  if (categoryRaw.includes("중식") || categoryRaw.includes("중국음식")) return "중식";
  if (
    categoryRaw.includes("양식") ||
    categoryRaw.includes("패밀리레스토랑") ||
    categoryRaw.includes("이탈리안")
  )
    return "양식";
  return "기타";
}

let cachedOfficeCoords: { lat: number; lng: number } | null = null;

export async function getOfficeFallbackCoords(): Promise<{ lat: number; lng: number }> {
  if (cachedOfficeCoords) return cachedOfficeCoords;

  const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(OFFICE_ADDRESS)}`;
  const res = await fetch(url, { headers: kakaoHeaders() });
  if (!res.ok) throw new Error(`kakao geocode failed: ${res.status}`);

  const data = (await res.json()) as { documents: KakaoAddressDocument[] };
  const doc = data.documents[0];
  if (!doc) throw new Error("office address not found");

  cachedOfficeCoords = { lat: Number(doc.y), lng: Number(doc.x) };
  return cachedOfficeCoords;
}

export async function searchRestaurants(
  lat: number,
  lng: number,
  band: { min: number; max: number },
  categoryGroup: CategoryGroup
): Promise<Restaurant[]> {
  const results: Restaurant[] = [];
  const seen = new Set<string>();

  const collect = (docs: KakaoCategoryDocument[]) => {
    for (const doc of docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);

      const group = parseCategoryGroup(doc.category_name);
      if (group !== categoryGroup) continue;

      // Kakao returns an empty distance string (not a missing field) when x/y
      // fall outside any real radius/rect match, instead of an empty list.
      if (!doc.distance) continue;

      const distanceM = Number(doc.distance);
      if (distanceM > band.max || distanceM <= band.min) continue;
      results.push({
        id: doc.id,
        name: doc.place_name,
        category_raw: doc.category_name,
        category_group: group,
        distance_m: distanceM,
        walk_minutes: Math.max(1, Math.round(distanceM / WALK_METERS_PER_MINUTE)),
        lat: Number(doc.y),
        lng: Number(doc.x),
        road_address: doc.road_address_name || undefined,
        phone: doc.phone || undefined,
        kakao_map_url: doc.place_url,
      });
    }
  };

  if (band.min === 0) {
    for (let page = 1; page <= 3; page++) {
      const { documents, isEnd } = await fetchCategoryPage(lat, lng, page, {
        radius: String(band.max),
      });
      collect(documents);
      if (isEnd) break;
    }
  } else {
    const rects = buildAnnulusRects(lat, lng, band.min, band.max);
    for (const rect of rects) {
      for (let page = 1; page <= 2; page++) {
        const { documents, isEnd } = await fetchCategoryPage(lat, lng, page, { rect });
        collect(documents);
        if (isEnd) break;
      }
    }
  }

  return results;
}
