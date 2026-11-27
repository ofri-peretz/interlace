/**
 * The activities where each person gives one answer, on a room: the rule behind all of them, and each
 * one's own check of what a phone may send.
 */
import { describe, expect, it } from 'vitest';

import {
  DOTS_KEY, PIN_KEY, POINTS_KEY, PREDICTION_KEY, QUADRANT_KEY, RANKING_KEY, RATING_KEY, TYPED_KEY,
  collectActivity, dotsActivity, dotsSpec, pinActivity, pinSpec, pointsActivity, pointsSpec, predictionActivity,
  predictionSpec, quadrantActivity, quadrantSpec, rankingActivity, rankingSpec, ratingActivity, ratingSpec,
  readCollected, readDots, readPin, readPoints, readPrediction, readQuadrant, readRanking, readRating, readTyped,
  typedActivity, typedSpec,
} from '../src/games/live-collect-model.js';
import type { ActivityReducer } from '../src/games/room-model.js';

const players = ['p1', 'p2', 'p3'].map((id) => ({ id, name: id, connected: true }));
const ctx = (playerId: string, host = false) => ({ playerId, host, at: 1, players });
const run = (r: ActivityReducer, slice: unknown, action: unknown, who = 'p1', host = false) => r(slice, action, ctx(who, host));
const started = (r: ActivityReducer, start: Record<string, unknown>) => (run(r, null, { type: 'start', ...start }, 'host', true) as { slice: unknown }).slice;
const room = (key: string, slice: unknown, ids = ['p1', 'p2']) => ({ shared: { [key]: slice }, players: ids.map((id) => ({ id, name: id, connected: true })) });

interface Case {
  name: string;
  key: string;
  activity: ActivityReducer;
  read: (r: ReturnType<typeof room> | null) => { entries: Record<string, unknown>; open: boolean; revealed: unknown } | null;
  start: Record<string, unknown>;
  badStarts: Record<string, unknown>[];
  good: unknown;
  other: unknown;
  bad: unknown[];
  once?: boolean;
}

const CASES: Case[] = [
  { name: 'rating', key: RATING_KEY, activity: ratingActivity, read: readRating, start: { min: 1, max: 5 }, badStarts: [{ min: 5, max: 5 }, { min: 1.5 }, { max: 11 }, { min: -1 }, { min: 'x' }], good: 4, other: 2, bad: [0, 6, 2.5, '4', null, NaN] },
  { name: 'quadrant', key: QUADRANT_KEY, activity: quadrantActivity, read: readQuadrant, start: {}, badStarts: [], good: { x: 20, y: 80 }, other: { x: 70, y: 10 }, bad: [null, 'x', { x: 'a', y: 1 }, { x: 1 }, 5, []] },
  { name: 'pin', key: PIN_KEY, activity: pinActivity, read: readPin, start: {}, badStarts: [], good: { x: 30, y: 40 }, other: { x: 90, y: 5 }, bad: [null, { x: NaN, y: 1 }, 'x', 7] },
  { name: 'ranking', key: RANKING_KEY, activity: rankingActivity, read: readRanking, start: { items: ['a', 'b', 'c'] }, badStarts: [{ items: ['a'] }, { items: ['a', 'a'] }, { items: 'abc' }, { items: ['a', 'b c'] }, {}, { items: Array.from({ length: 13 }, (_, i) => `i${i}`) }], good: ['c', 'a', 'b'], other: ['a', 'b', 'c'], bad: [['a', 'b'], ['a', 'a', 'b'], ['a', 'b', 'z'], 'abc', [1, 2, 3], null] },
  { name: 'points', key: POINTS_KEY, activity: pointsActivity, read: readPoints, start: { options: ['a', 'b'], budget: 100, step: 10 }, badStarts: [{ options: ['a'] }, { options: ['a', 'b'], budget: 0 }, { options: ['a', 'b'], step: 'x' }, { options: ['a', 'b'], partial: 'yes' }], good: { a: 60, b: 40 }, other: { a: 10, b: 90 }, bad: [{ a: 60 }, { a: 60, b: 60 }, { a: 65, b: 35 }, { a: 100, z: 0 }, { a: -10, b: 110 }, { a: 'x', b: 100 }, null, 'x'] },
  { name: 'dots', key: DOTS_KEY, activity: dotsActivity, read: readDots, start: { ideas: ['a', 'b', 'c'], dots: 3, maxPerIdea: 2 }, badStarts: [{ ideas: ['a'] }, { ideas: ['a', 'b'], dots: 0 }, { ideas: ['a', 'b'], dots: 21 }, { ideas: ['a', 'b'], maxPerIdea: 'x' }], good: { a: 2, b: 1 }, other: { c: 2 }, bad: [{}, { zzz: 2 }, null, 'x', []] },
  { name: 'prediction', key: PREDICTION_KEY, activity: predictionActivity, read: readPrediction, start: { options: ['yes', 'no'] }, badStarts: [{ options: ['yes'] }, { options: 'no' }], good: 'yes', other: 'no', bad: ['maybe', 3, null], once: true },
  { name: 'typed answer', key: TYPED_KEY, activity: typedActivity(), read: (r) => readTyped(r), start: {}, badStarts: [], good: 'Haifa', other: 'Tel Aviv', bad: ['', '   ', 'see https://example.com', 'call 555 123 4567', 'x'.repeat(81), 7, null], once: true },
];

describe.each(CASES)('$name on the room', (c) => {
  const begin = () => started(c.activity, c.start);

  it('lets only the host start, with a usable shape', () => {
    expect(run(c.activity, null, { type: 'start', ...c.start }, 'p1')).toEqual({ refuse: 'not-host' });
    expect(run(c.activity, null, { type: 'start', ...c.start }, 'host', true)).toMatchObject({ slice: { open: true, entries: {}, revealed: null } });
    for (const bad of c.badStarts) expect(run(c.activity, null, { type: 'start', ...bad }, 'host', true)).toEqual({ refuse: 'bad-action' });
  });

  it('takes a phone\'s answer, as the player the room says sent it', () => {
    const a = run(c.activity, begin(), { type: 'send', value: c.good }) as { slice: { entries: Record<string, unknown> } };
    expect(a.slice.entries.p1).toBeDefined();
    const b = run(c.activity, a.slice, { type: 'send', value: c.good }, 'p2') as { slice: { entries: Record<string, unknown> } };
    expect(Object.keys(b.slice.entries)).toEqual(['p1', 'p2']);
  });

  it(c.once ? 'keeps the first answer: a second is refused' : 'replaces a person\'s answer when they send another', () => {
    const a = run(c.activity, begin(), { type: 'send', value: c.good }) as { slice: unknown };
    const b = run(c.activity, a.slice, { type: 'send', value: c.other });
    if (c.once) expect(b).toEqual({ refuse: 'bad-action' });
    else expect(JSON.stringify((b as { slice: { entries: unknown } }).slice.entries)).toBe(JSON.stringify({ p1: (c.read(room(c.key, (b as { slice: unknown }).slice)) as { entries: Record<string, unknown> }).entries.p1 }));
    const read = c.read(room(c.key, (c.once ? a : (b as { slice: unknown })).slice ?? (c.once ? (a as { slice: unknown }).slice : null)));
    expect(read?.entries.p1).toBeDefined();
  });

  it('refuses an answer that does not fit, the host answering, and an answer before it starts', () => {
    for (const value of c.bad) expect(run(c.activity, begin(), { type: 'send', value })).toEqual({ refuse: 'bad-action' });
    expect(run(c.activity, begin(), { type: 'send', value: c.good }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(c.activity, null, { type: 'send', value: c.good })).toEqual({ refuse: 'wrong-phase' });
    expect(run(c.activity, { junk: 1 }, { type: 'send', value: c.good })).toEqual({ refuse: 'wrong-phase' });
  });

  it('stops taking answers when the host closes it, and takes them again when it reopens', () => {
    const closed = run(c.activity, begin(), { type: 'open', on: false }, 'host', true) as { slice: unknown };
    expect(run(c.activity, closed.slice, { type: 'send', value: c.good })).toEqual({ refuse: 'wrong-phase' });
    const open = run(c.activity, closed.slice, { type: 'open', on: true }, 'host', true) as { slice: unknown };
    expect(run(c.activity, open.slice, { type: 'send', value: c.good })).toMatchObject({ slice: {} });
    expect(run(c.activity, begin(), { type: 'open', on: 'x' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(c.activity, begin(), { type: 'open', on: false })).toEqual({ refuse: 'not-host' });
    expect(run(c.activity, null, { type: 'open', on: false }, 'host', true)).toEqual({ refuse: 'wrong-phase' });
  });

  it('clears the answers for the host only, and reopens', () => {
    const full = { ...(begin() as object), entries: { p1: c.good }, open: false };
    expect(run(c.activity, full, { type: 'clear' }, 'host', true)).toMatchObject({ slice: { entries: {}, open: true } });
    expect(run(c.activity, full, { type: 'clear' })).toEqual({ refuse: 'not-host' });
    expect(run(c.activity, null, { type: 'clear' }, 'host', true)).toEqual({ refuse: 'wrong-phase' });
  });

  it('refuses what is not the shape of a move', () => {
    for (const action of [null, 'send', 3, [], {}, { type: 1 }, { type: 'dance' }]) expect(run(c.activity, begin(), action)).toEqual({ refuse: 'bad-action' });
  });

  it('reads the room as untrusted, and drops people who left', () => {
    expect(c.read(null)).toBeNull();
    expect(c.read({ shared: {}, players: [] })).toBeNull();
    for (const slice of [5, null, { meta: 1, entries: {} }, { meta: {}, entries: 'x' }, { entries: {} }]) {
      if (c.name === 'quadrant' || c.name === 'pin' || c.name === 'typed answer') {
        if (typeof slice === 'object' && slice && 'meta' in slice && (slice as { meta: unknown }).meta === 1) expect(c.read(room(c.key, slice))).toBeNull();
        continue;
      }
      expect(c.read(room(c.key, slice))).toBeNull();
    }
    const slice = { ...(begin() as object), entries: { p1: c.good, gone: c.good, p2: c.bad[0], '': c.good }, open: false };
    const read = c.read(room(c.key, slice, ['p1', 'p2']));
    expect(Object.keys(read?.entries ?? {})).toEqual(['p1']); // gone left, p2's is not an answer, '' is not a player
    expect(read?.open).toBe(false);
    expect(c.read(room(c.key, { ...(begin() as object), entries: {} }))?.open).toBe(true);
  });
});

describe('what only some of them have', () => {
  it('pin: the host reveals the right place, which closes it; a phone may not', () => {
    const s = started(pinActivity, {});
    const r = run(pinActivity, s, { type: 'reveal', value: { x: 55, y: 45 } }, 'host', true) as { slice: { open: boolean; revealed: unknown } };
    expect(r.slice).toMatchObject({ open: false, revealed: { x: 55, y: 45 } });
    expect(readPin(room(PIN_KEY, r.slice))?.revealed).toEqual({ x: 55, y: 45 });
    expect(run(pinActivity, s, { type: 'reveal', value: { x: 1, y: 1 } })).toEqual({ refuse: 'not-host' });
    expect(run(pinActivity, s, { type: 'reveal', value: 'x' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(pinActivity, null, { type: 'reveal', value: { x: 1, y: 1 } }, 'host', true)).toEqual({ refuse: 'wrong-phase' });
    expect(readPin(room(PIN_KEY, { ...(s as object), revealed: 'junk' }))?.revealed).toBeNull();
    expect(run(pinActivity, r.slice, { type: 'clear' }, 'host', true)).toMatchObject({ slice: { revealed: null, open: true } });
  });

  it('prediction: the host reveals the outcome, which must be one of the options', () => {
    const s = started(predictionActivity, { options: ['yes', 'no'] });
    const r = run(predictionActivity, s, { type: 'reveal', value: 'no' }, 'host', true) as { slice: { open: boolean; revealed: unknown } };
    expect(r.slice).toMatchObject({ open: false, revealed: 'no' });
    expect(run(predictionActivity, s, { type: 'reveal', value: 'maybe' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(readPrediction(room(PREDICTION_KEY, r.slice))?.revealed).toBe('no');
  });

  it('the others have no reveal to make', () => {
    const s = started(ratingActivity, {});
    expect(run(ratingActivity, s, { type: 'reveal', value: 3 }, 'host', true)).toEqual({ refuse: 'bad-action' });
  });

  it('typed answer: the consumer\'s rules apply on the host, however the phone behaved', () => {
    const strict = typedActivity({ blocklist: ['badword'], maxLength: 20 });
    const s = started(strict, {});
    expect(run(strict, s, { type: 'send', value: 'a badword here' })).toEqual({ refuse: 'bad-action' });
    expect(run(strict, s, { type: 'send', value: 'x'.repeat(21) })).toEqual({ refuse: 'bad-action' });
    expect(run(strict, s, { type: 'send', value: '  Haifa  ' })).toMatchObject({ slice: { entries: { p1: 'Haifa' } } });
    expect(typedSpec().value('ok', {})).toBe('ok');
  });

  it('points: a split that does not fit the host\'s budget and step is refused; the default is to spend it all', () => {
    const s = started(pointsActivity, { options: ['a', 'b', 'c'], partial: true, budget: 50, step: 5 });
    expect(run(pointsActivity, s, { type: 'send', value: { a: 25 } })).toMatchObject({ slice: {} }); // partial is allowed
    expect(run(pointsActivity, s, { type: 'send', value: { a: 55 } })).toEqual({ refuse: 'bad-action' });
    expect(readPoints(room(POINTS_KEY, s))?.meta).toEqual({ options: ['a', 'b', 'c'], budget: 50, step: 5, partial: true });
    expect(pointsSpec.value(JSON.parse('{"__proto__":10,"a":100}'), { options: ['a'], budget: 100, step: 10, partial: false })).toBeNull();
  });

  it('dots: a ballot is held to the host\'s dots and cap; extra dots are dropped, not refused', () => {
    const s = started(dotsActivity, { ideas: ['a', 'b', 'c'], dots: 3, maxPerIdea: 2 });
    const r = run(dotsActivity, s, { type: 'send', value: { a: 5, b: 5, c: 5 } }) as { slice: { entries: Record<string, Record<string, number>> } };
    expect(r.slice.entries.p1).toEqual({ a: 2, b: 1 });
    expect(dotsSpec.meta({ ideas: ['a', 'b'] })).toEqual({ ideas: ['a', 'b'], dots: 3, maxPerIdea: 3 });
  });

  it('ranking: the room\'s items stay in the order the host gave', () => {
    expect(rankingSpec.meta({ items: ['z', 'a'] })).toEqual({ items: ['z', 'a'] });
    expect(ratingSpec.meta({})).toEqual({ min: 1, max: 5 });
    expect(quadrantSpec.meta({})).toEqual({});
    expect(pinSpec.meta({})).toEqual({});
    expect(predictionSpec.meta({ options: ['a', 'b'] })).toEqual({ options: ['a', 'b'] });
    expect(dotsSpec.value({ a: 1 }, { ideas: ['a', 'b'], dots: 3, maxPerIdea: 3 })).toEqual({ a: 1 });
  });

  it('collectActivity works for any spec', () => {
    const odd = collectActivity<{ n: number }, number>({ meta: (raw) => (typeof raw.n === 'number' ? { n: raw.n } : null), value: (raw, m) => (raw === m.n ? m.n : null) });
    const s = started(odd, { n: 7 });
    expect(run(odd, s, { type: 'send', value: 7 })).toMatchObject({ slice: { entries: { p1: 7 } } });
    expect(run(odd, s, { type: 'send', value: 8 })).toEqual({ refuse: 'bad-action' });
    expect(readCollected(room('k', s), 'k', { meta: (raw) => (typeof raw.n === 'number' ? { n: raw.n } : null), value: () => null })?.entries).toEqual({});
  });

  it('a slice whose own shape is not usable is not read, whatever its entries say', () => {
    expect(readRating(room(RATING_KEY, { meta: { min: 9, max: 1 }, entries: { p1: 4 } }))).toBeNull();
    expect(readRanking(room(RANKING_KEY, { meta: { items: ['a'] }, entries: {} }))).toBeNull();
    expect(run(ratingActivity, { meta: { min: 9, max: 1 }, entries: {} }, { type: 'send', value: 4 })).toEqual({ refuse: 'wrong-phase' });
  });

  it('a __proto__ player does not become everyone\'s prototype', () => {
    const slice = JSON.parse('{"meta":{},"entries":{"__proto__":{"x":1,"y":2},"p1":{"x":3,"y":4}},"open":true}');
    const read = readQuadrant(room(QUADRANT_KEY, slice, ['p1', '__proto__']));
    expect(Object.keys(read?.entries ?? {})).toEqual(['p1']);
    expect(Object.getPrototypeOf(read?.entries)).toBe(Object.prototype);
    expect((read?.entries as Record<string, unknown>).x).toBeUndefined();
  });
});
