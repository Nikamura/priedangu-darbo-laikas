import type { Shelter } from "./data.ts";
import { nextOpening, type Now, openUntil, weekOf } from "./schedule.ts";

/**
 * open    – officially 24/7, or open now by a schedule that names the days
 * maybe   – open now by time of day but the days weren't stated, or the
 *           institution in the building (OpenStreetMap) is open now
 * closed  – closed now by its published hours, or marked as not in use
 * limited – officially NOT open 24/7, but no hours were published
 * nodata  – the operator filled in neither the 24/7 flag nor the hours
 */
export type Tone = "open" | "maybe" | "closed" | "limited" | "nodata";

export type StatusKey =
  | "always"
  | "openUntil"
  | "maybeOpen"
  | "closedOpensToday"
  | "closedOpensTomorrow"
  | "closedOpensOn"
  | "closedByTime"
  | "closedPermanently"
  | "not247"
  | "conflict"
  | "unknown"
  | "hostAlways"
  | "hostOpen"
  | "hostClosed";

export interface Status {
  tone: Tone;
  key: StatusKey;
  /** Minutes since midnight for {time}. */
  time?: number;
  /** Monday = 0 for {day}. */
  day?: number;
}

export type VilniusNow = Now;

const WEEKDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const vilniusFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Vilnius",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Shelter hours are local Lithuanian time, regardless of the phone's time zone. */
export function vilniusNow(date = new Date()): Now {
  const parts = Object.fromEntries(vilniusFmt.formatToParts(date).map((p) => [p.type, p.value]));
  return { day: WEEKDAY[parts.weekday!] ?? 0, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function officialStatus(s: Shelter, now: Now): Status {
  const h = s.hours;
  if (h === "C") return { tone: "closed", key: "closedPermanently" };
  // The official "access 24/7" flag is the strongest signal we have.
  if (s.access24h === true) return { tone: "open", key: "always" };
  if (h === "A") return s.access24h === false ? { tone: "nodata", key: "conflict" } : { tone: "open", key: "always" };

  if (Array.isArray(h)) {
    const { daysSpecified, week } = weekOf(h);
    const until = openUntil(week, now);
    if (until != null) {
      return daysSpecified
        ? { tone: "open", key: "openUntil", time: until % 1440 }
        : { tone: "maybe", key: "maybeOpen", time: until % 1440 };
    }
    if (!daysSpecified) return { tone: "closed", key: "closedByTime" };
    const next = nextOpening(week, now);
    if (!next) return { tone: "closed", key: "closedByTime" };
    if (next.inDays === 0) return { tone: "closed", key: "closedOpensToday", time: next.time };
    if (next.inDays === 1) return { tone: "closed", key: "closedOpensTomorrow", time: next.time };
    return { tone: "closed", key: "closedOpensOn", time: next.time, day: next.day };
  }

  if (s.access24h === false) return { tone: "limited", key: "not247" };
  return { tone: "nodata", key: "unknown" };
}

export function shelterStatus(s: Shelter, now: Now): Status {
  const official = officialStatus(s, now);
  // Only when the register says nothing useful do we look at the institution in the
  // building. Its hours suggest someone with a key is there; they never make it "open".
  if ((official.tone === "nodata" || official.tone === "limited") && s.host?.hours) {
    const h = s.host.hours;
    if (h === "A") return { tone: "maybe", key: "hostAlways" };
    if (Array.isArray(h)) {
      const until = openUntil(weekOf(h).week, now);
      if (until != null) return { tone: "maybe", key: "hostOpen", time: until % 1440 };
      return { tone: official.tone, key: "hostClosed" };
    }
  }
  return official;
}

export function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
