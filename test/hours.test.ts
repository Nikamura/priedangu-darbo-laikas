import assert from "node:assert/strict";
import { test } from "node:test";
import { type Hours, parseHours } from "../src/hours.ts";

const h = (s: string | null) => parseHours(s);
const min = (t: string) => {
  const [a, b] = t.split(":").map(Number);
  return a! * 60 + b!;
};
const weekdays = (o: string, c: string) => [
  ...Array.from({ length: 5 }, () => [[min(o), min(c)]]),
  [],
  [],
];
const daily = (o: string, c: string) => Array.from({ length: 7 }, () => [[min(o), min(c)]]);

test("24/7 variants", () => {
  for (const s of ["24", "Neribotas", "Visą parą", "visą parą", "00:00:24:00", "00:00-24:00", "00.00-24.00", "0:00-24:00", "0.00-24.00", "0-24 val."])
    assert.deepEqual(h(s), { kind: "always" }, s);
});

test("closed and placeholder values", () => {
  assert.deepEqual(h("nedirba"), { kind: "closed" });
  assert.deepEqual(h("Mokykla uždaryta"), { kind: "closed" });
  assert.deepEqual(h("_"), { kind: "unknown" });
  assert.deepEqual(h(null), { kind: "unknown" });
});

test("bare time ranges repeat daily but are flagged as days unspecified", () => {
  for (const s of ["8.00-17.00", "08.00-17.00", "8:00 - 17:00", "8.00–17.00", "8-17 val.", "8 iki 17", "nuo 8 val. iki 17 val.", "8:00-17:00"])
    assert.deepEqual(h(s), { kind: "schedule", week: daily("8:00", "17:00"), daysSpecified: false }, s);
  assert.deepEqual(h("Nuo7.30 val.iki 16.30 val."), { kind: "schedule", week: daily("7:30", "16:30"), daysSpecified: false });
  assert.deepEqual(h("8 iki19"), { kind: "schedule", week: daily("8:00", "19:00"), daysSpecified: false });
  assert.deepEqual(h("8:-21:00"), { kind: "schedule", week: daily("8:00", "21:00"), daysSpecified: false });
});

test("weekday specs", () => {
  const exp = { kind: "schedule", week: weekdays("8:00", "17:00"), daysSpecified: true };
  for (const s of ["Pirmadienis-penktadienis 8.00 - 17.00", "d.d. 08:00-17:00", "d.d.08:00-17:00", "I-V 08:00-17:00", "I-V 08:00-17:00.", "08:00:17:00 DD", "Administracija darbo dienomis 08:00 iki 17:00", "Pirmadienis- penktadienis 8.00-17.00"])
    assert.deepEqual(h(s), exp, s);
});

test("later day specs override earlier ones", () => {
  const r = h("I-IV 8.00-17.00, V 8.00-15.45") as Extract<Hours, { kind: "schedule" }>;
  assert.deepEqual(r.week[3], [[min("8:00"), min("17:00")]]);
  assert.deepEqual(r.week[4], [[min("8:00"), min("15:45")]]);
  assert.deepEqual(r.week[5], []);
  assert.deepEqual(h("I-V 8.00-17.00, V 8.00-15.45"), r);
  assert.deepEqual(h("I-IV 8:00-17:00; V 8:00-15:45"), r);
  assert.deepEqual(h("Pirmadienis-ketvirtadienis 8.00-17.00 penktadienis 8.00-15.45"), r);
});

test("weekend and split-day schedules", () => {
  const r = h("Pirmadienis 09.00–17.00 antradienis–penktadienis 13.00–17.00, šeštadienis 09.00–13.00") as Extract<Hours, { kind: "schedule" }>;
  assert.deepEqual(r.week.map((d) => d[0]?.[0] ?? null), [540, 780, 780, 780, 780, 540, null]);
  const t = h("antradienis, ketvirtadienis 10.00–17.00 penktadienis, šeštadienis 09.00–16.00") as Extract<Hours, { kind: "schedule" }>;
  assert.deepEqual(t.week.map((d) => d.length), [0, 1, 0, 1, 1, 1, 0]);
  const w = h("Pirmadienis-penktadienis 07.00-21.00 šeštadienis-sekmadienis 09.00-21.00") as Extract<Hours, { kind: "schedule" }>;
  assert.deepEqual(w.week[6], [[540, 1260]]);
});

test("anything doubtful is unknown, never a guess", () => {
  for (const s of ["I (nuo 08:00) - V (iki 16:00)", "Pirmadienis-ketvirtadienis 8.00-17.00 penktadienis 8.00-1.45", "kreiptis į budėtoją", "8.00-17.00 pagal susitarimą", "25:00-26:00"])
    assert.deepEqual(h(s), { kind: "unknown" }, s);
});
