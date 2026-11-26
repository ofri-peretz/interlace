/**
 * Workshop models under hostile and random input: the recap link, the interest board, the
 * commitment check-in and the session composer. Seeded, so a failure reproduces.
 */
import { describe, expect, it } from 'vitest';
import { commitmentImpact, DAY_MS, followUpState } from '../src/patterns/commitment-model.js';
import { rankInterest } from '../src/patterns/interest-model.js';
import { decodeRecap, encodeRecap, MAX_RECAP_TOKEN, validRecap } from '../src/patterns/recap-model.js';
import {
  addToPlan,
  canMove,
  fitsPlan,
  movePlan,
  removeFromPlan,
  summarizePlan,
} from '../src/patterns/session-plan-model.js';

let seed = 20261125;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const int = (n: number) => Math.floor(rnd() * n);
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_+/=.% אا😀';
const junk = (n: number) => Array.from({ length: n }, () => ALPHABET[int(ALPHABET.length)]).join('');

describe('recap link', () => {
  it('never throws, and decodes only what it can fully check', () => {
    for (let i = 0; i < 3000; i++) {
      const token = junk(int(80));
      expect(() => decodeRecap(token)).not.toThrow();
      const out = decodeRecap(token);
      if (out) expect(validRecap(out)).toEqual(out);
    }
    expect(decodeRecap('A'.repeat(MAX_RECAP_TOKEN + 1))).toBeNull();
  });

  it('round-trips real recaps, and drops hand-added or poisoned fields', () => {
    for (let i = 0; i < 300; i++) {
      const data = {
        session: junk(1 + int(40)),
        at: int(2) ? 1_700_000_000_000 + int(1e9) : undefined,
        commitment: int(2) ? junk(1 + int(100)) : undefined,
        interests: int(2) ? Array.from({ length: int(6) }, () => junk(1 + int(10))) : undefined,
        points: int(2) ? int(10_000) : undefined,
      };
      const token = encodeRecap(data);
      if (token) expect(decodeRecap(token)).toEqual(validRecap(data));
    }
    const poisoned = Buffer.from(
      JSON.stringify({ v: 1, session: 'S', __proto__: { admin: true }, points: -5, extra: 'x' }),
    ).toString('base64url');
    const out = decodeRecap(poisoned) as Record<string, unknown>;
    expect(out).toEqual({ session: 'S' });
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });
});

describe('interest board', () => {
  it('ranks any counts without throwing, never below zero, shares in 0..1', () => {
    const ids = ['a', 'b', 'c', 'constructor', '__proto__', 'toString'];
    for (let i = 0; i < 1000; i++) {
      const counts: Record<string, number> = {};
      for (const id of ids) if (int(2)) counts[id] = [NaN, -3, Infinity, 2.7, int(50), 1e12][int(6)] as number;
      const r = rankInterest(ids, counts, {
        mine: int(2) ? ['a', 'zzz'] : [],
        minCount: int(4),
        top: int(2) ? int(5) : undefined,
      });
      for (const row of r.rows) {
        expect(row.count).toBeGreaterThan(0);
        expect(row.share).toBeGreaterThan(0);
        expect(row.share).toBeLessThanOrEqual(1);
      }
      expect(Number.isFinite(r.total)).toBe(true);
    }
  });
});

describe('commitment check-in', () => {
  it('moves waiting → due → lapsed, answered wins, and rates stay in 0..1', () => {
    const c = { choice: 'Talk to one person', madeAt: 0 };
    expect(followUpState(c, 6 * DAY_MS)).toBe('waiting');
    expect(followUpState(c, 7 * DAY_MS)).toBe('due');
    expect(followUpState(c, 21 * DAY_MS)).toBe('lapsed');
    expect(followUpState({ ...c, checkIn: { answer: 'done', at: 1 } }, 99 * DAY_MS)).toBe('answered');
    expect(followUpState({ ...c, checkIn: { answer: 'hacked' as never, at: 1 } }, 7 * DAY_MS)).toBe('due');
    const answers = ['done', 'partly', 'not-yet', 'bogus', undefined] as const;
    const records = Array.from({ length: 500 }, () => {
      const a = answers[int(answers.length)];
      return { choice: junk(1 + int(3)), madeAt: int(1e6), checkIn: a ? { answer: a as never, at: 1 } : null };
    });
    const impact = commitmentImpact(records);
    expect(impact.answered).toBe(impact.done + impact.partly + impact.notYet);
    expect(impact.responseRate!).toBeLessThanOrEqual(1);
    expect(impact.followThrough!).toBeLessThanOrEqual(1);
  });
});

describe('session composer', () => {
  it('any sequence of clicks keeps the plan valid: known, unique, required in, never over', () => {
    for (let run = 0; run < 200; run++) {
      const modules = Array.from({ length: 3 + int(8) }, (_, i) => ({
        id: `m${i}`,
        minutes: [15, 20, 30, 45, 60, NaN, -10][int(7)] as number,
      }));
      const required = int(2) ? ['m0'] : [];
      const options = { maxMinutes: [null, 90, 120, 180][int(4)] ?? null, required };
      let ids = summarizePlan(modules, [], options).ids;
      for (let step = 0; step < 40; step++) {
        const id = `m${int(modules.length + 2)}`; // sometimes unknown
        const what = int(3);
        if (what === 0 && fitsPlan(modules, ids, id, options)) ids = addToPlan(modules, ids, id, options);
        else if (what === 1) ids = removeFromPlan(modules, ids, id, options);
        else {
          const delta = int(2) ? 1 : -1;
          if (canMove(modules, ids, id, delta, options)) ids = movePlan(modules, ids, id, delta, options);
        }
        const s = summarizePlan(modules, ids, options);
        expect(new Set(s.ids).size).toBe(s.ids.length);
        for (const r of required) expect(s.ids).toContain(r);
        for (const x of s.ids) expect(modules.some((m) => m.id === x)).toBe(true);
        expect(Number.isFinite(s.minutes)).toBe(true);
        const requiredMinutes = summarizePlan(modules, required, options).minutes;
        if (options.maxMinutes && requiredMinutes <= options.maxMinutes) expect(s.over).toBe(0);
      }
    }
  });
});
