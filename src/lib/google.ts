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

interface GoogleOpeningHoursPeriod {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

interface GooglePlace {
  id: string;
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { periods?: GoogleOpeningHoursPeriod[] };
}

export type LunchStatus = "open" | "closed" | "unknown";

function googleHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY ?? "",
    "X-Goog-FieldMask": "places.id,places.location,places.regularOpeningHours",
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
const lunchStatusCache = new Map<string, { status: LunchStatus; day: number }>();

export async function checkLunchHours(
  id: string,
  name: string,
  lat: number,
  lng: number
): Promise<LunchStatus> {
  const today = getSeoulDayOfWeek();
  const cached = lunchStatusCache.get(id);
  if (cached && cached.day === today) return cached.status;

  let status: LunchStatus = "unknown";
  try {
    const place = await findGooglePlace(name, lat, lng);
    const periods = place?.regularOpeningHours?.periods;
    if (place?.location && periods?.length) {
      const distance = haversineMeters(lat, lng, place.location.latitude, place.location.longitude);
      if (distance <= MATCH_DISTANCE_TOLERANCE_M) {
        status = periodOverlapsLunch(periods, today) ? "open" : "closed";
      }
    }
  } catch {
    status = "unknown";
  }

  lunchStatusCache.set(id, { status, day: today });
  return status;
}
