/**
 * games/daily and games/streak-model: the calendar arithmetic every daily
 * game stands on. Pure, so the tests pin the numbers a server would store.
 */
import { describe, expect, it } from 'vitest';

import {
  addDays,
  dailyIndex,
  dailyItem,
  dayKey,
  dayKeyToDate,
  daysBetween,
  hashString,
  isDayKey,
  msUntilNextDay,
  puzzleNumber,
  seededRandom,
  seededShuffle,
  weekdayOf,
} from '../src/games/daily.js';
import { isRestDay, streakDays, summarizeStreak } from '../src/games/streak-model.js';

describe('day keys', () => {
  it('reads the calendar day in the given time zone', () => {
    // 03:30 UTC on 24 November is still the 23rd in New York.
    const instant = Date.UTC(2026, 10, 24, 3, 30);
    expect(dayKey(instant, 'UTC')).toBe('2026-11-24');
    expect(dayKey(instant, 'America/New_York')).toBe('2026-11-23');
    expect(dayKey(new Date(instant), 'Asia/Tokyo')).toBe('2026-11-24');
    expect(isDayKey(dayKey())).toBe(true);
  });

  it('validates keys, including impossible dates', () => {
    expect(isDayKey('2026-02-28')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-2-3')).toBe(false);
    expect(isDayKey(20261124)).toBe(false);
  });

  it('adds days across months, years and clock changes', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09'); // US clocks change on the 8th
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364);
    expect(daysBetween('2026-01-02', '2026-01-01')).toBe(-1);
  });

  it('names the weekday and turns a key into midnight UTC', () => {
    expect(weekdayOf('2026-11-24')).toBe(2); // a Tuesday
    expect(dayKeyToDate('2026-11-24').toISOString()).toBe('2026-11-24T00:00:00.000Z');
    expect(() => addDays('24/11/2026', 1)).toThrow(RangeError);
  });

  it('numbers puzzles from the first day', () => {
    expect(puzzleNumber('2026-11-24', '2026-11-24')).toBe(1);
    expect(puzzleNumber('2026-12-01', '2026-11-24')).toBe(8);
    expect(puzzleNumber('2026-11-23', '2026-11-24')).toBe(0);
  });
});

describe('seeded order', () => {
  it('hashes and generates the same numbers for the same seed', () => {
    expect(hashString('daily')).toBe(hashString('daily'));
    expect(hashString('a')).not.toBe(hashString('b'));
    const a = seededRandom('x');
    const b = seededRandom(hashString('x'));
    const run = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(run);
    for (const n of run) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it('shuffles without losing or adding items', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = seededShuffle(items, 'seed');
    expect([...out].sort()).toEqual(items);
    expect(seededShuffle(items, 'seed')).toEqual(out);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('walks the pool in sequence', () => {
    const opts = { firstDay: '2026-11-24' };
    expect(dailyIndex('2026-11-24', 3, opts)).toBe(0);
    expect(dailyIndex('2026-11-26', 3, opts)).toBe(2);
    expect(dailyIndex('2026-11-27', 3, opts)).toBe(0);
    expect(dailyIndex('2026-11-23', 3, opts)).toBe(-1);
    expect(dailyIndex('2026-11-24', 0, opts)).toBe(-1);
  });

  it('deals a shuffled cycle with no repeats, different each cycle', () => {
    const opts = { firstDay: '2026-01-01', order: 'shuffle' as const, seed: 'pack' };
    const cycle = (c: number) =>
      Array.from({ length: 10 }, (_, i) => dailyIndex(addDays('2026-01-01', c * 10 + i), 10, opts));
    const first = cycle(0);
    expect([...first].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(cycle(1)).not.toEqual(first);
    expect(cycle(0)).toEqual(first);
    // The default seed is stable too.
    expect(dailyIndex('2026-01-05', 10, { firstDay: '2026-01-01', order: 'shuffle' })).toBe(
      dailyIndex('2026-01-05', 10, { firstDay: '2026-01-01', order: 'shuffle', seed: 'daily' }),
    );
  });

  it('returns the day item, or nothing', () => {
    expect(dailyItem(['a', 'b'], '2026-11-25', { firstDay: '2026-11-24' })).toBe('b');
    expect(dailyItem([], '2026-11-25', { firstDay: '2026-11-24' })).toBeUndefined();
  });
});

describe('msUntilNextDay', () => {
  it('counts down to midnight in the zone', () => {
    const at = Date.UTC(2026, 10, 24, 22, 0, 0, 500);
    expect(msUntilNextDay(at, 'UTC')).toBe(2 * 3_600_000 - 500);
    // 22:00 UTC is 17:00 in New York: seven hours left there.
    expect(msUntilNextDay(new Date(at), 'America/New_York')).toBe(7 * 3_600_000 - 500);
    const left = msUntilNextDay();
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(86_400_000);
  });
});

describe('streaks', () => {
  // 2026-11-21 is a Saturday.
  const SAT = { weekdays: [6] };
  // Without a protection rule there are no shields to hold or earn.
  const NO_SHIELDS = { shields: 0, shieldsUsed: 0, nextShieldIn: null };

  it('counts a run that ends today or yesterday, with today still open', () => {
    const played = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'];
    expect(summarizeStreak(played, '2026-11-23')).toEqual({ current: 4, best: 4, status: 'played', total: 4, ...NO_SHIELDS });
    expect(summarizeStreak(played, '2026-11-24')).toEqual({ current: 4, best: 4, status: 'pending', total: 4, ...NO_SHIELDS });
    expect(summarizeStreak(played, '2026-11-25')).toMatchObject({ current: 0, best: 4, status: 'none' });
  });

  it('passes over rest days the player skips and counts the ones they play', () => {
    const skipped = ['2026-11-19', '2026-11-20', '2026-11-22'];
    expect(summarizeStreak(skipped, '2026-11-22', SAT)).toMatchObject({ current: 3, status: 'played' });
    expect(summarizeStreak(skipped, '2026-11-22')).toMatchObject({ current: 1, best: 2 });
    const playedAnyway = ['2026-11-20', '2026-11-21', '2026-11-22'];
    expect(summarizeStreak(playedAnyway, '2026-11-22', SAT).current).toBe(3);
    expect(summarizeStreak(['2026-11-24'], '2026-11-26', { dates: ['2026-11-25'] }).status).toBe('pending');
  });

  it('says when today is a rest day', () => {
    expect(summarizeStreak(['2026-11-20'], '2026-11-21', SAT)).toMatchObject({ current: 1, status: 'resting' });
    expect(summarizeStreak(['2026-11-10'], '2026-11-21', SAT)).toMatchObject({ current: 0, status: 'none' });
    expect(summarizeStreak([], '2026-11-21', SAT)).toEqual({ current: 0, best: 0, status: 'resting', total: 0, ...NO_SHIELDS });
    expect(summarizeStreak([], '2026-11-24')).toEqual({ current: 0, best: 0, status: 'none', total: 0, ...NO_SHIELDS });
  });

  it('ignores duplicates, bad keys and days after today', () => {
    expect(summarizeStreak(['2026-11-24', '2026-11-24', 'nope', '2026-11-30'], '2026-11-24')).toEqual({
      current: 1,
      best: 1,
      status: 'played',
      total: 1,
      ...NO_SHIELDS,
    });
  });

  it('knows a rest day by weekday or date', () => {
    expect(isRestDay('2026-11-21')).toBe(false);
    expect(isRestDay('2026-11-21', SAT)).toBe(true);
    expect(isRestDay('2026-12-25', { dates: ['2026-12-25'] })).toBe(true);
    expect(isRestDay('2026-12-24', { dates: ['2026-12-25'] })).toBe(false);
  });

  it('lays out the strip of recent days', () => {
    const strip = streakDays(['2026-11-19', '2026-11-20', '2026-11-22'], '2026-11-24', {
      length: 7,
      after: 2,
      rest: SAT,
    });
    expect(strip.map((d) => d.state)).toEqual([
      'missed', // 18
      'played', // 19
      'played', // 20
      'rest', // 21
      'played', // 22
      'missed', // 23
      'open', // 24
      'future',
      'future',
    ]);
    expect(strip.filter((d) => d.today).map((d) => d.day)).toEqual(['2026-11-24']);
    expect(streakDays([], '2026-11-24')).toHaveLength(7);
  });
});
