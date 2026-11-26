/**
 * Progress locks: streak shields, XP and levels, the daily goal, milestones
 * and the daily reminder file. All pure, so the same numbers come out on a
 * phone, a page and a server.
 */
import { describe, expect, it } from 'vitest';

import { streakDays, summarizeStreak } from '../src/games/streak-model.js';
import {
  DEFAULT_STREAK_MILESTONES,
  gainXp,
  goalDays,
  goalOn,
  lastMilestone,
  levelFor,
  levelSpan,
  milestonesCrossed,
  nextMilestone,
  totalXp,
  xpOn,
} from '../src/games/progress-model.js';
import { escapeIcsText, foldIcsLine, isReminderTime, reminderIcs } from '../src/games/reminder-model.js';
import { shareText } from '../src/games/share-model.js';
import { milestoneWindow } from '../src/games/milestones.js';

const run = (from: string, n: number) => {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00Z`);
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
};

describe('streak shields', () => {
  const P = { every: 3, max: 2 };

  it('earns one shield per `every` days played, up to `max`', () => {
    expect(summarizeStreak(run('2026-11-01', 2), '2026-11-02', undefined, P)).toMatchObject({
      shields: 0,
      nextShieldIn: 1,
    });
    expect(summarizeStreak(run('2026-11-01', 3), '2026-11-03', undefined, P)).toMatchObject({
      shields: 1,
      nextShieldIn: 3,
    });
    expect(summarizeStreak(run('2026-11-01', 9), '2026-11-09', undefined, P)).toMatchObject({
      shields: 2,
      nextShieldIn: null,
    });
  });

  it('spends a shield on a missed day and keeps the run', () => {
    const played = [...run('2026-11-01', 3), '2026-11-05'];
    const s = summarizeStreak(played, '2026-11-05', undefined, P);
    expect(s).toMatchObject({ current: 4, shields: 0, shieldsUsed: 1, status: 'played' });
    const days = streakDays(played, '2026-11-05', { length: 5, protection: P });
    expect(days.map((d) => d.state)).toEqual(['played', 'played', 'played', 'shielded', 'played']);
  });

  it('ends the run when no shield is left, and keeps earned shields after it', () => {
    const played = [...run('2026-11-01', 3), '2026-11-06'];
    const s = summarizeStreak(played, '2026-11-06', undefined, P);
    // 4th covered by the shield, 5th missed with none left: the run restarts on the 6th.
    expect(s).toMatchObject({ current: 1, best: 3, shields: 0, shieldsUsed: 1 });
    const kept = summarizeStreak([...run('2026-11-01', 6), '2026-11-09'], '2026-11-09', undefined, P);
    expect(kept).toMatchObject({ current: 7, shields: 0, shieldsUsed: 2 });
  });

  it('never spends a shield on today, a rest day, or without a run', () => {
    const s = summarizeStreak(run('2026-11-01', 3), '2026-11-04', { weekdays: [] }, P);
    expect(s).toMatchObject({ shields: 1, shieldsUsed: 0, status: 'pending' });
    // Saturday 2026-11-07 is a rest day.
    const rest = summarizeStreak([...run('2026-11-04', 3), '2026-11-08'], '2026-11-08', { weekdays: [6] }, P);
    expect(rest).toMatchObject({ current: 4, shieldsUsed: 0, shields: 1 });
  });

  it('ignores a protection rule that cannot earn anything', () => {
    expect(summarizeStreak(run('2026-11-01', 5), '2026-11-05', undefined, { every: 0, max: 2 })).toMatchObject({
      shields: 0,
      nextShieldIn: null,
    });
    expect(summarizeStreak([], '2026-11-05', undefined, P)).toMatchObject({
      current: 0,
      shields: 0,
      nextShieldIn: 3,
    });
  });
});

describe('progress model', () => {
  it('levels follow the curve', () => {
    expect(levelSpan(1)).toBe(100);
    expect(levelSpan(3)).toBe(200);
    expect(levelSpan(0)).toBe(100);
    expect(levelFor(0)).toMatchObject({ level: 1, into: 0, span: 100, progress: 0, toNext: 100 });
    expect(levelFor(99)).toMatchObject({ level: 1, into: 99 });
    expect(levelFor(100)).toMatchObject({ level: 2, into: 0, span: 150 });
    expect(levelFor(260)).toMatchObject({ level: 3, into: 10, toNext: 190 });
    expect(levelFor(25, { first: 10, step: 0 })).toMatchObject({ level: 3, into: 5 });
    expect(levelFor(5, { first: 0 })).toMatchObject({ level: 1, span: 100 });
    expect(levelFor(Number.NaN)).toMatchObject({ level: 1, total: 0 });
    expect(levelFor(-5)).toMatchObject({ level: 1, total: 0 });
  });

  it('adds up XP by day and in all, skipping bad entries', () => {
    const entries = [
      { day: '2026-11-01', xp: 10 },
      { day: '2026-11-01', xp: 5 },
      { day: '2026-11-02', xp: 20 },
      { day: 'nope', xp: 100 },
      { day: '2026-11-02', xp: -3 },
    ];
    expect(totalXp(entries)).toBe(35);
    expect(xpOn(entries, '2026-11-01')).toBe(15);
    expect(goalOn(entries, '2026-11-01', 20)).toEqual({ earned: 15, goal: 20, met: false, progress: 0.75, left: 5 });
    expect(goalOn(entries, '2026-11-02', 20)).toMatchObject({ met: true, progress: 1, left: 0 });
    expect(goalOn(entries, '2026-11-03', 0)).toMatchObject({ met: true, goal: 0, progress: 1 });
    expect(goalDays(entries, 20)).toEqual(['2026-11-02']);
    expect(goalDays(entries, 0)).toEqual(['2026-11-01', '2026-11-02']);
  });

  it('finds milestones crossed, next and last', () => {
    expect(milestonesCrossed(2, 7, DEFAULT_STREAK_MILESTONES)).toEqual([3, 7]);
    expect(milestonesCrossed(7, 7, DEFAULT_STREAK_MILESTONES)).toEqual([]);
    expect(nextMilestone(7, [30, 7, 14])).toBe(14);
    expect(nextMilestone(400, DEFAULT_STREAK_MILESTONES)).toBeUndefined();
    expect(lastMilestone(20, DEFAULT_STREAK_MILESTONES)).toBe(14);
    expect(lastMilestone(1, DEFAULT_STREAK_MILESTONES)).toBeUndefined();
  });

  it('says what a gain did', () => {
    expect(gainXp(90, 20)).toMatchObject({ gained: 20, levelsUp: 1, before: { level: 1 }, after: { level: 2, into: 10 } });
    expect(gainXp(0, -4)).toMatchObject({ gained: 0, levelsUp: 0 });
  });

  it('draws a window of milestones around the next one', () => {
    const steps = [3, 7, 14, 30, 50, 100];
    expect(milestoneWindow(0, steps)).toEqual([3, 7, 14, 30, 50]);
    expect(milestoneWindow(20, steps)).toEqual([7, 14, 30, 50, 100]);
    expect(milestoneWindow(500, steps, 2, 3)).toEqual([30, 50, 100]);
    expect(milestoneWindow(5, [7, 3, 3], 0, 0)).toEqual([7]);
  });
});

describe('share text with a note', () => {
  it('adds the note after the marks line', () => {
    expect(shareText({ title: 'Sample game', results: [], note: '7-day streak', url: 'https://example.com' })).toBe(
      'Sample game\n\n7-day streak\nhttps://example.com',
    );
  });
});

describe('reminder file', () => {
  const now = new Date('2026-11-25T10:00:00Z');

  it('is a daily event at the chosen local time with an alert', () => {
    const ics = reminderIcs({
      title: 'Sample game, today',
      description: 'One question; two minutes',
      url: 'https://example.com/play',
      time: '18:30',
      start: '2026-11-26',
      uid: 'daily@example.com',
      now,
    });
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('DTSTART:20261126T183000');
    expect(lines).toContain('DTEND:20261126T184000');
    expect(lines).toContain('RRULE:FREQ=DAILY');
    expect(lines).toContain('DTSTAMP:20261125T100000Z');
    expect(lines).toContain('SUMMARY:Sample game\\, today');
    expect(lines).toContain('DESCRIPTION:One question\\; two minutes');
    expect(lines).toContain('TRIGGER:PT0M');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('ends at 23:59 when it would run past midnight, and rejects bad input', () => {
    const ics = reminderIcs({ title: 'Late', time: '23:55', start: '2026-11-26', uid: 'x', minutes: 30, now });
    expect(ics).toContain('DTEND:20261126T235900');
    expect(ics).not.toContain('URL:');
    expect(reminderIcs({ title: 'T', time: '07:05', start: '2026-11-26', uid: 'x' })).toContain('DTSTART:20261126T070500');
    expect(() => reminderIcs({ title: 'T', time: '25:00', start: '2026-11-26', uid: 'x' })).toThrow(RangeError);
    expect(() => reminderIcs({ title: 'T', time: '10:00', start: '26/11', uid: 'x' })).toThrow(RangeError);
    expect(isReminderTime('9:00')).toBe(false);
    expect(isReminderTime('09:00')).toBe(true);
  });

  it('escapes text and folds long lines at 75 octets', () => {
    expect(escapeIcsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
    const folded = foldIcsLine(`SUMMARY:${'é'.repeat(80)}`);
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').slice(1).every((p) => p.startsWith(' '))).toBe(true);
    expect(foldIcsLine('short')).toBe('short');
  });
});
