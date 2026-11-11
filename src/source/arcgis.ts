import { SOURCE } from "../config.ts";

export type RawAttributes = Record<string, unknown>;

export interface RawFeature {
  attributes: RawAttributes;
  /** WGS84 longitude/latitude. */
  lng: number;
  lat: number;
}

/** Fields we know how to map. Anything else in the source is reported as schema drift. */
export const EXPECTED_FIELDS = [
  "object_id",
  "pavadinimas",
  "valdytojas",
  "pastabos",
  "apskritis",
  "savivaldybe",
  "seniunija",
  "gyvenviete",
  "gatve",
  "namo_numeris",
  "x_koord_lks",
  "y_koord_lks",
  "gyventoju_skaicius",
  "plotas",
  "darbo_valandos",
  "patekimas_visa_para",
  "pazenklinta",
  "pritaikyta_asmenims_su_negalia",
  "patalpu_apsvietimas",
  "patalpu_sanitariniai_mazgai",
  "patalpu_ventiliacija",
  "sutampa_su_kas",
  "atnaujinimo_data",
  "publikavimo_data",
] as const;

interface QueryResponse {
  error?: { code: number; message: string };
  features?: { attributes: RawAttributes; geometry?: { x: number; y: number } | null }[];
  exceededTransferLimit?: boolean;
  count?: number;
  fields?: { name: string }[];
}

async function query(params: Record<string, string>, fetchImpl: typeof fetch): Promise<QueryResponse> {
  const url = new URL(`${SOURCE.layerUrl}/query`);
  for (const [k, v] of Object.entries({ f: "json", ...params })) url.searchParams.set(k, v);

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const body = (await res.json()) as QueryResponse;
      // ArcGIS reports errors with HTTP 200 and an `error` object.
      if (body.error) throw new Error(`ArcGIS error ${body.error.code}: ${body.error.message}`);
      return body;
    } catch (err) {
      lastError = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error(`Query failed after 3 attempts: ${String(lastError)}`);
}

export interface FetchResult {
  features: RawFeature[];
  unknownFields: string[];
  missingFields: string[];
}

/** Downloads every shelter from the source layer, page by page. */
export async function fetchAllShelters(fetchImpl: typeof fetch = fetch): Promise<FetchResult> {
  const { count } = await query({ where: "1=1", returnCountOnly: "true" }, fetchImpl);
  if (typeof count !== "number") throw new Error("Source did not return a record count");

  const features: RawFeature[] = [];
  let fieldNames: string[] = [];

  for (let offset = 0; ; offset += SOURCE.pageSize) {
    const page = await query(
      {
        where: "1=1",
        outFields: "*",
        outSR: "4326",
        orderByFields: "object_id",
        resultOffset: String(offset),
        resultRecordCount: String(SOURCE.pageSize),
      },
      fetchImpl,
    );
    if (page.fields) fieldNames = page.fields.map((f) => f.name);
    for (const f of page.features ?? []) {
      if (!f.geometry || !Number.isFinite(f.geometry.x) || !Number.isFinite(f.geometry.y)) continue;
      features.push({ attributes: f.attributes, lng: f.geometry.x, lat: f.geometry.y });
    }
    const got = page.features?.length ?? 0;
    if (got === 0 || (!page.exceededTransferLimit && got < SOURCE.pageSize)) break;
  }

  if (features.length !== count) {
    throw new Error(`Expected ${count} shelters but received ${features.length}; refusing a partial download`);
  }

  const expected = new Set<string>(EXPECTED_FIELDS);
  return {
    features,
    unknownFields: fieldNames.filter((n) => !expected.has(n)),
    missingFields: EXPECTED_FIELDS.filter((n) => !fieldNames.includes(n)),
  };
}
