/**
 * @interlace/ui — time-slot-model
 *
 * The pure half of `TimeSlotPicker`: what hour a slot starts, which part of
 * the day it falls in, and how to say it in a locale and a time zone.
 *
 * A slot's `value` is whatever your booking store keys it by. Two shapes
 * are read for the hour, so the picker can name and group a slot without a
 * label:
 *
 * | `value`                        | Read as                                   |
 * | ------------------------------ | ----------------------------------------- |
 * | `HH:MM` (e.g. `09:30`)         | a wall-clock time at the venue             |
 * | an ISO instant (`…T09:30:00Z`) | a moment, shown in `timeZone`              |
 *
 * Anything else needs its own `label`, and is grouped by `hour` if given.
 */

/** A part of the day, for grouping a long list of times. */
export type DayPeriod = 'morning' | 'afternoon' | 'evening';

export interface TimeSlotLike {
  value: string;
  /** Hour of the day (0 to 23) for grouping, when `value` is neither shape above. */
  hour?: number;
}

const WALL_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** `09:30` as a UTC date on 1 January 1970, for formatting with `timeZone: 'UTC'`. */
function wallDate(value: string): Date | null {
  const m = WALL_RE.exec(value);
  return m ? new Date(Date.UTC(1970, 0, 1, Number(m[1]), Number(m[2]))) : null;
}

function instantDate(value: string): Date | null {
  if (!INSTANT_RE.test(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The hour (0 to 23) a slot starts at, or null when it cannot be read. */
export function slotHour(slot: TimeSlotLike, timeZone?: string): number | null {
  if (slot.hour !== undefined) return slot.hour;
  const wall = wallDate(slot.value);
  if (wall) return wall.getUTCHours();
  const instant = instantDate(slot.value);
  if (!instant) return null;
  const hour = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(instant);
  return Number(hour);
}

/** Morning before noon, afternoon before 17:00, evening after. */
export function periodOf(hour: number): DayPeriod {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export interface FormatSlotOptions {
  locale?: string;
  /** Zone to show an ISO instant in. Ignored for `HH:MM`. */
  timeZone?: string;
  /** Force a 12-hour (`true`) or 24-hour (`false`) clock. @default the locale's */
  hour12?: boolean;
}

/** The slot's start time in words for the locale ("9:30 AM", "09:30"), or the raw value. */
export function formatSlot(value: string, opts: FormatSlotOptions = {}): string {
  const wall = wallDate(value);
  const date = wall ?? instantDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat(opts.locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: opts.hour12,
    timeZone: wall ? 'UTC' : opts.timeZone,
  }).format(date);
}

/**
 * The slots in groups by part of the day, in the order given, leaving out
 * empty groups. Slots whose hour cannot be read go in the first group.
 */
export function groupByPeriod<T extends TimeSlotLike>(
  slots: readonly T[],
  timeZone?: string,
): { period: DayPeriod; slots: T[] }[] {
  const order: DayPeriod[] = ['morning', 'afternoon', 'evening'];
  const groups = new Map<DayPeriod, T[]>(order.map((p) => [p, []]));
  for (const slot of slots) {
    const hour = slotHour(slot, timeZone);
    groups.get(hour === null ? 'morning' : periodOf(hour))!.push(slot);
  }
  return order
    .map((period) => ({ period, slots: groups.get(period)! }))
    .filter((g) => g.slots.length > 0);
}
