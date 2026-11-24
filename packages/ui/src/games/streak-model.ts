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
export type StreakDayState = 'played' | 'rest' | 'missed' | 'open' | 'future';

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

/** The player's current and best run, and where today stands. */
export function summarizeStreak(
  played: Iterable<DayKey>,
  today: DayKey,
  rest?: RestRule,
): StreakSummary {
  const days = playedSet(played, today);
  if (days.size === 0) {
    return { current: 0, best: 0, status: isRestDay(today, rest) ? 'resting' : 'none', total: 0 };
  }

  // One pass from the first game to today. A missed working day resets the
  // run; today never does, because it is still open.
  const first = [...days].sort()[0] as DayKey;
  const span = daysBetween(first, today);
  let run = 0;
  let best = 0;
  for (let i = 0; i <= span; i++) {
    const day = addDays(first, i);
    if (days.has(day)) run += 1;
    else if (day !== today && !isRestDay(day, rest)) run = 0;
    best = Math.max(best, run);
  }

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
  return { current: run, best, status, total: days.size };
}

/**
 * The last `length` days ending today, oldest first, each with its state.
 * Pass `after` to also show days after today as `future` (a full week strip
 * that ends on Saturday, say).
 */
export function streakDays(
  played: Iterable<DayKey>,
  today: DayKey,
  options: { length?: number; after?: number; rest?: RestRule } = {},
): StreakDay[] {
  const { length = 7, after = 0, rest } = options;
  const days = playedSet(played, today);
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
            : i === 0
              ? 'open'
              : 'missed';
    out.push({ day, state, today: i === 0 });
  }
  return out;
}
