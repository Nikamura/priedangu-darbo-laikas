import { isNull } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import { osmPlaces, shelterHosts, shelters } from "./db/schema.ts";
import { fetchOsmPlaces } from "./osm/fetch.ts";
import { matchHosts, type OsmPlace } from "./osm/match-hosts.ts";

/** Refreshes OSM places and re-links shelters to the institution in their building. */
export async function enrich(db: Db, opts: { fetch?: () => Promise<OsmPlace[]>; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const places = await (opts.fetch ?? fetchOsmPlaces)();
  if (places.length < 1000 && !opts.fetch) throw new Error(`Only ${places.length} OSM places; refusing to replace the cache`);

  const active = db
    .select({
      id: shelters.id,
      name: shelters.name,
      operator: shelters.operator,
      settlement: shelters.settlement,
      municipality: shelters.municipality,
      eldership: shelters.eldership,
      lat: shelters.lat,
      lng: shelters.lng,
    })
    .from(shelters)
    .where(isNull(shelters.removedAt))
    .all();
  const matches = matchHosts(active, places);

  db.transaction((tx) => {
    tx.delete(shelterHosts).run();
    tx.delete(osmPlaces).run();
    for (let i = 0; i < places.length; i += 500) {
      tx.insert(osmPlaces)
        .values(places.slice(i, i + 500).map((p) => ({ ...p, fetchedAt: now })))
        .onConflictDoNothing()
        .run();
    }
    for (const m of matches) tx.insert(shelterHosts).values({ ...m, matchedAt: now }).run();
  });
  return { places: places.length, matched: matches.length };
}
