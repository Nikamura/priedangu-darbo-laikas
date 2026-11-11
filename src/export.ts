import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Db } from "./db/client.ts";
import type { Shelter } from "./db/schema.ts";
import { activeShelters } from "./sync/run.ts";

/** Public, app-facing shape. Keeps our stable `id`, drops bookkeeping and raw source data. */
export function toFeature(s: Shelter) {
  return {
    type: "Feature" as const,
    id: s.id,
    geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
    properties: {
      id: s.id,
      name: s.name,
      operator: s.operator,
      address: [s.street, s.houseNumber].filter(Boolean).join(" ") || null,
      settlement: s.settlement,
      municipality: s.municipality,
      capacity: s.capacity,
      areaM2: s.areaM2,
      hoursRaw: s.hoursRaw,
      access24h: s.access24h,
      accessible: s.accessible,
      signposted: s.signposted,
      lighting: s.lighting,
      toilets: s.toilets,
      ventilation: s.ventilation,
      notes: s.notes,
      sourceUpdatedAt: s.sourceUpdatedAt?.toISOString() ?? null,
    },
  };
}

export function exportGeoJson(db: Db, path: string): number {
  const rows = activeShelters(db);
  const fc = { type: "FeatureCollection", generatedAt: new Date().toISOString(), features: rows.map(toFeature) };
  mkdirSync(dirname(path), { recursive: true });
  // Write then rename so readers never see a half-written file.
  writeFileSync(`${path}.tmp`, JSON.stringify(fc));
  renameSync(`${path}.tmp`, path);
  return rows.length;
}
