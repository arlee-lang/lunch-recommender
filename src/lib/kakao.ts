import { CategoryGroup, CategorySelection, Restaurant } from "./types";

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
  categoryGroupCode: string,
  extraParams: Record<string, string>
): Promise<{ documents: KakaoCategoryDocument[]; isEnd: boolean }> {
  const url = new URL("https://dapi.kakao.com/v2/local/search/category.json");
  url.searchParams.set("category_group_code", categoryGroupCode);
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

export function parseCategoryGroup(categoryRaw: string, placeName: string): CategoryGroup {
  // Kakao has no official "채식" category — real signal is the 두부전문점
  // subcategory (a genuine 한식 sub-tag) plus literal 비건/채식 in the name.
  // (Kakao's keyword-search for "채식"/"비건" is noisy — mostly unrelated
  // businesses — so this checks structured category text and the name directly.)
  if (categoryRaw.includes("두부") || placeName.includes("비건") || placeName.includes("채식"))
    return "채식";
  if (categoryRaw.includes("한식")) return "한식";
  if (categoryRaw.includes("중식") || categoryRaw.includes("중국음식")) return "중식";
  if (categoryRaw.includes("양식") || categoryRaw.includes("패밀리레스토랑") || categoryRaw.includes("이탈리안"))
    return "양식";
  if (categoryRaw.includes("일식")) return "일식";
  if (categoryRaw.includes("분식")) return "분식";
  if (categoryRaw.includes("카페")) return "카페";
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
  categorySelection: CategorySelection
): Promise<Restaurant[]> {
  const results: Restaurant[] = [];
  const seen = new Set<string>();

  const collect = (docs: KakaoCategoryDocument[]) => {
    for (const doc of docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);

      const group = parseCategoryGroup(doc.category_name, doc.place_name);
      if (categorySelection !== "아무거나" && group !== categorySelection) continue;

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

  // Kakao files 음식점 under FD6 but cafes under their own CE7 group — a plain
  // FD6 search almost never surfaces cafes, so "카페"/"아무거나" need both.
  // "채식" also needs both since a vegan spot could be filed as a cafe (CE7).
  const categoryGroupCodes =
    categorySelection === "카페"
      ? ["CE7"]
      : categorySelection === "아무거나" || categorySelection === "채식"
        ? ["FD6", "CE7"]
        : ["FD6"];

  if (band.min === 0) {
    for (const code of categoryGroupCodes) {
      for (let page = 1; page <= 3; page++) {
        const { documents, isEnd } = await fetchCategoryPage(lat, lng, page, code, {
          radius: String(band.max),
        });
        collect(documents);
        if (isEnd) break;
      }
    }
  } else {
    const rects = buildAnnulusRects(lat, lng, band.min, band.max);
    for (const code of categoryGroupCodes) {
      for (const rect of rects) {
        for (let page = 1; page <= 2; page++) {
          const { documents, isEnd } = await fetchCategoryPage(lat, lng, page, code, { rect });
          collect(documents);
          if (isEnd) break;
        }
      }
    }
  }

  return results;
}
