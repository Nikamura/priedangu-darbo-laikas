import assert from "node:assert/strict";
import { test } from "node:test";
import type { Shelter } from "../web/src/data.ts";
import { shelterStatus, vilniusNow } from "../web/src/status.ts";

const base: Shelter = {
  id: 1, lat: 54.68, lng: 25.28, name: "X", address: null, settlement: null, municipality: null,
  capacity: null, kind: "other", access24h: null, accessible: null, hoursRaw: null, hours: null, host: null, haystack: "",
};
const s = (o: Partial<Shelter>): Shelter => ({ ...base, ...o });
const M = (h: number, m = 0) => h * 60 + m;
const weekdays: Shelter["hours"] = [1, [M(8), M(17)], [M(8), M(17)], [M(8), M(17)], [M(8), M(17)], [M(8), M(15, 45)], [], []];

test("vilniusNow uses Lithuanian time, not the device time zone", () => {
  // 2026-11-11 is a Wednesday. 23:30 UTC is 01:30 Thursday in Vilnius (UTC+2 in winter).
  assert.deepEqual(vilniusNow(new Date("2026-11-11T23:30:00Z")), { day: 3, minutes: M(1, 30) });
  // Summer time (UTC+3).
  assert.deepEqual(vilniusNow(new Date("2026-07-01T21:15:00Z")), { day: 3, minutes: M(0, 15) });
});

test("official 24/7 flag wins", () => {
  assert.equal(shelterStatus(s({ access24h: true, hours: weekdays }), { day: 6, minutes: M(3) }).key, "always");
});

test("open and closed by weekday schedule", () => {
  const sh = s({ hours: weekdays });
  assert.deepEqual(shelterStatus(sh, { day: 2, minutes: M(10) }), { tone: "open", key: "openUntil", time: M(17) });
  assert.deepEqual(shelterStatus(sh, { day: 2, minutes: M(17) }), { tone: "closed", key: "closedOpensTomorrow", time: M(8) });
  assert.deepEqual(shelterStatus(sh, { day: 2, minutes: M(6) }), { tone: "closed", key: "closedOpensToday", time: M(8) });
  // Friday evening → opens Monday.
  assert.deepEqual(shelterStatus(sh, { day: 4, minutes: M(16) }), { tone: "closed", key: "closedOpensOn", time: M(8), day: 0 });
  // Saturday 3 a.m. → Monday.
  assert.deepEqual(shelterStatus(sh, { day: 5, minutes: M(3) }), { tone: "closed", key: "closedOpensOn", time: M(8), day: 0 });
  // Sunday → tomorrow (Monday).
  assert.equal(shelterStatus(sh, { day: 6, minutes: M(12) }).key, "closedOpensTomorrow");
});

test("times without days are never shown as certainly open", () => {
  const daily: Shelter["hours"] = [0, ...Array.from({ length: 7 }, () => [M(8), M(17)])];
  assert.equal(shelterStatus(s({ hours: daily }), { day: 5, minutes: M(12) }).tone, "maybe");
  assert.equal(shelterStatus(s({ hours: daily }), { day: 1, minutes: M(3) }).key, "closedByTime");
});

test("unknowns stay unknown", () => {
  assert.deepEqual(shelterStatus(s({}), { day: 0, minutes: 0 }), { tone: "nodata", key: "unknown" });
  assert.deepEqual(shelterStatus(s({ access24h: false }), { day: 0, minutes: M(12) }), { tone: "limited", key: "not247" });
  assert.deepEqual(shelterStatus(s({ access24h: false, hours: "A" }), { day: 0, minutes: 0 }), { tone: "nodata", key: "conflict" });
  assert.equal(shelterStatus(s({ hours: "C" }), { day: 0, minutes: M(12) }).tone, "closed");
});

test("lunch breaks and past-midnight hours", () => {
  const lunch: Shelter["hours"] = [1, ...Array.from({ length: 7 }, () => [M(8), M(12), M(13), M(17)])];
  assert.equal(shelterStatus(s({ hours: lunch }), { day: 0, minutes: M(12, 30) }).key, "closedOpensToday");
  assert.deepEqual(shelterStatus(s({ hours: lunch }), { day: 0, minutes: M(14) }), { tone: "open", key: "openUntil", time: M(17) });
  const late: Shelter["hours"] = [1, [M(18), 1440], [0, M(2)], [], [], [], [], []];
  assert.deepEqual(shelterStatus(s({ hours: late }), { day: 0, minutes: M(23) }), { tone: "open", key: "openUntil", time: M(2) });
});

test("institution hours only fill gaps, and never make a shelter certainly open", () => {
  const host = { name: "Darželis", hoursRaw: "Mo-Fr 07:00-18:00", osmId: "node/1", hours: [1, [M(7), M(18)], [M(7), M(18)], [M(7), M(18)], [M(7), M(18)], [M(7), M(18)], [], []] as Shelter["hours"] };
  assert.deepEqual(shelterStatus(s({ host }), { day: 0, minutes: M(10) }), { tone: "maybe", key: "hostOpen", time: M(18) });
  assert.deepEqual(shelterStatus(s({ host }), { day: 0, minutes: M(3) }), { tone: "nodata", key: "hostClosed" });
  assert.deepEqual(shelterStatus(s({ host, access24h: false }), { day: 5, minutes: M(10) }), { tone: "limited", key: "hostClosed" });
  // Official data wins.
  assert.equal(shelterStatus(s({ host, hours: weekdays }), { day: 0, minutes: M(3) }).key, "closedOpensToday");
  assert.equal(shelterStatus(s({ host, access24h: true }), { day: 0, minutes: M(3) }).key, "always");
});
