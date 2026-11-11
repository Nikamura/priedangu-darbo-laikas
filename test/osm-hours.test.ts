import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOsmHours } from "../src/osm/opening-hours.ts";

const M = (h: number, m = 0) => h * 60 + m;
const week = (s: string) => {
  const r = parseOsmHours(s);
  assert.ok(r && r.kind === "schedule", s);
  return r.week;
};

test("24/7 forms", () => {
  for (const s of ["24/7", "Mo-Su 00:00-24:00", "Mo-Su,PH 00:00-24:00"]) assert.deepEqual(parseOsmHours(s), { kind: "always" }, s);
});

test("weekday rules, later rules override earlier ones", () => {
  const w = week("Mo-Fr 08:00-17:00; Fr 08:00-15:45; Sa-Su off");
  assert.deepEqual(w[0], [[M(8), M(17)]]);
  assert.deepEqual(w[4], [[M(8), M(15, 45)]]);
  assert.deepEqual(w[5], []);
});

test("comma separates rules when a day follows, otherwise time ranges", () => {
  const w = week("Mo-Th 08:00-12:00, 12:45-17:00; Fr 08:00-12:00, 12:45-15:45");
  assert.deepEqual(w[1], [[M(8), M(12)], [M(12, 45), M(17)]]);
  assert.deepEqual(w[4], [[M(8), M(12)], [M(12, 45), M(15, 45)]]);
  const v = week("Mo-Fr 10:00-20:00, Sa 10:00-18:00, Su off");
  assert.deepEqual(v[5], [[M(10), M(18)]]);
  assert.deepEqual(v[6], []);
});

test("bare times mean every day; single-digit hours", () => {
  const w = week("8:00-22:00");
  assert.equal(w.length, 7);
  assert.ok(w.every((d) => d[0]![0] === M(8) && d[0]![1] === M(22)));
});

test("public holidays are ignored, not guessed", () => {
  const w = week("Mo-Su,PH 08:00-22:00");
  assert.deepEqual(w[6], [[M(8), M(22)]]);
  assert.deepEqual(week("Mo-Fr 09:00-17:00; PH off")[0], [[M(9), M(17)]]);
});

test("past midnight spills into the next day", () => {
  const w = week("Fr-Sa 18:00-02:00");
  assert.deepEqual(w[4], [[M(18), 1440]]);
  assert.deepEqual(w[5], [[0, M(2)], [M(18), 1440]]);
  assert.deepEqual(w[6], [[0, M(2)]]);
});

test("unsupported syntax is null", () => {
  for (const s of ["sunrise-sunset", "Oct 1 - May 15 Tu-Sa 9:00-17:00", "Mo-Fr 08:00-17:00 \"by appointment\"", "Mo-Fr 08:00+", "25:00-26:00", ""])
    assert.equal(parseOsmHours(s), null, s);
});
