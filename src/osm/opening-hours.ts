import type { Interval } from "../hours.ts";

/**
 * Parses the common subset of OpenStreetMap `opening_hours`
 * (https://wiki.openstreetmap.org/wiki/Key:opening_hours):
 *   "24/7", "Mo-Fr 08:00-17:00; Sa 10:00-14:00", "Mo-Th 8:00-12:00,12:45-17:00, Fr 8:00-15:45",
 *   "Mo-Su,PH 08:00-22:00", "Sa-Su off", "18:00-02:00".
 * Public-holiday (PH/SH) rules are ignored. Anything else (sunrise, month ranges,
 * comments, "+") returns null rather than a guess.
 */
export type OsmHours = { kind: "always" } | { kind: "schedule"; week: Interval[][] };

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DAY = String.raw`(?:Mo|Tu|We|Th|Fr|Sa|Su)`;
const DAY_ITEM = String.raw`(?:${DAY}(?:-${DAY})?|PH|SH)`;
const DAY_SEL = String.raw`${DAY_ITEM}(?:,${DAY_ITEM})*`;
const TIME = String.raw`\d{1,2}:\d{2}-\d{1,2}:\d{2}`;
const TIMES = String.raw`${TIME}(?:,${TIME})*`;
const RULE = new RegExp(String.raw`^(?:(${DAY_SEL})\s+)?(${TIMES}|off|closed)$`);

function minutes(t: string): number | null {
  const [h, m] = t.split(":").map(Number);
  if (h == null || m == null || h > 24 || m > 59 || (h === 24 && m !== 0)) return null;
  return h * 60 + m;
}

function daysOf(sel: string | undefined): number[] | "ph-only" | null {
  if (!sel) return [0, 1, 2, 3, 4, 5, 6];
  const out = new Set<number>();
  for (const item of sel.split(",")) {
    if (item === "PH" || item === "SH") continue;
    const [a, b] = item.split("-");
    const from = DAYS.indexOf(a!);
    const to = b ? DAYS.indexOf(b) : from;
    if (from < 0 || to < 0) return null;
    // Wrapping ranges like "Fr-Mo" are valid OSM.
    for (let d = from; ; d = (d + 1) % 7) {
      out.add(d);
      if (d === to) break;
    }
  }
  return out.size ? [...out].sort() : "ph-only";
}

export function parseOsmHours(raw: string | null | undefined): OsmHours | null {
  if (!raw) return null;
  const s = raw.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  if (s === "24/7" || s === "Mo-Su 00:00-24:00" || s === "00:00-24:00") return { kind: "always" };

  // A comma followed by a day starts a new rule ("Mo-Fr 9-18, Sa 9-14"); otherwise it continues a time list.
  const rules = s
    .split(/;|(?<=\d|off|closed)\s*,(?=\s*(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)\b)/)
    .map((r) => r.replace(/\s*,\s*/g, ",").replace(/\s*-\s*/g, "-").trim())
    .filter(Boolean);
  if (!rules.length) return null;

  const week: Interval[][] = Array.from({ length: 7 }, () => []);
  // Spill-over from times past midnight, applied after the day's own rule.
  const spill: Interval[][] = Array.from({ length: 7 }, () => []);
  let any = false;

  for (const rule of rules) {
    const m = rule.match(RULE);
    if (!m) return null;
    const days = daysOf(m[1]);
    if (days === null) return null;
    if (days === "ph-only") continue;
    const times = m[2]!;
    const intervals: Interval[] = [];
    const next: Interval[] = [];
    if (times !== "off" && times !== "closed") {
      for (const range of times.split(",")) {
        const [a, b] = range.split("-");
        const open = minutes(a!);
        const close = minutes(b!);
        if (open == null || close == null || open === close) return null;
        if (close > open) intervals.push([open, close]);
        else {
          intervals.push([open, 1440]);
          if (close > 0) next.push([0, close]);
        }
      }
    }
    for (const d of days) {
      week[d] = intervals.map((i) => [...i] as Interval);
      spill[(d + 1) % 7] = next.map((i) => [...i] as Interval);
    }
    any = true;
  }
  if (!any) return null;

  for (let d = 0; d < 7; d++) {
    week[d] = [...spill[d]!, ...week[d]!].sort((a, b) => a[0] - b[0]);
  }
  if (week.every((d) => d.length === 1 && d[0]![0] === 0 && d[0]![1] === 1440)) return { kind: "always" };
  return { kind: "schedule", week };
}
