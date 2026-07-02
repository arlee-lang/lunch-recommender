import { PriceTier } from "./types";

const LUNCH_START_MINUTES = 11 * 60;
const LUNCH_END_MINUTES = 14 * 60;
const MATCH_DISTANCE_TOLERANCE_M = 300;

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

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

interface GoogleOpeningHoursPeriod {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

interface GooglePriceRange {
  startPrice?: { units?: string };
  endPrice?: { units?: string };
}

interface GooglePlace {
  id: string;
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { periods?: GoogleOpeningHoursPeriod[] };
  priceRange?: GooglePriceRange;
}

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
    "X-Goog-FieldMask": "places.id,places.location,places.regularOpeningHours,places.priceRange",
  };
}

function getSeoulDayOfWeek(): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date());
  return WEEKDAY_INDEX[weekday] ?? new Date().getDay();
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

function periodOverlapsLunch(periods: GoogleOpeningHoursPeriod[], today: number): boolean {
  for (const period of periods) {
    if (period.open.day !== today) continue;
    if (!period.close) return true; // no close time = open all day

    const openMinutes = period.open.hour * 60 + period.open.minute;
    let closeMinutes = period.close.hour * 60 + period.close.minute;
    if (period.close.day !== period.open.day) closeMinutes += 24 * 60; // overnight span

    if (openMinutes < LUNCH_END_MINUTES && closeMinutes > LUNCH_START_MINUTES) return true;
  }
  return false;
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
// quota on the same place on the same day.
const placeDetailsCache = new Map<string, { details: PlaceDetails; day: number }>();

export async function checkPlaceDetails(
  id: string,
  name: string,
  lat: number,
  lng: number
): Promise<PlaceDetails> {
  const today = getSeoulDayOfWeek();
  const cached = placeDetailsCache.get(id);
  if (cached && cached.day === today) return cached.details;

  let details: PlaceDetails = { lunchStatus: "unknown", priceMin: null, priceMax: null };
  try {
    const place = await findGooglePlace(name, lat, lng);
    if (place?.location) {
      const distance = haversineMeters(lat, lng, place.location.latitude, place.location.longitude);
      if (distance <= MATCH_DISTANCE_TOLERANCE_M) {
        const periods = place.regularOpeningHours?.periods;
        const lunchStatus: LunchStatus = periods?.length
          ? periodOverlapsLunch(periods, today)
            ? "open"
            : "closed"
          : "unknown";

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

  placeDetailsCache.set(id, { details, day: today });
  return details;
}
