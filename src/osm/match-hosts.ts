import { classify, type Kind } from "../kind.ts";

/**
 * Links a shelter to the institution in its building, using OpenStreetMap places
 * that publish opening hours. Strict on purpose: a wrong match would show the
 * wrong hours, so a match needs both proximity and a distinctive shared name.
 */

export interface OsmPlace {
  osmId: string;
  name: string;
  lat: number;
  lng: number;
  openingHours: string;
  category: string | null;
}

export interface ShelterForMatch {
  id: number;
  name: string | null;
  operator: string | null;
  settlement: string | null;
  municipality: string | null;
  eldership: string | null;
  lat: number;
  lng: number;
}

export interface HostMatch {
  shelterId: number;
  osmId: string;
  distanceM: number;
  score: number;
}

/** Places that can't host a shelter's institution even if they publish hours. */
const IGNORED_CATEGORIES = new Set([
  "atm", "parcel_locker", "vending_machine", "charging_station", "bicycle_parking", "recycling", "toilets",
  "parking", "parking_entrance", "fuel", "car_wash", "bicycle_rental", "drinking_water", "post_box",
  "waste_disposal", "compressed_air", "kick-scooter_rental", "payment_terminal", "shelter", "bench",
]);

/** What kind of shelter an OSM place category could plausibly host. */
const CATEGORY_KIND: Record<string, Kind> = {
  kindergarten: "education", school: "education", college: "education", university: "education",
  clinic: "health", doctors: "health", hospital: "health", health_post: "health", dentist: "health", social_facility: "health",
  mall: "shopping", department_store: "shopping", supermarket: "shopping",
  townhall: "public", government: "public", library: "public", museum: "public", theatre: "public", arts_centre: "public",
  community_centre: "public", sports_centre: "public", information: "public", bus_station: "public", fire_station: "public",
  police: "public", courthouse: "public", place_of_worship: "public",
};

const MAX_DISTANCE_M = 100;
const MIN_SCORE = 0.6;

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.hypot(x, y) * 6_371_000;
}

/** Lithuanian case endings (without diacritics), longest first. */
const ENDINGS = [
  "iuose", "uose", "ioje", "iose", "iams", "iems", "iaus", "ijos", "ijai", "iai", "ius", "iui", "ais", "ams", "ems",
  "oms", "ose", "aus", "ies", "ios", "ojo", "oji", "ijo", "io", "iu", "ai", "as", "es", "is", "us", "os", "ui", "ys",
  "a", "e", "i", "o", "u", "s",
].sort((a, b) => b.length - a.length);

function root(word: string): string {
  for (const end of ENDINGS) if (word.endsWith(end) && word.length - end.length >= 4) return word.slice(0, -end.length);
  return word;
}

/**
 * Word roots: lower-case, no diacritics, case ending removed, so "Zarasų" and
 * "Zarasai" both become "zaras" while "lėlių" and "Lėliūnai" stay apart.
 */
export function stems(s: string | null): string[] {
  if (!s) return [];
  return s
    .toLocaleLowerCase("lt")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((w) => w.length >= 3)
    .map(root);
}

export function matchHosts(shelters: ShelterForMatch[], places: OsmPlace[]): HostMatch[] {
  const usable = places.filter((p) => p.name && !IGNORED_CATEGORIES.has(p.category ?? ""));

  // How common each stem is across all names: "kauno", "pasta(tas)", "rusys" carry no identity.
  const df = new Map<string, number>();
  const docs = [...shelters.map((s) => s.name), ...usable.map((p) => p.name)];
  for (const name of docs) for (const w of new Set(stems(name))) df.set(w, (df.get(w) ?? 0) + 1);
  const n = docs.length;
  const idf = (w: string) => Math.log(n / (df.get(w) ?? 1));
  const GENERIC = Math.log(n / Math.max(25, n * 0.004));
  // Town, municipality and eldership names say where a place is, not what it is
  // ("IKI Zarasai" must not match a block of flats in Zarasai).
  const placeNames = new Set<string>();
  for (const s of shelters) for (const w of [...stems(s.settlement), ...stems(s.municipality), ...stems(s.eldership)]) placeNames.add(w);
  const identifying = (w: string) => idf(w) >= GENERIC && !placeNames.has(w);

  // Grid index: ~0.01° cells.
  const cell = (lat: number, lng: number) => `${Math.floor(lat * 100)}:${Math.floor(lng * 60)}`;
  const grid = new Map<string, OsmPlace[]>();
  for (const p of usable) {
    const k = cell(p.lat, p.lng);
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(p);
  }
  const nearby = (s: ShelterForMatch) => {
    const out: OsmPlace[] = [];
    const la = Math.floor(s.lat * 100);
    const lo = Math.floor(s.lng * 60);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(grid.get(`${la + i}:${lo + j}`) ?? []));
    return out;
  };

  const matches: HostMatch[] = [];
  for (const s of shelters) {
    const shelterStems = new Set([...stems(s.name), ...stems(s.operator)]);
    const kind = classify(s.name, s.operator);
    let best: HostMatch | null = null;
    for (const p of nearby(s)) {
      const d = distanceM(s, p);
      if (d > MAX_DISTANCE_M) continue;
      const placeStems = [...new Set(stems(p.name))].filter(identifying);
      if (!placeStems.length) continue;
      const total = placeStems.reduce((a, w) => a + idf(w), 0);
      const shared = placeStems.filter((w) => shelterStems.has(w));
      if (!shared.length) continue;
      // Most of the place's distinctive name must appear in the shelter's name or operator.
      const score = shared.reduce((a, w) => a + idf(w), 0) / total;
      if (score < MIN_SCORE) continue;
      // One shared word is weak evidence ("IKI Vingis" vs "Vingio g. perėja"):
      // then the place must also be the kind of place this shelter is.
      if (shared.length === 1 && CATEGORY_KIND[p.category ?? ""] !== kind) continue;
      if (!best || score > best.score || (score === best.score && d < best.distanceM)) {
        best = { shelterId: s.id, osmId: p.osmId, distanceM: Math.round(d), score: Math.round(score * 100) / 100 };
      }
    }
    if (best) matches.push(best);
  }
  return matches;
}
