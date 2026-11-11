/**
 * Weekly schedules as shipped to the browser, shared by the exporter (Node) and
 * the site. A week is 7 days (Monday first); each day is a flat list of
 * [open, close, open, close, …] minutes since midnight. [] means closed all day.
 */
export type Week = number[][];

/** null = unknown, "A" = always open, "C" = marked as not in use, else [daysSpecified, ...7 days]. */
export type WebHours = null | "A" | "C" | [0 | 1, ...number[][]];

export interface Now {
  /** Monday = 0. */
  day: number;
  minutes: number;
}

export function encodeWeek(week: [number, number][][]): Week {
  return week.map((day) => day.flatMap(([o, c]) => [o, c]));
}

export function weekOf(h: Exclude<WebHours, null | "A" | "C">): { daysSpecified: boolean; week: Week } {
  return { daysSpecified: h[0] === 1, week: h.slice(1) as Week };
}

/** If open at `now`, the minute it closes (1440 = midnight), else null. */
export function openUntil(week: Week, now: Now): number | null {
  const day = week[now.day] ?? [];
  for (let i = 0; i + 1 < day.length; i += 2) {
    if (now.minutes >= day[i]! && now.minutes < day[i + 1]!) {
      let close = day[i + 1]!;
      // Runs past midnight into tomorrow's first slot: report the later close.
      const next = week[(now.day + 1) % 7] ?? [];
      if (close === 1440 && next[0] === 0) close = next[1]! + 1440;
      return close;
    }
  }
  return null;
}

/** The next opening after `now` within a week: days ahead (0 = today) and minute. */
export function nextOpening(week: Week, now: Now): { inDays: number; day: number; time: number } | null {
  for (let inDays = 0; inDays < 8; inDays++) {
    const day = (now.day + inDays) % 7;
    const slots = week[day] ?? [];
    for (let i = 0; i < slots.length; i += 2) {
      if (inDays === 0 && slots[i]! <= now.minutes) continue;
      return { inDays, day, time: slots[i]! };
    }
  }
  return null;
}
