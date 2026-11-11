import { addressKey, type ShelterRecord } from "../source/normalize.ts";

export interface ExistingShelter {
  id: number;
  fingerprint: string;
  name: string | null;
  municipality: string | null;
  settlement: string | null;
  street: string | null;
  houseNumber: string | null;
  lat: number;
  lng: number;
  active: boolean;
}

export interface MatchResult {
  matched: { existing: ExistingShelter; incoming: ShelterRecord }[];
  added: ShelterRecord[];
  /** Existing shelters (active or not) that no incoming record matched. */
  unmatched: ExistingShelter[];
}

/** Meters between two WGS84 points (equirectangular; plenty accurate at these distances). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

const normName = (s: string | null) => (s ?? "").toLocaleLowerCase("lt").replace(/[^\p{L}\p{N}]+/gu, "");

/** Same address and near each other: an edit to an existing shelter. */
const SAME_ADDRESS_MAX_M = 100;
/** Same name and very close: the address text was corrected. */
const SAME_NAME_MAX_M = 30;

/**
 * Pairs incoming source records with shelters we already know.
 *
 * The source renumbers object_id on republish, so identity is inferred in tiers:
 *  1. identical content (fingerprint)
 *  2. same address and within SAME_ADDRESS_MAX_M
 *  3. same name and within SAME_NAME_MAX_M
 * Each tier pairs one-to-one, preferring active shelters and then the nearest one.
 */
export function matchShelters(existing: ExistingShelter[], incoming: ShelterRecord[]): MatchResult {
  const free = new Set(existing);
  const matched: MatchResult["matched"] = [];
  let pending = incoming;

  const tier = (
    keyOf: (r: { fingerprint: string } & Parameters<typeof addressKey>[0] & { name: string | null }) => string,
    maxM: number,
  ) => {
    const buckets = new Map<string, ExistingShelter[]>();
    for (const e of free) {
      const k = keyOf(e);
      const list = buckets.get(k);
      if (list) list.push(e);
      else buckets.set(k, [e]);
    }
    const rest: ShelterRecord[] = [];
    for (const r of pending) {
      let best: ExistingShelter | undefined;
      let bestScore = Infinity;
      for (const e of buckets.get(keyOf(r)) ?? []) {
        if (!free.has(e)) continue;
        const d = distanceM(e, r);
        if (d > maxM) continue;
        const score = d + (e.active ? 0 : 1e6);
        if (score < bestScore) {
          best = e;
          bestScore = score;
        }
      }
      if (best) {
        free.delete(best);
        matched.push({ existing: best, incoming: r });
      } else rest.push(r);
    }
    pending = rest;
  };

  tier((r) => r.fingerprint, Infinity);
  tier((r) => addressKey(r), SAME_ADDRESS_MAX_M);
  tier((r) => normName(r.name), SAME_NAME_MAX_M);

  return { matched, added: pending, unmatched: [...free] };
}
