/**
 * @interlace/ui — games/daily
 *
 * The calendar under a daily game: which day it is for a player, which
 * puzzle that day gets, its number, and how long until the next one. Pure
 * functions, no React, no storage. Every component in `games/` builds on
 * these, and a server can call them too, so the puzzle a page renders and
 * the one a score is checked against come from the same arithmetic.
 *
 * ## Day keys
 *
 * A day is an ISO date string, `"2026-11-24"`, read in a time zone. Keys
 * sort as strings, survive JSON and storage unchanged, and compare without
 * a Date. Arithmetic on them runs in UTC, where every day has 24 hours, so
 * daylight-saving changes never skip or repeat a day.
 *
 * ## The puzzle of the day
 *
 * `dailyIndex` maps a day to an item in a pool. `order: 'sequence'` walks
 * the pool in order and starts again at the end. `order: 'shuffle'` deals
 * the pool in a seeded order that changes every cycle, and never repeats an
 * item inside a cycle. Both are deterministic: the same day, pool size and
 * seed give the same item on every device.
 */

/** An ISO calendar date, `YYYY-MM-DD`. */
export type DayKey = string;

const DAY_MS = 86_400_000;
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The calendar day `date` falls on in `timeZone` (an IANA name such as
 * `"Europe/Paris"`). Without a time zone, the runtime's own is used, which on
 * a server is usually UTC: pass the player's zone when the page renders on
 * one.
 */
export function dayKey(date: Date | number = Date.now(), timeZone?: string): DayKey {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(typeof date === 'number' ? new Date(date) : date);
  const part = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day}`;
}

/** True when `value` is a well-formed day key for a real date. */
export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string') return false;
  const m = KEY_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function toUtc(key: DayKey): number {
  const m = KEY_RE.exec(key);
  if (!m) throw new RangeError(`Not a day key: "${key}" (expected YYYY-MM-DD)`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

/** Midnight UTC of the day, as a Date: the safe way to format a key with Intl. */
export function dayKeyToDate(key: DayKey): Date {
  return new Date(toUtc(key));
}

/** The key `days` after `key` (negative goes back). */
export function addDays(key: DayKey, days: number): DayKey {
  return new Date(toUtc(key) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** Day of the week, 0 for Sunday to 6 for Saturday, as `Date.getDay` counts. */
export function weekdayOf(key: DayKey): number {
  return new Date(toUtc(key)).getUTCDay();
}

/**
 * The puzzle's number: 1 on `firstDay`, 2 the day after. Before `firstDay`
 * it is 0 or less, which a caller should treat as "not started".
 */
export function puzzleNumber(key: DayKey, firstDay: DayKey): number {
  return daysBetween(firstDay, key) + 1;
}

/** FNV-1a, 32-bit: a small, stable string hash for seeds. */
export function hashString(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A seeded generator of numbers in [0, 1) (mulberry32). Good enough to deal
 * puzzles and shuffle answers the same way everywhere; not for anything
 * secret.
 */
export function seededRandom(seed: number | string): () => number {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** A copy of `items` in a seeded order (Fisher–Yates). */
export function seededShuffle<T>(items: readonly T[], seed: number | string): T[] {
  const out = items.slice();
  const random = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export interface DailyIndexOptions {
  /** The day puzzle 1 ran. */
  firstDay: DayKey;
  /** `sequence` walks the pool in order; `shuffle` deals it in a seeded order per cycle. @default 'sequence' */
  order?: 'sequence' | 'shuffle';
  /** Changes the shuffled order. @default 'daily' */
  seed?: string;
}

/**
 * Which item of a pool of `size` the day gets, or -1 for an empty pool or a
 * day before `firstDay`.
 */
export function dailyIndex(key: DayKey, size: number, options: DailyIndexOptions): number {
  const n = puzzleNumber(key, options.firstDay);
  if (size <= 0 || n < 1) return -1;
  const position = (n - 1) % size;
  if ((options.order ?? 'sequence') === 'sequence') return position;
  const cycle = Math.floor((n - 1) / size);
  const order = seededShuffle(
    Array.from({ length: size }, (_, i) => i),
    `${options.seed ?? 'daily'}:${cycle}`,
  );
  return order[position] as number;
}

/** The day's item from `pool`, or undefined when there is none. */
export function dailyItem<T>(pool: readonly T[], key: DayKey, options: DailyIndexOptions): T | undefined {
  const i = dailyIndex(key, pool.length, options);
  return i < 0 ? undefined : pool[i];
}

/**
 * Milliseconds until the next day starts in `timeZone`. On a day that a
 * clock change makes 23 or 25 hours long the answer can be off by that hour,
 * which is fine for a countdown and is why it is not used to pick puzzles.
 */
export function msUntilNextDay(now: Date | number = Date.now(), timeZone?: string): number {
  const date = typeof now === 'number' ? new Date(now) : now;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = Object.fromEntries(parts.map((p) => [p.type, Number(p.value)]));
  const elapsed =
    ((part.hour! * 60 + part.minute!) * 60 + part.second!) * 1000 + date.getMilliseconds();
  return DAY_MS - elapsed;
}
