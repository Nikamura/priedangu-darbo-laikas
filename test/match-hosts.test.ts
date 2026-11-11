import assert from "node:assert/strict";
import { test } from "node:test";
import { matchHosts, type OsmPlace, type ShelterForMatch, stems } from "../src/osm/match-hosts.ts";

const shelter = (id: number, name: string, extra: Partial<ShelterForMatch> = {}): ShelterForMatch => ({
  id, name, operator: null, settlement: "Kaunas", municipality: "Kauno m. sav.", eldership: "Centro", lat: 54.9, lng: 23.9, ...extra,
});
const place = (osmId: string, name: string, category: string, dLat = 0.0002): OsmPlace => ({
  osmId, name, category, lat: 54.9 + dLat, lng: 23.9, openingHours: "Mo-Fr 08:00-17:00",
});
// Background names so that common words ("rūsys", "muziejus", "Kauno") look common.
const filler = Array.from({ length: 400 }, (_, i) =>
  shelter(1000 + i, ["Kauno daugiabučio namo rūsys", "Pastato rūsys", "Kauno muziejus", "Administracinis pastatas"][i % 4]!, { lat: 50, lng: 20 }),
);

test("Lithuanian case endings match, villages don't collide with words", () => {
  assert.deepEqual(stems("Zarasų"), stems("Zarasai"));
  assert.deepEqual(stems("muziejaus"), stems("muziejus"));
  assert.notDeepEqual(stems("lėlių"), stems("Lėliūnai"));
});

test("matches the institution named in the shelter", () => {
  const m = matchHosts([shelter(1, "Kauno miesto poliklinikos Šančių padalinys pastato rūsys"), ...filler], [
    place("node/1", "Kauno miesto poliklinikos Šančių padalinys", "clinic"),
  ]);
  assert.deepEqual(m.map((x) => x.osmId), ["node/1"]);
});

test("town names alone never match", () => {
  const m = matchHosts([shelter(1, "Daugiabutis namas", { operator: "Zarasų rajono savivaldybė", settlement: "Zarasai", municipality: "Zarasų r. sav." }), ...filler], [
    place("node/1", "IKI Zarasai", "supermarket"),
  ]);
  assert.equal(m.length, 0);
});

test("a single shared word needs a matching kind of place", () => {
  const shelters = [shelter(1, "Vingio g. požeminė perėja"), shelter(2, "Prekybos centras „Luizė“", { lat: 54.95 }), ...filler];
  const m = matchHosts(shelters, [place("node/1", "IKI Vingis", "supermarket"), place("node/2", "Luizė", "mall", 0.0502)]);
  assert.deepEqual(m.map((x) => [x.shelterId, x.osmId]), [[2, "node/2"]]);
});

test("too far away is never a match", () => {
  const m = matchHosts([shelter(1, "Kauno Tado Ivanausko zoologijos muziejus"), ...filler], [
    place("node/1", "Kauno Tado Ivanausko zoologijos muziejus", "museum", 0.002),
  ]);
  assert.equal(m.length, 0);
});
