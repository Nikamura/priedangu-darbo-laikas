import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { desc, eq } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import { encodeWeek, type WebHours } from "../web/src/schedule.ts";
import { osmPlaces, shelterHosts, syncRuns } from "./db/schema.ts";
import { parseHours } from "./hours.ts";
import { classify } from "./kind.ts";
import { parseOsmHours } from "./osm/opening-hours.ts";
import { activeShelters } from "./sync/run.ts";

/**
 * Compact dataset for the website. Rows are positional arrays to keep the
 * download small on an overloaded mobile network during an alert.
 *
 * Row: [id, lat, lng, name, address, settlement, municipality, capacity, kind,
 *       access24h (1/0/null), accessible (1/0/null), hoursRaw, hours, host]
 * hours: see WebHours in web/src/schedule.ts
 * host:  null | [name, openingHoursRaw, hours, osmId] — the institution in the building (OpenStreetMap)
 */

const flag = (v: boolean | null) => (v == null ? null : v ? 1 : 0);
const round = (v: number) => Math.round(v * 1e6) / 1e6;

export function exportWebData(db: Db, path: string): number {
  const hosts = new Map(
    db
      .select({ shelterId: shelterHosts.shelterId, name: osmPlaces.name, hours: osmPlaces.openingHours, osmId: osmPlaces.osmId })
      .from(shelterHosts)
      .innerJoin(osmPlaces, eq(osmPlaces.osmId, shelterHosts.osmId))
      .all()
      .map((h) => [h.shelterId, h]),
  );

  const rows = activeShelters(db).map((s) => {
    const parsed = parseHours(s.hoursRaw);
    const hours: WebHours =
      parsed.kind === "always"
        ? "A"
        : parsed.kind === "closed"
          ? "C"
          : parsed.kind === "schedule"
            ? [parsed.daysSpecified ? 1 : 0, ...encodeWeek(parsed.week)]
            : null;
    const host = hosts.get(s.id);
    const hostParsed = host ? parseOsmHours(host.hours) : null;
    const hostHours: WebHours = !hostParsed ? null : hostParsed.kind === "always" ? "A" : [1, ...encodeWeek(hostParsed.week)];
    return [
      s.id,
      round(s.lat),
      round(s.lng),
      s.name,
      [s.street, s.houseNumber].filter(Boolean).join(" ") || null,
      s.settlement,
      s.municipality,
      s.capacity,
      classify(s.name, s.operator),
      flag(s.access24h),
      flag(s.accessible),
      s.hoursRaw,
      hours,
      host ? [host.name, host.hours, hostHours, host.osmId] : null,
    ];
  });

  const [lastRun] = db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.status, "ok"))
    .orderBy(desc(syncRuns.id))
    .limit(1)
    .all();

  const payload = {
    v: 1,
    generatedAt: new Date().toISOString(),
    syncedAt: lastRun?.finishedAt?.toISOString() ?? null,
    sourcePublishedAt: lastRun?.sourcePublishedAt?.toISOString() ?? null,
    rows,
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, JSON.stringify(payload));
  renameSync(`${path}.tmp`, path);
  return rows.length;
}
