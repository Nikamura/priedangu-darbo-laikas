/**
 * Parses the free-text `darbo_valandos` field into a weekly schedule.
 *
 * This is deliberately strict: when any part of the text is not understood the
 * result is "unknown", never a guess. A wrong "open" answer during an alert is
 * worse than an honest "we don't know".
 */

/** Minutes since midnight, [open, close). close may be 1440. */
export type Interval = [number, number];

export type Hours =
  | { kind: "always" }
  | { kind: "closed" }
  | {
      kind: "schedule";
      /** Monday = 0 … Sunday = 6. An empty array means closed that day. */
      week: Interval[][];
      /** False when the text gave times but no days ("8.00-17.00"). The week then repeats the times daily. */
      daysSpecified: boolean;
    }
  | { kind: "unknown" };

const ALWAYS = [
  /^24$/,
  /^24\s*\/\s*7$/,
  /^24\s*val\.?$/,
  /^visą parą$/,
  /^neribotas$/,
  /^0{1,2}([:.]0{2})?\s*[-:]\s*24([:.]0{2})?(\s*val\.?)?$/,
];
const CLOSED = [/^nedirba$/, /^mokykla uždaryta$/, /^neveikia$/];

const DAY_NAMES: [RegExp, number][] = [
  [/^pirmadien/, 0],
  [/^antradien/, 1],
  [/^trečiadien/, 2],
  [/^ketvirtadien/, 3],
  [/^penktadien/, 4],
  [/^šeštadien/, 5],
  [/^sekmadien/, 6],
];
const ROMAN: Record<string, number> = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 };

function dayIndex(token: string): number | null {
  if (token in ROMAN) return ROMAN[token]!;
  for (const [re, i] of DAY_NAMES) if (re.test(token)) return i;
  return null;
}

/** Parses a day specification like "I-IV", "Pirmadienis-ketvirtadienis", "antradienis, ketvirtadienis", "d.d.". */
function parseDays(spec: string): number[] | null | "unspecified" {
  const s = spec
    .replace(/\badministracija\b/g, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[,;]/g, " , ")
    .replace(/\s*-\s*/g, "-")
    .trim();
  if (s === "" || /^[,\s]*$/.test(s)) return "unspecified";
  if (/^(d\.\s?d\.?|dd|darbo dienomis)$/.test(s)) return [0, 1, 2, 3, 4];

  const days = new Set<number>();
  for (const part of s.split(/\s*,\s*|\s+/).filter(Boolean)) {
    if (/^(d\.\s?d\.?|dd|darbo|dienomis)$/.test(part)) {
      [0, 1, 2, 3, 4].forEach((d) => days.add(d));
      continue;
    }
    const range = part.split("-");
    if (range.length === 1) {
      const d = dayIndex(range[0]!);
      if (d == null) return null;
      days.add(d);
    } else if (range.length === 2) {
      const a = dayIndex(range[0]!);
      const b = dayIndex(range[1]!);
      if (a == null || b == null || b < a) return null;
      for (let d = a; d <= b; d++) days.add(d);
    } else return null;
  }
  return days.size ? [...days].sort() : null;
}

const TIME = String.raw`(\d{1,2})(?:[.:](\d{2})?)?`;
const RANGE = new RegExp(
  String.raw`(?:nuo\s*)?${TIME}\s*(?:val\.?)?\s*(?:-|iki)\s*${TIME}\s*(?:val\.?)?`,
  "g",
);

function toMinutes(h: string, m: string | undefined): number | null {
  const hh = Number(h);
  const mm = m ? Number(m) : 0;
  if (hh > 24 || mm > 59 || (hh === 24 && mm !== 0)) return null;
  return hh * 60 + mm;
}

export function parseHours(raw: string | null | undefined): Hours {
  if (raw == null) return { kind: "unknown" };
  let s = raw
    .toLocaleLowerCase("lt")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "");
  if (s === "" || /^[-_]+$/.test(s)) return { kind: "unknown" };
  if (ALWAYS.some((re) => re.test(s))) return { kind: "always" };
  if (CLOSED.some((re) => re.test(s))) return { kind: "closed" };

  // "08:00:17:00 DD" → "dd 08:00-17:00"
  s = s.replace(/^(\d{2}:\d{2}):(\d{2}:\d{2})\s*(dd|d\.d\.)$/, "$3 $1-$2");

  const week: Interval[][] = Array.from({ length: 7 }, () => []);
  const touched = new Set<number>();
  let daysSpecified: boolean | null = null;
  let cursor = 0;

  for (const m of s.matchAll(RANGE)) {
    const days = parseDays(s.slice(cursor, m.index));
    cursor = m.index + m[0].length;
    if (days === null) return { kind: "unknown" };

    const specified = days !== "unspecified";
    // Mixing "I-V 8-17" with a bare "9-13" is ambiguous.
    if (daysSpecified !== null && daysSpecified !== specified) return { kind: "unknown" };
    daysSpecified = specified;

    const open = toMinutes(m[1]!, m[2]);
    const close = toMinutes(m[3]!, m[4]);
    if (open == null || close == null || close <= open) return { kind: "unknown" };
    if (open === 0 && close === 1440 && !specified) return { kind: "always" };

    // A later day spec overrides an earlier one ("I-V 8-17, V 8-15.45").
    for (const d of specified ? (days as number[]) : [0, 1, 2, 3, 4, 5, 6]) {
      week[d] = [[open, close]];
      touched.add(d);
    }
  }

  if (daysSpecified === null || s.slice(cursor).replace(/[\s,;.]/g, "") !== "") return { kind: "unknown" };
  return { kind: "schedule", week, daysSpecified };
}
