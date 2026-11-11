import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "../src/db/client.ts";
import { shelterChanges } from "../src/db/schema.ts";
import type { RawFeature } from "../src/source/arcgis.ts";
import { activeShelters, sync } from "../src/sync/run.ts";

function feature(objectId: number, overrides: Record<string, unknown> = {}, pos = { lat: 54.68, lng: 25.27 }): RawFeature {
  return {
    lat: pos.lat,
    lng: pos.lng,
    attributes: {
      object_id: objectId,
      pavadinimas: `Mokykla ${objectId}`,
      savivaldybe: "Vilniaus m. sav.",
      gyvenviete: "Vilnius",
      gatve: "Gedimino pr.",
      namo_numeris: String(objectId),
      darbo_valandos: "8.00-17.00",
      patekimas_visa_para: 0,
      publikavimo_data: 1_794_321_963_000,
      ...overrides,
    },
  };
}

const source = (features: RawFeature[]) => async () => ({ features, unknownFields: [], missingFields: [] });

function at(i: number, base = { lat: 54.68, lng: 25.27 }) {
  return { lat: base.lat + i * 0.01, lng: base.lng };
}

test("keeps stable ids when the source renumbers object_id", async () => {
  const db = openDb(":memory:");
  await sync(db, { fetch: source([1, 2, 3].map((n) => feature(n, {}, at(n)))) });
  const before = new Map(activeShelters(db).map((s) => [s.name, s.id]));

  // Same shelters, republished in a different order with new object ids.
  const renumbered = [3, 1, 2].map((n, i) => feature(n, { object_id: 100 + i }, at(n)));
  const s = await sync(db, { fetch: source(renumbered) });

  assert.deepEqual([s.added, s.updated, s.removed, s.unchanged], [0, 0, 0, 3]);
  for (const row of activeShelters(db)) assert.equal(row.id, before.get(row.name));
});

test("records attribute edits as updates with a field diff", async () => {
  const db = openDb(":memory:");
  await sync(db, { fetch: source([feature(1)]) });
  const s = await sync(db, {
    fetch: source([feature(9, { pavadinimas: "Mokykla 1", namo_numeris: "1", darbo_valandos: "24", patekimas_visa_para: 1 })]),
  });

  assert.equal(s.updated, 1);
  const [change] = db.select().from(shelterChanges).all().filter((c) => c.kind === "updated");
  assert.deepEqual(change?.diff, {
    hoursRaw: { from: "8.00-17.00", to: "24" },
    access24h: { from: false, to: true },
  });
});

test("matches a renamed shelter at the same address", async () => {
  const db = openDb(":memory:");
  await sync(db, { fetch: source([feature(1)]) });
  const id = activeShelters(db)[0]?.id;
  const s = await sync(db, { fetch: source([feature(7, { pavadinimas: "Gimnazija", namo_numeris: "1" })]) });
  assert.equal(s.updated, 1);
  assert.equal(activeShelters(db)[0]?.id, id);
});

test("marks missing shelters removed and restores them when they come back", async () => {
  const db = openDb(":memory:");
  const all = Array.from({ length: 10 }, (_, i) => feature(i + 1, {}, at(i)));
  await sync(db, { fetch: source(all) });

  let s = await sync(db, { fetch: source(all.slice(0, 9)) });
  assert.equal(s.removed, 1);
  assert.equal(activeShelters(db).length, 9);

  s = await sync(db, { fetch: source(all) });
  assert.equal(s.restored, 1);
  assert.equal(s.added, 0);
  assert.equal(activeShelters(db).length, 10);
});

test("refuses to apply a suspiciously small download", async () => {
  const db = openDb(":memory:");
  const all = Array.from({ length: 10 }, (_, i) => feature(i + 1, {}, at(i)));
  await sync(db, { fetch: source(all) });
  await assert.rejects(sync(db, { fetch: source(all.slice(0, 5)) }), /safety threshold/);
  assert.equal(activeShelters(db).length, 10);
});

test("treats placeholder dashes as missing values", async () => {
  const db = openDb(":memory:");
  await sync(db, { fetch: source([feature(1, { darbo_valandos: " – ", patekimas_visa_para: null })]) });
  const [row] = activeShelters(db);
  assert.equal(row?.hoursRaw, null);
  assert.equal(row?.access24h, null);
});
