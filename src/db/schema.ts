import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
/** Source flags are 1 / 0 / null. Null means "not reported", which is not the same as "no". */
const flag = (name: string) => integer(name, { mode: "boolean" });

export const shelters = sqliteTable(
  "shelters",
  {
    /** Our own stable id. The source object_id is renumbered on republish, so never key on it. */
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceObjectId: integer("source_object_id").notNull(),

    name: text("name"), // pavadinimas
    operator: text("operator"), // valdytojas
    notes: text("notes"), // pastabos

    county: text("county"), // apskritis
    municipality: text("municipality"), // savivaldybe
    eldership: text("eldership"), // seniunija
    settlement: text("settlement"), // gyvenviete
    street: text("street"), // gatve
    houseNumber: text("house_number"), // namo_numeris

    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    lksX: real("lks_x"), // x_koord_lks (EPSG:3346)
    lksY: real("lks_y"), // y_koord_lks

    capacity: integer("capacity"), // gyventoju_skaicius
    areaM2: real("area_m2"), // plotas

    /** Free-text opening hours exactly as published (darbo_valandos). */
    hoursRaw: text("hours_raw"),
    access24h: flag("access_24h"), // patekimas_visa_para
    signposted: flag("signposted"), // pazenklinta
    accessible: flag("accessible"), // pritaikyta_asmenims_su_negalia
    lighting: flag("lighting"), // patalpu_apsvietimas
    toilets: flag("toilets"), // patalpu_sanitariniai_mazgai
    ventilation: flag("ventilation"), // patalpu_ventiliacija
    alsoCollectiveProtection: flag("also_collective_protection"), // sutampa_su_kas

    sourceUpdatedAt: timestamp("source_updated_at"), // atnaujinimo_data
    sourcePublishedAt: timestamp("source_published_at"), // publikavimo_data

    /** Hash of the content fields; changes whenever the source record changes. */
    fingerprint: text("fingerprint").notNull(),
    /** The raw source attributes, kept so we can re-derive fields without refetching. */
    raw: text("raw", { mode: "json" }).$type<Record<string, unknown>>().notNull(),

    firstSeenAt: timestamp("first_seen_at").notNull(),
    lastSeenAt: timestamp("last_seen_at").notNull(),
    /** Set when a sync no longer finds the shelter; cleared if it reappears. */
    removedAt: timestamp("removed_at"),
  },
  (t) => [
    index("shelters_active_idx").on(t.removedAt),
    index("shelters_municipality_idx").on(t.municipality),
    index("shelters_latlng_idx").on(t.lat, t.lng),
  ],
);

export const syncRuns = sqliteTable("sync_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: timestamp("started_at").notNull(),
  finishedAt: timestamp("finished_at"),
  status: text("status", { enum: ["running", "ok", "failed"] }).notNull(),
  sourcePublishedAt: timestamp("source_published_at"),
  fetched: integer("fetched"),
  added: integer("added"),
  updated: integer("updated"),
  removed: integer("removed"),
  restored: integer("restored"),
  unchanged: integer("unchanged"),
  error: text("error"),
});

export type FieldDiff = Record<string, { from: unknown; to: unknown }>;

export const shelterChanges = sqliteTable(
  "shelter_changes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shelterId: integer("shelter_id")
      .notNull()
      .references(() => shelters.id),
    syncRunId: integer("sync_run_id")
      .notNull()
      .references(() => syncRuns.id),
    kind: text("kind", { enum: ["added", "updated", "removed", "restored"] }).notNull(),
    diff: text("diff", { mode: "json" }).$type<FieldDiff>(),
    at: timestamp("at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("shelter_changes_shelter_idx").on(t.shelterId)],
);

export type Shelter = typeof shelters.$inferSelect;
export type NewShelter = typeof shelters.$inferInsert;

/** OpenStreetMap places in Lithuania that publish opening hours (refreshed by `pnpm enrich`). */
export const osmPlaces = sqliteTable("osm_places", {
  osmId: text("osm_id").primaryKey(), // "node/123", "way/456"
  name: text("name").notNull(),
  category: text("category"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  openingHours: text("opening_hours").notNull(),
  fetchedAt: timestamp("fetched_at").notNull(),
});

/** The institution in a shelter's building, when a confident OSM match exists. */
export const shelterHosts = sqliteTable("shelter_hosts", {
  shelterId: integer("shelter_id")
    .primaryKey()
    .references(() => shelters.id),
  osmId: text("osm_id")
    .notNull()
    .references(() => osmPlaces.osmId),
  distanceM: integer("distance_m").notNull(),
  score: real("score").notNull(),
  matchedAt: timestamp("matched_at").notNull(),
});
