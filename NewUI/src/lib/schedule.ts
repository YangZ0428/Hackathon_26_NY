/**
 * The day, and the gaps in it.
 *
 * The plan options used to be fixed hours in places.json: today 4:30pm and
 * tomorrow 7am. They now come from this file instead -- the free windows in
 * the person's own day, same day only. Two consequences worth knowing:
 *
 *  - Adding a plan to the calendar closes that window, so the next comparison
 *    is made against the day as it now stands. The loop is the product.
 *  - Because everything is same-day, the best option is an evening window
 *    rather than tomorrow morning. Smaller drop, but it is an answer the
 *    person can actually act on today.
 *
 * The events below are illustrative -- there is no calendar integration yet,
 * which the profile form says plainly. The free-window logic is real, and
 * would work unchanged against an imported calendar.
 */

export type ScheduleEvent = {
  id: string;
  /** Minutes from midnight. Local, naive, single day: a demo does not need
   *  time zones and a wrong one would be worse than none. */
  start: number;
  end: number;
  title: string;
  detail: string;
  /** "plan" = added from a Climap NYC recommendation, so we can style it. */
  kind: "busy" | "plan";
};

export const DAY_START = 7 * 60;   // we do not suggest anything before 7am
export const DAY_END = 21 * 60;    // or after 9pm

export const DEFAULT_DAY: ScheduleEvent[] = [
  { id: "work", start: 9 * 60, end: 12 * 60, title: "Work", detail: "Focus time", kind: "busy" },
  { id: "lunch", start: 12 * 60, end: 13 * 60, title: "Lunch", detail: "Café with Nina", kind: "busy" },
  { id: "meeting", start: 14 * 60, end: 15 * 60, title: "Meeting", detail: "Project check-in", kind: "busy" },
  { id: "dinner", start: 19 * 60, end: 20 * 60, title: "Dinner", detail: "At home", kind: "busy" },
];

export type FreeWindow = { start: number; end: number };

/** Gaps between commitments that are long enough for the activity. */
export function freeWindows(events: ScheduleEvent[], minutesNeeded: number): FreeWindow[] {
  const busy = [...events].sort((a, b) => a.start - b.start);
  const windows: FreeWindow[] = [];
  let cursor = DAY_START;

  for (const event of busy) {
    if (event.start > cursor) windows.push({ start: cursor, end: Math.min(event.start, DAY_END) });
    cursor = Math.max(cursor, event.end);
  }
  if (cursor < DAY_END) windows.push({ start: cursor, end: DAY_END });

  return windows.filter((w) => w.end - w.start >= minutesNeeded && w.start < DAY_END);
}

/** The weather series is hourly, so a 3:47pm start would be scored with 3pm's
 *  numbers and quietly misrepresent itself. Every candidate start is a whole
 *  hour that fits entirely inside its window. */
function hourStarts(window: FreeWindow, minutesNeeded: number): number[] {
  const first = Math.ceil(window.start / 60) * 60;
  const last = Math.floor((window.end - minutesNeeded) / 60) * 60;
  const out: number[] = [];
  for (let hour = first; hour <= last; hour += 60) out.push(hour);
  return out;
}

export function startWithin(window: FreeWindow, minutesNeeded: number): number | null {
  return hourStarts(window, minutesNeeded)[0] ?? null;
}

/** The two times we compare.
 *
 *  Baseline: the hour nearest the hot part of the afternoon -- what someone
 *  would plausibly have planned, and the thing we are arguing against.
 *  Alternative: the latest hour still free today. After sundown the radiant
 *  load collapses, which is the largest lever available inside one day.
 *
 *  Both are nullable: a full day genuinely has no choice to offer, and saying
 *  so is better than inventing a window the person does not have.
 */
export function pickWindows(windows: FreeWindow[], minutesNeeded: number) {
  const starts = windows.flatMap((window) => hourStarts(window, minutesNeeded));
  if (!starts.length) return { baseline: null, alternative: null };

  const HOT = 16 * 60 + 30;
  const baseline = starts.reduce((best, start) =>
    Math.abs(start - HOT) < Math.abs(best - HOT) ? start : best);

  // Furthest from the peak, which is the best single-variable proxy for the
  // coolest hour available: air temperature and solar load both fall off on
  // either side of it. Picking "the latest free hour" instead produced 4pm vs
  // 5pm on a busy day -- technically a choice, useless as advice.
  const others = starts.filter((start) => start !== baseline);
  const alternative = others.length
    ? others.reduce((best, start) =>
        Math.abs(start - HOT) > Math.abs(best - HOT) ? start : best)
    : null;

  return { baseline, alternative };
}

export function clockLabel(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** "2026-07-03" + 16:00 -> "2026-07-03T16:00:00", the shape the API matches on. */
export function isoAt(date: string, minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${date}T${hh}:${mm}:00`;
}

export function addPlan(
  events: ScheduleEvent[], start: number, minutes: number, title: string, detail: string,
): ScheduleEvent[] {
  const event: ScheduleEvent = {
    id: `plan-${start}-${Date.now().toString(36)}`,
    start, end: start + minutes, title, detail, kind: "plan",
  };
  return [...events, event].sort((a, b) => a.start - b.start);
}

export const totalFree = (windows: FreeWindow[]) =>
  windows.reduce((sum, w) => sum + (w.end - w.start), 0);

export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
