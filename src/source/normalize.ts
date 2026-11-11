import { createHash } from "node:crypto";
import type { RawFeature } from "./arcgis.ts";

/** A source record mapped onto our columns, before it has an id or sync bookkeeping. */
export interface ShelterRecord {
  sourceObjectId: number;
  name: string | null;
  operator: string | null;
  notes: string | null;
  county: string | null;
  municipality: string | null;
  eldership: string | null;
  settlement: string | null;
  street: string | null;
  houseNumber: string | null;
  lat: number;
  lng: number;
  lksX: number | null;
  lksY: number | null;
  capacity: number | null;
  areaM2: number | null;
  hoursRaw: string | null;
  access24h: boolean | null;
  signposted: boolean | null;
  accessible: boolean | null;
  lighting: boolean | null;
  toilets: boolean | null;
  ventilation: boolean | null;
  alsoCollectiveProtection: boolean | null;
  sourceUpdatedAt: Date | null;
  sourcePublishedAt: Date | null;
  raw: Record<string, unknown>;
  fingerprint: string;
}

/** Fields that describe the shelter. Changes to these are tracked in the history. */
export const CONTENT_FIELDS = [
  "name",
  "operator",
  "notes",
  "county",
  "municipality",
  "eldership",
  "settlement",
  "street",
  "houseNumber",
  "lat",
  "lng",
  "capacity",
  "areaM2",
  "hoursRaw",
  "access24h",
  "signposted",
  "accessible",
  "lighting",
  "toilets",
  "ventilation",
  "alsoCollectiveProtection",
  "sourceUpdatedAt",
] as const satisfies readonly (keyof ShelterRecord)[];

export type ContentField = (typeof CONTENT_FIELDS)[number];

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return v == null ? null : String(v);
  const s = v.replace(/\s+/g, " ").trim();
  // The source uses placeholder dashes for "no value".
  return s === "" || /^[-–—]+$/.test(s) ? null : s;
};
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const int = (v: unknown): number | null => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};
const flag = (v: unknown): boolean | null => (v === 1 ? true : v === 0 ? false : null);
const date = (v: unknown): Date | null => (typeof v === "number" ? new Date(v) : null);
/** About 1 cm at Lithuanian latitudes; avoids spurious diffs from float noise. */
const coord = (v: number) => Math.round(v * 1e7) / 1e7;

export function normalize(f: RawFeature): ShelterRecord {
  const a = f.attributes;
  const objectId = int(a.object_id);
  if (objectId == null) throw new Error(`Feature without object_id: ${JSON.stringify(a)}`);

  const record: Omit<ShelterRecord, "fingerprint"> = {
    sourceObjectId: objectId,
    name: str(a.pavadinimas),
    operator: str(a.valdytojas),
    notes: str(a.pastabos),
    county: str(a.apskritis),
    municipality: str(a.savivaldybe),
    eldership: str(a.seniunija),
    settlement: str(a.gyvenviete),
    street: str(a.gatve),
    houseNumber: str(a.namo_numeris),
    lat: coord(f.lat),
    lng: coord(f.lng),
    lksX: num(a.x_koord_lks),
    lksY: num(a.y_koord_lks),
    capacity: int(a.gyventoju_skaicius),
    areaM2: num(a.plotas),
    hoursRaw: str(a.darbo_valandos),
    access24h: flag(a.patekimas_visa_para),
    signposted: flag(a.pazenklinta),
    accessible: flag(a.pritaikyta_asmenims_su_negalia),
    lighting: flag(a.patalpu_apsvietimas),
    toilets: flag(a.patalpu_sanitariniai_mazgai),
    ventilation: flag(a.patalpu_ventiliacija),
    alsoCollectiveProtection: flag(a.sutampa_su_kas),
    sourceUpdatedAt: date(a.atnaujinimo_data),
    sourcePublishedAt: date(a.publikavimo_data),
    raw: a,
  };
  return { ...record, fingerprint: fingerprint(record) };
}

export function comparable(v: unknown): unknown {
  return v instanceof Date ? v.getTime() : v ?? null;
}

export function fingerprint(r: Pick<ShelterRecord, ContentField>): string {
  const h = createHash("sha256");
  h.update(JSON.stringify(CONTENT_FIELDS.map((k) => comparable(r[k]))));
  return h.digest("hex").slice(0, 32);
}

/** Address identity: same building, regardless of other attribute changes. */
export function addressKey(r: Pick<ShelterRecord, "municipality" | "settlement" | "street" | "houseNumber">): string {
  const n = (s: string | null) => (s ?? "").toLocaleLowerCase("lt").replace(/[^\p{L}\p{N}]+/gu, "");
  return [r.municipality, r.settlement, r.street, r.houseNumber].map(n).join("|");
}
