/**
 * @interlace/ui — games/streak-model
 *
 * How long a player's run of days is, with rest days. Pure: give it the days
 * a player played and today's key; it returns the current run, the best run
 * and what each recent day was.
 *
 * ## Rest days
 *
 * A habit that punishes a day off teaches people to quit. `RestRule` names
 * days that never break a run: weekdays (`weekdays: [6]` rests every
 * Saturday) and dates (`dates: ['2026-12-25']`). A rest day the player skips
 * is passed over: the run neither grows nor ends. A rest day the player
 * plays anyway counts like any other day.
 *
 * ## Today is open
 *
 * Not having played yet today never ends a run; the day is still going. The
 * run ends only when a whole working day passes without a game. `status`
 * says which of these states the player is in, so a component can say
 * "play today to keep it" without working that out again.
 *
 * ## Shields
 *
 * `Protection` lets a player earn their way past a missed day. Every
 * `every` days played in a run earns one shield, up to `max` held. A
 * missed working day with a shield in hand spends it: the day is
 * `shielded`, and the run carries on (it does not grow). Shields are worked
 * out from the played days alone, never stored, so every device and a
 * server reach the same count. Shields outlive a broken run: what was
 * earned stays earned.
 */

import { addDays, daysBetween, isDayKey, weekdayOf, type DayKey } from './daily.js';

export interface RestRule {
  /** Weekdays that never break a run: 0 Sunday to 6 Saturday. */
  weekdays?: readonly number[];
  /** Single dates that never break a run, as day keys. */
  dates?: readonly DayKey[];
}

/**
 * - `played`: played today.
 * - `pending`: a run is alive and today still needs a game.
 * - `resting`: today is a rest day and has no game; the run is safe.
 * - `none`: no run to keep.
 */
export type StreakStatus = 'played' | 'pending' | 'resting' | 'none';

/** What one day was: played, rested, missed, today with no game yet, or not yet come. */
export type StreakDayState = 'played' | 'rest' | 'shielded' | 'missed' | 'open' | 'future';

/** How a player earns protection for a missed day. */
export interface Protection {
  /** Days played in a run that earn one shield. */
  every: number;
  /** Shields a player can hold at once. */
  max: number;
}

export interface StreakDay {
  day: DayKey;
  state: StreakDayState;
  /** True for today's key. */
  today: boolean;
}

export interface StreakSummary {
  /** Days played in the run that is still alive (0 when there is none). */
  current: number;
  /** The longest run on record, today's included. */
  best: number;
  status: StreakStatus;
  /** Total distinct days played up to today. */
  total: number;
  /** Shields held now (0 without `Protection`). */
  shields: number;
  /** Missed days a shield has covered, ever. */
  shieldsUsed: number;
  /** Days still to play in this run to earn the next shield; null when none can be earned. */
  nextShieldIn: number | null;
}

/** True when the rule makes `day` a rest day. */
export function isRestDay(day: DayKey, rest?: RestRule): boolean {
  if (!rest) return false;
  if (rest.dates?.includes(day)) return true;
  return rest.weekdays?.includes(weekdayOf(day)) ?? false;
}

function playedSet(played: Iterable<DayKey>, today: DayKey): Set<DayKey> {
  const set = new Set<DayKey>();
  for (const day of played) {
    // A malformed key or a day after today (another device's clock) is ignored.
    if (isDayKey(day) && day <= today) set.add(day);
  }
  return set;
}

interface Walk {
  run: number;
  best: number;
  shields: number;
  shieldsUsed: number;
  /** Days earned toward the next shield in the current run. */
  toward: number;
  shieldedDays: Set<DayKey>;
}

function validProtection(p?: Protection): Protection | undefined {
  if (!p || !(p.every >= 1) || !(p.max >= 1)) return undefined;
  return { every: Math.floor(p.every), max: Math.floor(p.max) };
}

// One pass from the first game to today. A missed working day spends a
// shield or resets the run; today never does, because it is still open.
function walk(days: Set<DayKey>, today: DayKey, rest?: RestRule, protection?: Protection): Walk {
  const out: Walk = { run: 0, best: 0, shields: 0, shieldsUsed: 0, toward: 0, shieldedDays: new Set() };
  if (days.size === 0) return out;
  const p = validProtection(protection);
  const first = [...days].sort()[0] as DayKey;
  const span = daysBetween(first, today);
  for (let i = 0; i <= span; i++) {
    const day = addDays(first, i);
    if (days.has(day)) {
      out.run += 1;
      if (p) {
        out.toward += 1;
        if (out.toward >= p.every) {
          out.toward = 0;
          out.shields = Math.min(p.max, out.shields + 1);
        }
      }
    } else if (day !== today && !isRestDay(day, rest)) {
      if (out.shields > 0 && out.run > 0) {
        out.shields -= 1;
        out.shieldsUsed += 1;
        out.shieldedDays.add(day);
      } else {
        out.run = 0;
        out.toward = 0;
      }
    }
    out.best = Math.max(out.best, out.run);
  }
  return out;
}

/** The player's current and best run, and where today stands. */
export function summarizeStreak(
  played: Iterable<DayKey>,
  today: DayKey,
  rest?: RestRule,
  protection?: Protection,
): StreakSummary {
  const days = playedSet(played, today);
  const p = validProtection(protection);
  const w = walk(days, today, rest, p);
  const nextShieldIn = p && w.shields < p.max ? p.every - w.toward : null;
  const base = { shields: w.shields, shieldsUsed: w.shieldsUsed, nextShieldIn };
  if (days.size === 0) {
    return { current: 0, best: 0, status: isRestDay(today, rest) ? 'resting' : 'none', total: 0, ...base };
  }
  const run = w.run;
  const playedToday = days.has(today);
  const status: StreakStatus = playedToday
    ? 'played'
    : isRestDay(today, rest)
      ? run > 0
        ? 'resting'
        : 'none'
      : run > 0
        ? 'pending'
        : 'none';
  return { current: run, best: w.best, status, total: days.size, ...base };
}

/**
 * The last `length` days ending today, oldest first, each with its state.
 * Pass `after` to also show days after today as `future` (a full week strip
 * that ends on Saturday, say).
 */
export function streakDays(
  played: Iterable<DayKey>,
  today: DayKey,
  options: { length?: number; after?: number; rest?: RestRule; protection?: Protection } = {},
): StreakDay[] {
  const { length = 7, after = 0, rest, protection } = options;
  const days = playedSet(played, today);
  const { shieldedDays } = walk(days, today, rest, protection);
  const out: StreakDay[] = [];
  for (let i = -(length - 1); i <= after; i++) {
    const day = addDays(today, i);
    const state: StreakDayState =
      i > 0
        ? 'future'
        : days.has(day)
          ? 'played'
          : isRestDay(day, rest)
            ? 'rest'
            : shieldedDays.has(day)
              ? 'shielded'
              : i === 0
              ? 'open'
              : 'missed';
    out.push({ day, state, today: i === 0 });
  }
  return out;
}
