import type { OsmPlace } from "./match-hosts.ts";

/** Everything in Lithuania that has opening hours. ~10k elements, ~6 MB. */
const QUERY = `[out:json][timeout:170];
area["ISO3166-1"="LT"][admin_level=2]->.lt;
nwr["opening_hours"]["name"](area.lt);
out center tags;`;

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

interface Element {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function fetchOsmPlaces(): Promise<OsmPlace[]> {
  let lastError: unknown;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "lt-shelter-finder/0.1" },
        body: new URLSearchParams({ data: QUERY }),
        signal: AbortSignal.timeout(200_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { elements?: Element[] };
      if (!body.elements?.length) throw new Error("Overpass returned no elements");
      return body.elements.flatMap((e) => {
        const lat = e.lat ?? e.center?.lat;
        const lng = e.lon ?? e.center?.lon;
        const t = e.tags ?? {};
        if (lat == null || lng == null || !t.name || !t.opening_hours) return [];
        const category = t.amenity ?? t.shop ?? t.office ?? t.tourism ?? t.leisure ?? t.healthcare ?? null;
        return [{ osmId: `${e.type}/${e.id}`, name: t.name, lat, lng, openingHours: t.opening_hours, category }];
      });
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Could not fetch OpenStreetMap data: ${String(lastError)}`);
}
