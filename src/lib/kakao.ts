import { CategoryGroup, Restaurant } from "./types";

const OFFICE_ADDRESS = "서울특별시 중구 장충단로 166 종이나라빌딩 4층";
const WALK_METERS_PER_MINUTE = 67;

export const RADIUS_BY_WALK_MINUTES: Record<number, number> = {
  5: 350,
  10: 700,
  15: 1000,
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
}

function kakaoHeaders() {
  return { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` };
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
  radiusM: number,
  categoryGroup: CategoryGroup
): Promise<Restaurant[]> {
  const results: Restaurant[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= 3; page++) {
    const url = new URL("https://dapi.kakao.com/v2/local/search/category.json");
    url.searchParams.set("category_group_code", "FD6");
    url.searchParams.set("x", String(lng));
    url.searchParams.set("y", String(lat));
    url.searchParams.set("radius", String(radiusM));
    url.searchParams.set("sort", "distance");
    url.searchParams.set("page", String(page));
    url.searchParams.set("size", "15");

    const res = await fetch(url, { headers: kakaoHeaders() });
    if (!res.ok) throw new Error(`kakao category search failed: ${res.status}`);

    const data = (await res.json()) as {
      documents: KakaoCategoryDocument[];
      meta: { is_end: boolean };
    };

    for (const doc of data.documents) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);

      const group = parseCategoryGroup(doc.category_name);
      if (group !== categoryGroup) continue;

      // Kakao returns an empty distance string (not a missing field) when x/y
      // fall outside any real radius match, instead of an empty document list.
      if (!doc.distance) continue;

      const distanceM = Number(doc.distance);
      if (distanceM > radiusM) continue;
      results.push({
        id: doc.id,
        name: doc.place_name,
        category_raw: doc.category_name,
        category_group: group,
        distance_m: distanceM,
        walk_minutes: Math.max(1, Math.round(distanceM / WALK_METERS_PER_MINUTE)),
        road_address: doc.road_address_name || undefined,
        phone: doc.phone || undefined,
        kakao_map_url: doc.place_url,
        naver_map_url: `https://map.naver.com/v5/search/${encodeURIComponent(doc.place_name)}`,
      });
    }

    if (data.meta.is_end) break;
  }

  return results;
}

export function pickRandomThree(pool: Restaurant[], excludeIds: string[]): Restaurant[] {
  let avail = pool.filter((r) => !excludeIds.includes(r.id));
  if (avail.length < 3) avail = pool;

  const shuffled = [...avail].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(3, shuffled.length));
}
