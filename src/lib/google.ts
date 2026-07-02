import { PriceTier } from "./types";

const MATCH_DISTANCE_TOLERANCE_M = 300;
const CACHE_TTL_MS = 5 * 60 * 1000; // openNow can flip within the hour, unlike price/name

export const PRICE_TIER_RANGES: Record<PriceTier, { min: number; max: number }> = {
  under10k: { min: 0, max: 10000 },
  "10to15k": { min: 10000, max: 15000 },
  "15to20k": { min: 15000, max: 20000 },
  over20k: { min: 20000, max: Infinity },
};

export function priceOverlapsTier(priceMin: number, priceMax: number, tier: PriceTier): boolean {
  const range = PRICE_TIER_RANGES[tier];
  return priceMin <= range.max && priceMax >= range.min;
}

interface GooglePriceRange {
  startPrice?: { units?: string };
  endPrice?: { units?: string };
}

interface GooglePlace {
  id: string;
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { openNow?: boolean };
  priceRange?: GooglePriceRange;
}

// "open" / "closed" reflect real-time status (Google's own openNow), not a
// fixed lunch window — a place open at 3pm counts, one open only 6-9pm doesn't.
export type LunchStatus = "open" | "closed" | "unknown";

export interface PlaceDetails {
  lunchStatus: LunchStatus;
  priceMin: number | null;
  priceMax: number | null;
}

function googleHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY ?? "",
    "X-Goog-FieldMask": "places.id,places.location,places.regularOpeningHours.openNow,places.priceRange",
  };
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function findGooglePlace(name: string, lat: number, lng: number): Promise<GooglePlace | null> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: googleHeaders(),
    body: JSON.stringify({
      textQuery: name,
      languageCode: "ko",
      locationBias: {
        circle: { center: { latitude: lat, longitude: lng }, radius: 200 },
      },
    }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { places?: GooglePlace[] };
  return data.places?.[0] ?? null;
}

// Cache within a warm serverless instance so re-recommending, or multiple
// teammates hitting the same nearby restaurant, don't re-spend Places API
// quota moments apart. Short TTL since openNow is a live, not daily, fact.
const placeDetailsCache = new Map<string, { details: PlaceDetails; fetchedAt: number }>();

export async function checkPlaceDetails(
  id: string,
  name: string,
  lat: number,
  lng: number
): Promise<PlaceDetails> {
  const cached = placeDetailsCache.get(id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.details;

  let details: PlaceDetails = { lunchStatus: "unknown", priceMin: null, priceMax: null };
  try {
    const place = await findGooglePlace(name, lat, lng);
    if (place?.location) {
      const distance = haversineMeters(lat, lng, place.location.latitude, place.location.longitude);
      if (distance <= MATCH_DISTANCE_TOLERANCE_M) {
        const openNow = place.regularOpeningHours?.openNow;
        const lunchStatus: LunchStatus = openNow === undefined ? "unknown" : openNow ? "open" : "closed";

        const startUnits = place.priceRange?.startPrice?.units;
        const endUnits = place.priceRange?.endPrice?.units;
        const priceMin = startUnits !== undefined ? Number(startUnits) : null;
        const priceMax = endUnits !== undefined ? Number(endUnits) : null;

        details = { lunchStatus, priceMin, priceMax };
      }
    }
  } catch {
    details = { lunchStatus: "unknown", priceMin: null, priceMax: null };
  }

  placeDetailsCache.set(id, { details, fetchedAt: Date.now() });
  return details;
}
