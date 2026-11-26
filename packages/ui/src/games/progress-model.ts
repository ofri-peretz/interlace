/**
 * @interlace/ui — games/progress-model
 *
 * The numbers behind a sense of progress: experience points (XP) and the
 * level they add up to, a daily goal, and milestones worth marking. Pure:
 * give it what the player earned and on which day; it returns where they
 * stand. A game decides what earns XP; this file only adds it up, so a
 * server can check the same numbers a screen shows.
 *
 * ## XP rewards showing up
 *
 * A game that pays for "right" teaches people to say they were right. Give
 * XP for finishing things, and keep honest self-ratings out of it.
 *
 * ## Levels
 *
 * Level 1 starts at 0 XP. Each level costs `first + step × (level − 1)` XP
 * to finish (100, 150, 200… by default), so early levels come quickly and
 * later ones stay within reach.
 *
 * ## Daily goal
 *
 * The XP a player means to earn each day. `goalOn` says how far today is;
 * `goalDays` lists the days the goal was met, which `summarizeStreak` can
 * turn into a goal streak.
 *
 * ## Milestones
 *
 * A milestone is a value worth marking (a 7-day streak, level 5).
 * `milestonesCrossed` returns the ones a change passed, so a screen
 * celebrates each once, at the moment it happens, and never on a reload.
 */

import { isDayKey, type DayKey } from './daily.js';

/** XP earned on one day. Several entries for the same day add up. */
export interface XpEntry {
  day: DayKey;
  xp: number;
}

export interface LevelCurve {
  /** XP to finish level 1. @default 100 */
  first: number;
  /** Extra XP each later level costs. @default 50 */
  step: number;
}

export const DEFAULT_LEVEL_CURVE: LevelCurve = { first: 100, step: 50 };

export interface Level {
  /** 1-based. */
  level: number;
  /** XP earned inside this level. */
  into: number;
  /** XP this level takes to finish. */
  span: number;
  /** `into / span`, 0 to 1. */
  progress: number;
  /** XP still needed for the next level. */
  toNext: number;
  /** All XP, the input. */
  total: number;
}

const clean = (xp: number) => (Number.isFinite(xp) && xp > 0 ? xp : 0);

function curveOf(curve?: Partial<LevelCurve>): LevelCurve {
  const first = clean(curve?.first ?? DEFAULT_LEVEL_CURVE.first) || DEFAULT_LEVEL_CURVE.first;
  const step = clean(curve?.step ?? DEFAULT_LEVEL_CURVE.step);
  return { first, step };
}

/** XP to finish `level` (1-based) on this curve. */
export function levelSpan(level: number, curve?: Partial<LevelCurve>): number {
  const c = curveOf(curve);
  return c.first + c.step * (Math.max(1, Math.floor(level)) - 1);
}

/** The level a total of XP reaches, and how far into it. */
export function levelFor(totalXp: number, curve?: Partial<LevelCurve>): Level {
  const total = clean(totalXp);
  let level = 1;
  let left = total;
  let span = levelSpan(1, curve);
  while (left >= span) {
    left -= span;
    level += 1;
    span = levelSpan(level, curve);
  }
  return { level, into: left, span, progress: left / span, toNext: span - left, total };
}

/** Every valid entry's XP, added up. */
export function totalXp(entries: Iterable<XpEntry>): number {
  let sum = 0;
  for (const e of entries) if (isDayKey(e.day)) sum += clean(e.xp);
  return sum;
}

/** XP earned on one day. */
export function xpOn(entries: Iterable<XpEntry>, day: DayKey): number {
  let sum = 0;
  for (const e of entries) if (e.day === day) sum += clean(e.xp);
  return sum;
}

export interface GoalProgress {
  earned: number;
  goal: number;
  met: boolean;
  /** 0 to 1, capped at 1. */
  progress: number;
  /** XP still needed today; 0 once met. */
  left: number;
}

/** How far a day is toward the goal. A goal of 0 or less counts as met. */
export function goalOn(entries: Iterable<XpEntry>, day: DayKey, goal: number): GoalProgress {
  const earned = xpOn(entries, day);
  const g = clean(goal);
  if (g === 0) return { earned, goal: 0, met: true, progress: 1, left: 0 };
  return { earned, goal: g, met: earned >= g, progress: Math.min(1, earned / g), left: Math.max(0, g - earned) };
}

/** The days the goal was met, sorted. Feed them to `summarizeStreak` for a goal streak. */
export function goalDays(entries: Iterable<XpEntry>, goal: number): DayKey[] {
  const byDay = new Map<DayKey, number>();
  for (const e of entries) if (isDayKey(e.day)) byDay.set(e.day, (byDay.get(e.day) ?? 0) + clean(e.xp));
  const g = clean(goal);
  return [...byDay].filter(([, xp]) => xp > 0 && xp >= g).map(([day]) => day).sort();
}

/** Streak lengths worth marking. */
export const DEFAULT_STREAK_MILESTONES: readonly number[] = [3, 7, 14, 30, 50, 100, 200, 365];

/** The milestones a change from `before` to `after` passed, smallest first. */
export function milestonesCrossed(before: number, after: number, steps: readonly number[]): number[] {
  return [...steps].filter((s) => s > before && s <= after).sort((a, b) => a - b);
}

/** The first milestone above `value`, or undefined past the last. */
export function nextMilestone(value: number, steps: readonly number[]): number | undefined {
  return [...steps].sort((a, b) => a - b).find((s) => s > value);
}

/** The highest milestone reached, or undefined before the first. */
export function lastMilestone(value: number, steps: readonly number[]): number | undefined {
  return [...steps].sort((a, b) => b - a).find((s) => s <= value);
}

export interface XpGain {
  before: Level;
  after: Level;
  gained: number;
  /** Levels finished by this gain (0 most of the time). */
  levelsUp: number;
}

/** What one gain did: the level before and after, and how many levels it finished. */
export function gainXp(totalBefore: number, gained: number, curve?: Partial<LevelCurve>): XpGain {
  const before = levelFor(totalBefore, curve);
  const g = clean(gained);
  const after = levelFor(before.total + g, curve);
  return { before, after, gained: g, levelsUp: after.level - before.level };
}
