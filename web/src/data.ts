/// <reference types="vite/client" />
export type Kind = "underground" | "parking" | "apartment" | "education" | "health" | "shopping" | "public" | "other";

import type { WebHours } from "./schedule.ts";

/** See src/export-web.ts for the encoding. */
type HostRow = [name: string, hoursRaw: string, hours: WebHours, osmId: string];
type Row = [
  number, number, number, string | null, string | null, string | null, string | null,
  number | null, Kind, 0 | 1 | null, 0 | 1 | null, string | null, WebHours, HostRow | null,
];

/** The institution in the shelter's building, matched from OpenStreetMap. */
export interface Host {
  name: string;
  hoursRaw: string;
  hours: WebHours;
  osmId: string;
}

export interface Shelter {
  id: number;
  lat: number;
  lng: number;
  name: string | null;
  address: string | null;
  settlement: string | null;
  municipality: string | null;
  capacity: number | null;
  kind: Kind;
  access24h: boolean | null;
  accessible: boolean | null;
  hoursRaw: string | null;
  hours: WebHours;
  host: Host | null;
  /** Lower-cased, diacritic-free text for search. */
  haystack: string;
}

export interface Dataset {
  shelters: Shelter[];
  sourcePublishedAt: Date | null;
}

export function fold(s: string): string {
  return s.toLocaleLowerCase("lt").normalize("NFD").replace(/\p{M}/gu, "");
}

const bool = (v: 0 | 1 | null) => (v == null ? null : v === 1);

export async function loadData(): Promise<Dataset> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/shelters.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { rows: Row[]; sourcePublishedAt: string | null };
  const shelters = json.rows.map((r): Shelter => ({
    id: r[0],
    lat: r[1],
    lng: r[2],
    name: r[3],
    address: r[4],
    settlement: r[5],
    municipality: r[6],
    capacity: r[7],
    kind: r[8],
    access24h: bool(r[9]),
    accessible: bool(r[10]),
    hoursRaw: r[11],
    hours: r[12],
    host: r[13] ? { name: r[13][0], hoursRaw: r[13][1], hours: r[13][2], osmId: r[13][3] } : null,
    haystack: fold([r[3], r[4], r[5], r[6]].filter(Boolean).join(" ")),
  }));
  return { shelters, sourcePublishedAt: json.sourcePublishedAt ? new Date(json.sourcePublishedAt) : null };
}
