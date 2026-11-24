/**
 * @interlace/ui — calendar-model
 *
 * The pure half of `Calendar`: dates as plain `YYYY-MM-DD` strings, the
 * month grid, the keyboard moves of the WAI-ARIA date grid, and the bounds.
 *
 * A calendar day is not an instant. A `Date` carries a time and a zone, and
 * "the 3rd" turned into a `Date` at midnight in one zone is the 2nd in the
 * next one west, which is how a booking page ends up a day off for half its
 * visitors. So a day here is the string a form posts and a server stores,
 * and every piece of arithmetic runs on the UTC calendar, where no day is
 * 23 or 25 hours long.
 *
 * Nothing in this file touches the DOM or React, so a server can repeat any
 * of it: the same grid, the same "is this day bookable".
 */

/** A calendar day, `YYYY-MM-DD`. */
export type CalendarDate = string;

/** 0 is Sunday, 1 is Monday … 6 is Saturday, as `Date#getUTCDay`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when `value` is a real `YYYY-MM-DD` day (no 31 April). */
export function isCalendarDate(value: unknown): value is CalendarDate {
  if (typeof value !== 'string') return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

function parts(date: CalendarDate): [number, number, number] {
  const m = ISO_RE.exec(date);
  if (!m) throw new RangeError(`Not a YYYY-MM-DD date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** Build a `YYYY-MM-DD` from a year, a 1-based month and a day. */
export function toCalendarDate(year: number, month: number, day: number): CalendarDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Days in a 1-based month. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function fromUtc(ms: number): CalendarDate {
  const d = new Date(ms);
  return toCalendarDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function toUtc(date: CalendarDate): number {
  const [y, m, d] = parts(date);
  return Date.UTC(y, m - 1, d);
}

/**
 * A UTC-midnight `Date` for the day, for handing to `Intl.DateTimeFormat`
 * with `timeZone: 'UTC'`. Never show it in a local zone.
 */
export function toUtcDate(date: CalendarDate): Date {
  return new Date(toUtc(date));
}

/** The weekday of a day. */
export function weekdayOf(date: CalendarDate): Weekday {
  return new Date(toUtc(date)).getUTCDay() as Weekday;
}

/** The day `n` days later (or earlier, for a negative `n`). */
export function addDays(date: CalendarDate, n: number): CalendarDate {
  return fromUtc(toUtc(date) + n * 86_400_000);
}

/**
 * The same day `n` months later, kept inside the month: 31 January plus one
 * month is 28 or 29 February, never 3 March.
 */
export function addMonths(date: CalendarDate, n: number): CalendarDate {
  const [y, m, d] = parts(date);
  const index = y * 12 + (m - 1) + n;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return toCalendarDate(year, month, Math.min(d, daysInMonth(year, month)));
}

/** The first day of the day's month. */
export function startOfMonth(date: CalendarDate): CalendarDate {
  return `${date.slice(0, 7)}-01`;
}

/** The last day of the day's month. */
export function endOfMonth(date: CalendarDate): CalendarDate {
  const [y, m] = parts(date);
  return toCalendarDate(y, m, daysInMonth(y, m));
}

/** Both days fall in the same month of the same year. */
export function isSameMonth(a: CalendarDate, b: CalendarDate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** -1, 0 or 1. `YYYY-MM-DD` sorts as text, so this is a string compare. */
export function compareDates(a: CalendarDate, b: CalendarDate): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The day within `[min, max]`; either bound may be left out. */
export function clampDate(date: CalendarDate, min?: CalendarDate, max?: CalendarDate): CalendarDate {
  if (min && date < min) return min;
  if (max && date > max) return max;
  return date;
}

/** The first day of the week that holds `date`. */
export function startOfWeek(date: CalendarDate, weekStartsOn: Weekday): CalendarDate {
  return addDays(date, -((weekdayOf(date) - weekStartsOn + 7) % 7));
}

/** The last day of the week that holds `date`. */
export function endOfWeek(date: CalendarDate, weekStartsOn: Weekday): CalendarDate {
  return addDays(startOfWeek(date, weekStartsOn), 6);
}

/**
 * The month as six weeks of seven days, starting on `weekStartsOn`, with the
 * neighbouring months' days filling the edges. Always six rows, so the grid
 * keeps its height from one month to the next and nothing below it moves.
 */
export function monthGrid(month: CalendarDate, weekStartsOn: Weekday): CalendarDate[][] {
  const first = startOfWeek(startOfMonth(month), weekStartsOn);
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)),
  );
}

/** The seven weekdays in grid order, starting on `weekStartsOn`. */
export function weekdayOrder(weekStartsOn: Weekday): Weekday[] {
  return Array.from({ length: 7 }, (_, i) => ((weekStartsOn + i) % 7) as Weekday);
}

/**
 * Regions whose calendars start the week on Sunday or Saturday, for runtimes
 * without `Intl.Locale#getWeekInfo`. Everyone else starts on Monday (ISO 8601).
 * From CLDR's `firstDay` supplemental data.
 */
const SUNDAY_REGIONS = new Set([
  'AG', 'AS', 'BD', 'BR', 'BS', 'BT', 'BW', 'BZ', 'CA', 'CN', 'CO', 'DM', 'DO', 'ET', 'GT', 'GU',
  'HK', 'HN', 'ID', 'IL', 'IN', 'JM', 'JP', 'KE', 'KH', 'KR', 'LA', 'MH', 'MM', 'MO', 'MT', 'MX',
  'MZ', 'NI', 'NP', 'PA', 'PE', 'PH', 'PK', 'PR', 'PT', 'PY', 'SA', 'SG', 'SV', 'TH', 'TT', 'TW',
  'UM', 'US', 'VE', 'VI', 'WS', 'YE', 'ZA', 'ZW',
]);
const SATURDAY_REGIONS = new Set(['AE', 'AF', 'BH', 'DJ', 'DZ', 'EG', 'IQ', 'IR', 'JO', 'KW', 'LY', 'OM', 'QA', 'SD', 'SY']);

interface WeekInfoLocale {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
  maximize: () => Intl.Locale;
}

/**
 * The first day of the week for a locale: `Intl.Locale#getWeekInfo` where the
 * runtime has it, else the CLDR region table above. `en-US` is Sunday,
 * `en-GB` Monday, `ar-EG` Saturday.
 */
export function weekStartFor(locale?: string): Weekday {
  let loc: WeekInfoLocale;
  try {
    loc = new Intl.Locale(locale ?? new Intl.DateTimeFormat().resolvedOptions().locale) as unknown as WeekInfoLocale;
  } catch {
    return 1;
  }
  const info = loc.getWeekInfo?.() ?? loc.weekInfo;
  if (info) return (info.firstDay % 7) as Weekday;
  const region = String(loc.maximize().region);
  if (SUNDAY_REGIONS.has(region)) return 0;
  if (SATURDAY_REGIONS.has(region)) return 6;
  return 1;
}

/** Today as a `YYYY-MM-DD` in a time zone (the runtime's own when left out). */
export function todayIn(timeZone?: string, now: Date = new Date()): CalendarDate {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const part = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day}`;
}

export interface DateBounds {
  min?: CalendarDate;
  max?: CalendarDate;
  /** A day that is inside the bounds but cannot be picked: full, closed, a holiday. */
  isDateUnavailable?: (date: CalendarDate) => boolean;
}

/** Outside `[min, max]`: not shown as a choice at all. */
export function isOutOfRange(date: CalendarDate, { min, max }: DateBounds): boolean {
  return (min !== undefined && date < min) || (max !== undefined && date > max);
}

/** The day cannot be picked, for either reason. */
export function isDateDisabled(date: CalendarDate, bounds: DateBounds): boolean {
  return isOutOfRange(date, bounds) || Boolean(bounds.isDateUnavailable?.(date));
}

/** The first day from `from` (inclusive) to the end of its month that can be picked, or null. */
export function firstEnabledInMonth(from: CalendarDate, bounds: DateBounds): CalendarDate | null {
  const end = endOfMonth(from);
  for (let d = from; d <= end; d = addDays(d, 1)) {
    if (!isDateDisabled(d, bounds)) return d;
  }
  return null;
}

/** The keys the date grid answers to. */
export type GridKey =
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown';

const GRID_KEYS = new Set<string>([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

/** The key moves focus in the date grid. */
export function isGridKey(key: string): key is GridKey {
  return GRID_KEYS.has(key);
}

export interface MoveOptions {
  weekStartsOn: Weekday;
  /** Right-to-left: the left arrow goes to the next day. */
  rtl?: boolean;
  /** Shift held: Page Up / Page Down move a year, not a month. */
  shift?: boolean;
  min?: CalendarDate;
  max?: CalendarDate;
}

/**
 * Where focus goes from `date` on `key`, as the WAI-ARIA date picker grid
 * does it: arrows by a day or a week, Home and End to the week's edges,
 * Page Up and Page Down by a month (a year with Shift). Arrows follow the
 * reading direction. The result stays inside `[min, max]`, so focus never
 * lands on a day that is not drawn as a choice.
 */
export function moveFocus(date: CalendarDate, key: GridKey, opts: MoveOptions): CalendarDate {
  const forward = opts.rtl ? 'ArrowLeft' : 'ArrowRight';
  let next: CalendarDate;
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowRight':
      next = addDays(date, key === forward ? 1 : -1);
      break;
    case 'ArrowUp':
      next = addDays(date, -7);
      break;
    case 'ArrowDown':
      next = addDays(date, 7);
      break;
    case 'Home':
      next = startOfWeek(date, opts.weekStartsOn);
      break;
    case 'End':
      next = endOfWeek(date, opts.weekStartsOn);
      break;
    case 'PageUp':
      next = addMonths(date, opts.shift ? -12 : -1);
      break;
    case 'PageDown':
      next = addMonths(date, opts.shift ? 12 : 1);
      break;
  }
  return clampDate(next, opts.min, opts.max);
}
