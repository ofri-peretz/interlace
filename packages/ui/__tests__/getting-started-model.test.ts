/**
 * The rules of a getting-started checklist: what a definition may be, what each step is, what
 * counts as progress, what is celebrated (once), the pace against a date, how two copies merge,
 * and that nothing read from storage is trusted.
 */
import { describe, expect, it } from 'vitest';

import {
  announcementFor,
  celebrationKey,
  celebrationsFor,
  complete,
  deriveChecklist,
  emptySnapshot,
  markCelebrated,
  mergeSnapshots,
  pace,
  parseChecklist,
  parseSnapshot,
  setDismissed,
  skip,
  topCelebration,
  uncomplete,
  unskip,
  type ChecklistDef,
  type ChecklistSnapshot,
} from '../src/games/getting-started-model.js';

const UTC = 'UTC';
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 20, 12);

/** Seven steps in three groups: the workshop host's list. */
const def: ChecklistDef = {
  groups: [
    { id: 'plan', title: 'Plan' },
    { id: 'prepare', title: 'Prepare' },
  ],
  steps: [
    { id: 'date', title: 'Pick a date', group: 'plan' },
    { id: 'agenda', title: 'Write the agenda', group: 'plan', after: ['date'] },
    { id: 'invite', title: 'Invite people', group: 'prepare', after: ['date'] },
    { id: 'test', title: 'Test the room', group: 'prepare', after: ['agenda'] },
    { id: 'slides', title: 'Add slides', optional: true, group: 'prepare' },
    { id: 'rehearse', title: 'Rehearse', after: ['test', 'slides'] },
    { id: 'run', title: 'Run the day', weight: 2, after: ['rehearse', 'invite'] },
  ],
};

const done = (ids: string[], base = emptySnapshot()) =>
  ids.reduce((s, id, i) => complete(def, s, id, T0 + i * 1000, UTC), base);
/** Everything done but the last step, with the optional one skipped. */
const almostDone = () => done(['rehearse'], skip(def, done(['date', 'agenda', 'invite', 'test']), 'slides', T0 + 7000));
const state = (s: ChecklistSnapshot, id: string) => deriveChecklist(def, s).steps.find((x) => x.id === id)?.state;

describe('parseChecklist', () => {
  it('accepts a good definition and keeps what it understands', () => {
    const r = parseChecklist({ ...def, milestones: [10, 90] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.def.steps).toHaveLength(7);
      expect(r.def.groups).toHaveLength(2);
      expect(r.def.milestones).toEqual([10, 90]);
      expect(r.def.steps[4]).toMatchObject({ optional: true });
    }
    expect(parseChecklist({ steps: [{ id: 'a', title: 'A', description: 'd', weight: 3, after: [] }] }).ok).toBe(true);
  });

  const errorsOf = (raw: unknown) => {
    const r = parseChecklist(raw);
    return r.ok ? [] : r.errors;
  };

  it('refuses what is not a list of steps', () => {
    expect(errorsOf(null)).toHaveLength(1);
    expect(errorsOf({})).toHaveLength(1);
    expect(errorsOf({ steps: 'x' })).toHaveLength(1);
    expect(errorsOf([])).toHaveLength(1);
  });

  it('names a repeated id, a bad id, a missing title and a bad weight', () => {
    const e = errorsOf({
      steps: [
        { id: 'a', title: 'A' },
        { id: 'a', title: 'again' },
        { id: 'B c', title: 'bad id' },
        7,
        { id: 'b', title: '  ' },
        { id: 'c', title: 'C', weight: 0 },
        { id: 'd', title: 'D', weight: Number.NaN },
        { id: 'e', title: 'E', weight: -1 },
      ],
    });
    expect(e.join('\n')).toContain('Step "a" is repeated.');
    expect(e.join('\n')).toContain('needs an id');
    expect(e.join('\n')).toContain('Step "b" needs a title.');
    expect(e.filter((x) => x.includes('weight'))).toHaveLength(3);
  });

  it('names an unknown dependency or group, and a malformed after', () => {
    const e = errorsOf({
      groups: [{ id: 'g', title: 'G' }],
      steps: [
        { id: 'a', title: 'A', after: ['nope'] },
        { id: 'b', title: 'B', group: 'missing' },
        { id: 'c', title: 'C', after: 'a' },
        { id: 'd', title: 'D', after: [4] },
        { id: 'e', title: 'E', group: 4 },
      ],
    });
    expect(e.join('\n')).toContain('Step "a" waits for "nope", which does not exist.');
    expect(e.join('\n')).toContain('Step "b" is in a group that does not exist.');
    expect(e.filter((x) => x.includes('not a list of ids'))).toHaveLength(2);
    expect(e.join('\n')).toContain('Step "e" is in a group that does not exist.');
  });

  it('refuses a cycle: a self-loop, two steps, and three', () => {
    expect(errorsOf({ steps: [{ id: 'a', title: 'A', after: ['a'] }, { id: 'ok', title: 'ok' }] }).join()).toContain('Step "a" is part of a cycle');
    expect(errorsOf({ steps: [{ id: 'a', title: 'A', after: ['b'] }, { id: 'b', title: 'B', after: ['a'] }] })).toHaveLength(2);
    const three = errorsOf({
      steps: [
        { id: 'a', title: 'A', after: ['c'] },
        { id: 'b', title: 'B', after: ['a'] },
        { id: 'c', title: 'C', after: ['b'] },
        { id: 'free', title: 'free' },
      ],
    });
    expect(three.filter((x) => x.includes('cycle'))).toHaveLength(3);
    expect(errorsOf({ steps: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B', after: ['a'] }] })).toEqual([]);
  });

  it('needs a required step, and checks groups and milestones', () => {
    expect(errorsOf({ steps: [{ id: 'a', title: 'A', optional: true }] })).toEqual(['At least one step must be required.']);
    expect(errorsOf({ ...def, groups: 'x' }).join()).toContain('`groups` must be a list');
    expect(errorsOf({ ...def, groups: [{ id: 'plan', title: 'a' }, { id: 'plan', title: 'b' }, { id: 'X!', title: 'c' }, 5] }).join()).toContain('Group "plan" is repeated');
    for (const milestones of ['x', [0], [100], [50, 50], [60, 40], [1.5]]) {
      expect(errorsOf({ ...def, milestones }).join()).toContain('Milestones must be whole percents');
    }
  });
});

describe('deriveChecklist', () => {
  it('starts with the first required step next, and the ones that wait locked', () => {
    const d = deriveChecklist(def, emptySnapshot());
    expect(d).toMatchObject({ doneCount: 0, total: 6, percent: 0, complete: false, next: 'date' });
    expect(d.steps.map((s) => s.state)).toEqual(['next', 'locked', 'locked', 'locked', 'todo', 'locked', 'locked']);
    expect(d.steps[1]?.lockedBy).toEqual(['date']);
    expect(d.steps[5]?.lockedBy).toEqual(['test', 'slides']);
  });

  it('counts required steps by weight, and an optional step never moves the bar', () => {
    const s = done(['date', 'agenda']);
    expect(deriveChecklist(def, s)).toMatchObject({ doneCount: 2, total: 6, percent: 28 }); // 2 of 7 weight
    expect(deriveChecklist(def, done(['slides'])).percent).toBe(0);
    expect(deriveChecklist(def, done(['slides'])).doneCount).toBe(0);
    expect(deriveChecklist(def, almostDone())).toMatchObject({ doneCount: 5, percent: 71 }); // 5 of 7 weight, floored
  });

  it('moves next on as steps are done, and unlocks what waited', () => {
    const s = done(['date']);
    expect(deriveChecklist(def, s).next).toBe('agenda');
    expect(state(s, 'agenda')).toBe('next');
    expect(state(s, 'invite')).toBe('todo');
    expect(state(s, 'test')).toBe('locked');
  });

  it('is complete when every required step is done, with the optional one open', () => {
    const s = done(['date', 'agenda', 'invite', 'test', 'rehearse', 'run']);
    // `rehearse` waits for `slides`, so it is locked until slides is done or skipped.
    expect(state(s, 'rehearse')).toBe('locked');
    const all = skip(def, done(['date', 'agenda', 'invite', 'test']), 'slides', T0 + 9000);
    const fin = done(['rehearse', 'run'], all);
    expect(deriveChecklist(def, fin)).toMatchObject({ complete: true, percent: 100, next: null, doneCount: 6 });
  });

  it('a skipped optional step satisfies what waits for it', () => {
    const s = skip(def, done(['date', 'agenda', 'test']), 'slides', T0 + 5000);
    expect(state(s, 'slides')).toBe('skipped');
    expect(state(s, 'rehearse')).toBe('todo'); // no longer locked
    expect(deriveChecklist(def, s).next).toBe('invite');
  });

  it('is empty for a definition whose total is zero', () => {
    expect(deriveChecklist({ steps: [{ id: 'a', title: 'A', optional: true }] }, emptySnapshot())).toMatchObject({ percent: 0, complete: false, total: 0 });
  });
});

describe('changes', () => {
  it('completing a locked, unknown or already done step is no change: the same object', () => {
    const s = emptySnapshot();
    expect(complete(def, s, 'agenda', T0, UTC)).toBe(s);
    expect(complete(def, s, 'ghost', T0, UTC)).toBe(s);
    const d = done(['date']);
    expect(complete(def, d, 'date', T0 + 99, UTC)).toBe(d);
  });

  it('does a step, marks the day, and keeps days append-only through undo and redo', () => {
    const a = complete(def, emptySnapshot(), 'date', T0, UTC);
    expect(a).toMatchObject({ done: { date: T0 }, activeDays: ['2026-11-20'], at: T0 });
    const undone = uncomplete(def, a, 'date', T0 + 1000);
    expect(state(undone, 'date')).toBe('next');
    expect(undone.activeDays).toEqual(['2026-11-20']);
    const again = complete(def, undone, 'date', T0 + 2 * DAY, UTC);
    expect(state(again, 'date')).toBe('done');
    expect(again.activeDays).toEqual(['2026-11-20', '2026-11-22']);
    expect(complete(def, again, 'agenda', T0 + 2 * DAY + 5, UTC).activeDays).toEqual(['2026-11-20', '2026-11-22']);
  });

  it('un-ticking at the same millisecond still wins, and a re-tick at that millisecond wins back', () => {
    const a = complete(def, emptySnapshot(), 'date', T0, UTC);
    const u = uncomplete(def, a, 'date', T0);
    expect(state(u, 'date')).toBe('next');
    const r = complete(def, u, 'date', T0, UTC);
    expect(state(r, 'date')).toBe('done');
  });

  it('uncomplete of what is not done is no change', () => {
    const s = emptySnapshot();
    expect(uncomplete(def, s, 'date', T0)).toBe(s);
    expect(uncomplete(def, s, 'ghost', T0)).toBe(s);
  });

  it('skips optional steps only, once, and brings them back', () => {
    const s = emptySnapshot();
    expect(skip(def, s, 'date', T0)).toBe(s); // required
    expect(skip(def, s, 'ghost', T0)).toBe(s);
    const k = skip(def, s, 'slides', T0);
    expect(skip(def, k, 'slides', T0 + 1)).toBe(k);
    const back = unskip(def, k, 'slides', T0 + 2);
    expect(state(back, 'slides')).toBe('todo');
    expect(unskip(def, back, 'slides', T0 + 3)).toBe(back);
    expect(state(skip(def, back, 'slides', T0 + 2), 'slides')).toBe('skipped'); // same ms as the un-skip
    const d = done(['slides']);
    expect(skip(def, d, 'slides', T0 + 9)).toBe(d);
  });

  it('doing a skipped step makes it done', () => {
    const k = skip(def, emptySnapshot(), 'slides', T0);
    expect(state(complete(def, k, 'slides', T0 + 5, UTC), 'slides')).toBe('done');
  });

  it('hides and shows the list, and says nothing when it already is', () => {
    const s = emptySnapshot(5);
    const h = setDismissed(s, true, 1);
    expect(h).toMatchObject({ dismissed: true, at: 6 });
    expect(setDismissed(h, true, 99)).toBe(h);
    expect(setDismissed(h, false, 100).dismissed).toBe(false);
  });
});

describe('celebrations', () => {
  const step = (id: string) => ({ type: 'step', stepId: id }) as const;

  it('celebrates a step, then the milestone it crosses, and the finish above both', () => {
    const before = done(['date']);
    const after = complete(def, before, 'agenda', T0 + 9000, UTC); // 2 of 7 weight = 28: crosses 25
    expect(celebrationsFor(def, before, after)).toEqual([step('agenda'), { type: 'milestone', percent: 25 }]);
    expect(topCelebration(celebrationsFor(def, before, after))).toEqual({ type: 'milestone', percent: 25 });
    const almost = almostDone();
    const fin = complete(def, almost, 'run', T0 + 8000, UTC);
    const c = celebrationsFor(def, almost, fin);
    expect(c.at(-1)).toEqual({ type: 'complete' });
    expect(topCelebration(c)).toEqual({ type: 'complete' });
  });

  it('crosses the right milestones at the boundaries', () => {
    const one: ChecklistDef = { steps: Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, title: `S${i}` })) };
    const s0 = emptySnapshot();
    const s1 = complete(one, s0, 's0', 1, UTC); // 25
    expect(celebrationsFor(one, s0, s1).map(celebrationKey)).toEqual(['step:s0', 'milestone:25']);
    const s2 = complete(one, s1, 's1', 2, UTC); // 50
    expect(celebrationsFor(one, s1, s2).map(celebrationKey)).toEqual(['step:s1', 'milestone:50']);
    expect(celebrationsFor(one, s2, s2)).toEqual([]); // 25 to 25 style: no change, nothing
    const fast = complete(one, complete(one, s2, 's2', 3, UTC), 's3', 4, UTC); // 50 to 100 in two changes
    const jump = { ...fast, done: { ...fast.done } };
    expect(celebrationsFor(one, s2, jump).map(celebrationKey)).toEqual(['step:s2', 'step:s3', 'milestone:75', 'complete']);
  });

  it('is silent for what was celebrated, so un-ticking and ticking again, or a reload, repeats nothing', () => {
    const a = complete(def, emptySnapshot(), 'date', T0, UTC);
    const marked = markCelebrated(a, celebrationsFor(def, emptySnapshot(), a));
    expect(marked.celebrated).toContain('step:date');
    const un = uncomplete(def, marked, 'date', T0 + 10);
    const re = complete(def, un, 'date', T0 + 20, UTC);
    expect(celebrationsFor(def, un, re)).toEqual([]);
    expect(re.celebrated).toEqual(marked.celebrated); // un-ticking never removes a key
    expect(markCelebrated(re, [])).toBe(re);
  });

  it('shows one: finishing, then the highest milestone, then the last step, else none', () => {
    expect(topCelebration([])).toBeNull();
    expect(topCelebration([step('a'), step('b')])).toEqual(step('b'));
    expect(topCelebration([step('a'), { type: 'milestone', percent: 25 }, { type: 'milestone', percent: 50 }])).toEqual({ type: 'milestone', percent: 50 });
    expect(topCelebration([{ type: 'complete' }, { type: 'milestone', percent: 75 }])).toEqual({ type: 'complete' });
  });

  it('uses the definition\'s own milestones', () => {
    const custom: ChecklistDef = { milestones: [10], steps: Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, title: `S${i}` })) };
    const s = complete(custom, emptySnapshot(), 's0', 1, UTC);
    expect(celebrationsFor(custom, emptySnapshot(), s).map(celebrationKey)).toEqual(['step:s0', 'milestone:10']);
  });
});

describe('pace', () => {
  const five = done(['date', 'agenda']); // 4 required left
  const at = (days: number) => T0 + days * DAY;

  it('has none without a date, or with a nonsense one', () => {
    expect(pace(def, five, T0, undefined)).toMatchObject({ state: 'none', stepsLeft: 4 });
    expect(pace(def, five, T0, Number.NaN).state).toBe('none');
  });

  it('is on track at exactly the capacity, and behind one step over', () => {
    expect(pace(def, five, T0, at(2), 2, UTC)).toEqual({ state: 'on-track', stepsLeft: 4, daysLeft: 2 }); // 4 <= 2 x 2
    expect(pace(def, five, T0, at(1), 2, UTC)).toMatchObject({ state: 'behind', daysLeft: 1 });
    expect(pace(def, five, T0, at(2), 1, UTC)).toMatchObject({ state: 'behind' });
  });

  it('counts the due day itself as a day, and is overdue the day after', () => {
    const left2 = done(['date', 'agenda', 'invite', 'test']);
    expect(pace(def, left2, T0, T0 + 3600_000, 2, UTC)).toEqual({ state: 'on-track', stepsLeft: 2, daysLeft: 0 }); // 2 <= max(1,0) x 2
    expect(pace(def, five, T0, T0 + 3600_000, 2, UTC).state).toBe('behind');
    expect(pace(def, five, T0, at(-1), 2, UTC)).toEqual({ state: 'overdue', stepsLeft: 4, daysLeft: 0 });
  });

  it('is done when the list is complete, even past the date', () => {
    const fin = done(['run'], almostDone());
    expect(pace(def, fin, T0, at(-5), 2, UTC).state).toBe('done');
  });

  it('reads days in the person\'s time zone', () => {
    const late = Date.UTC(2026, 10, 20, 23, 30); // still the 20th in UTC, already the 21st in Tokyo
    const due = Date.UTC(2026, 10, 21, 3, 0);
    expect(pace(def, five, late, due, 2, UTC).daysLeft).toBe(1);
    expect(pace(def, five, late, due, 2, 'Asia/Tokyo').daysLeft).toBe(0);
  });

  it('falls back to one a day for a capacity that is not a positive number', () => {
    expect(pace(def, five, T0, at(2), 0, UTC).state).toBe('behind'); // 4 > 2 x 1
    expect(pace(def, five, T0, at(2), Number.NaN, UTC).state).toBe('behind');
  });
});

describe('parseSnapshot', () => {
  it('rebuilds a good snapshot and drops what is not in the definition', () => {
    const s = done(['date', 'agenda']);
    const marked = markCelebrated(s, [{ type: 'step', stepId: 'date' }, { type: 'milestone', percent: 25 }, { type: 'complete' }]);
    expect(parseSnapshot(JSON.parse(JSON.stringify(marked)), def)).toEqual(marked);
    const stale = { ...marked, done: { ...marked.done, removed: 5 }, celebrated: [...marked.celebrated, 'step:removed'] };
    const got = parseSnapshot(stale, def)!;
    expect(got.done).not.toHaveProperty('removed');
    expect(got.celebrated).not.toContain('step:removed');
    expect(parseSnapshot(stale)!.done).toHaveProperty('removed'); // without a definition, nothing is known to be gone
  });

  it('is null for what is not a version 1 snapshot', () => {
    for (const raw of [null, undefined, 'x', 4, [], {}, { v: 2 }, { v: '1' }]) expect(parseSnapshot(raw)).toBeNull();
  });

  it('survives a hostile blob', () => {
    const hostile = JSON.parse(`{
      "v": 1,
      "done": { "__proto__": 5, "constructor": 6, "prototype": 7, "date": -1, "agenda": "x", "invite": 1e999, "test": 9, "${'k'.repeat(80)}": 3 },
      "skipped": [1, 2], "cleared": null,
      "celebrated": ["step:date", "milestone:25", "milestone:999", "evil", 4, "${'x'.repeat(200)}", "complete", "complete"],
      "activeDays": ["2026-11-20", "not a day", 7, "2026-13-45"],
      "dismissed": "yes", "at": "now"
    }`);
    const got = parseSnapshot(hostile, def)!;
    expect(Object.keys(got.done)).toEqual(['test']);
    // Without a definition to check ids against, the keys that would set a prototype are still refused.
    expect(Object.keys(parseSnapshot(hostile)!.done)).toEqual(['test']);
    expect(Object.getPrototypeOf(got.done)).toBe(Object.prototype);
    expect(got.skipped).toEqual({});
    expect(got.cleared).toEqual({});
    expect(got.celebrated).toEqual(['complete', 'milestone:25', 'step:date']);
    expect(got.activeDays).toEqual(['2026-11-20']);
    expect(got).toMatchObject({ dismissed: false, at: 0 });
  });

  it('caps the lists', () => {
    const days = Array.from({ length: 900 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10));
    const got = parseSnapshot({ v: 1, activeDays: days, celebrated: Array.from({ length: 500 }, (_, i) => `milestone:${i % 100}`) })!;
    expect(got.activeDays).toHaveLength(400);
    expect(got.celebrated.length).toBeLessThanOrEqual(100);
    expect(got.activeDays.at(-1)).toBe(days.slice().sort().at(-1));
  });
});

// A seeded generator, so a failing case can be replayed: the seed is printed.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20261126;
function randomSnapshot(r: () => number): ChecklistSnapshot {
  const ids = def.steps.map((s) => s.id);
  const pick = () => ids[Math.floor(r() * ids.length)] as string;
  const times = (n: number) => Object.fromEntries(Array.from({ length: n }, () => [pick(), Math.floor(r() * 50)]));
  return {
    v: 1,
    done: times(Math.floor(r() * 6)),
    skipped: times(Math.floor(r() * 3)),
    cleared: times(Math.floor(r() * 4)),
    celebrated: Array.from({ length: Math.floor(r() * 4) }, () => `step:${pick()}`),
    activeDays: Array.from({ length: Math.floor(r() * 4) }, () => `2026-11-${String(10 + Math.floor(r() * 15))}`).sort(),
    dismissed: r() > 0.5,
    at: Math.floor(r() * 50),
  };
}
const sorted = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
const norm = (s: ChecklistSnapshot) =>
  JSON.stringify({ ...s, done: sorted(s.done), skipped: sorted(s.skipped), cleared: sorted(s.cleared), celebrated: [...s.celebrated].sort(), activeDays: [...s.activeDays].sort() });

describe(`mergeSnapshots (property tests, seed ${SEED}, 500 cases)`, () => {
  const cases = (() => {
    const r = rng(SEED);
    return Array.from({ length: 500 }, () => [randomSnapshot(r), randomSnapshot(r), randomSnapshot(r)] as const);
  })();

  it('is commutative', () => {
    for (const [a, b] of cases) expect(norm(mergeSnapshots(a, b))).toBe(norm(mergeSnapshots(b, a)));
  });

  it('is associative', () => {
    for (const [a, b, c] of cases) {
      expect(norm(mergeSnapshots(mergeSnapshots(a, b), c))).toBe(norm(mergeSnapshots(a, mergeSnapshots(b, c))));
    }
  });

  it('is idempotent', () => {
    for (const [a, b] of cases) {
      const m = mergeSnapshots(a, b);
      expect(norm(mergeSnapshots(m, m))).toBe(norm(m));
      expect(norm(mergeSnapshots(m, a))).toBe(norm(m));
    }
  });

  it('never loses a celebrated key or an active day', () => {
    for (const [a, b] of cases) {
      const m = mergeSnapshots(a, b);
      for (const k of [...a.celebrated, ...b.celebrated]) expect(m.celebrated).toContain(k);
      for (const d of [...a.activeDays, ...b.activeDays]) expect(m.activeDays).toContain(d);
    }
  });

  it('lets the newer un-tick beat the older tick, whichever side holds which', () => {
    const ticked = complete(def, emptySnapshot(), 'date', 1000, UTC);
    const unticked = uncomplete(def, ticked, 'date', 2000);
    const never = emptySnapshot(1500); // a phone that never saw the step
    expect(state(mergeSnapshots(ticked, unticked), 'date')).toBe('next');
    expect(state(mergeSnapshots(unticked, ticked), 'date')).toBe('next');
    expect(state(mergeSnapshots(never, unticked), 'date')).toBe('next');
    expect(state(mergeSnapshots(ticked, never), 'date')).toBe('done'); // the phone never un-ticked it
    const retick = complete(def, unticked, 'date', 3000, UTC);
    expect(state(mergeSnapshots(unticked, retick), 'date')).toBe('done');
  });

  it('keeps a hidden list hidden unless the other side showed it later', () => {
    const hidden = setDismissed(emptySnapshot(10), true, 20);
    const shown = setDismissed(hidden, false, 30);
    expect(mergeSnapshots(hidden, emptySnapshot(10)).dismissed).toBe(true);
    expect(mergeSnapshots(shown, hidden).dismissed).toBe(false);
    expect(mergeSnapshots(hidden, shown).dismissed).toBe(false);
    const a = { ...emptySnapshot(5), dismissed: true };
    const b = { ...emptySnapshot(5), dismissed: false };
    expect(mergeSnapshots(a, b).dismissed).toBe(true);
    expect(mergeSnapshots(b, a).dismissed).toBe(true);
  });
});

describe('announcementFor', () => {
  it('says the step and the count, once', () => {
    const before = done(['date']);
    const after = complete(def, complete(def, before, 'agenda', T0 + 4000, UTC), 'invite', T0 + 5000, UTC);
    expect(announcementFor(def, complete(def, before, 'agenda', T0 + 4000, UTC), after)).toBe('Invite people done. 3 of 6 steps done.');
  });

  it('says halfway, other milestones, and the finish, ahead of the step', () => {
    const three = done(['date', 'agenda', 'invite']); // 3 of 7 weight: 42%
    const four = complete(def, three, 'test', T0 + 7000, UTC); // 4 of 7: 57% crosses 50
    expect(announcementFor(def, three, four)).toBe('Halfway: 4 of 6 steps done.');
    const one = done(['date']);
    const two = complete(def, one, 'agenda', T0 + 7000, UTC); // 28% crosses 25
    expect(announcementFor(def, one, two)).toBe('25 percent: 2 of 6 steps done.');
    const almost = almostDone();
    expect(announcementFor(def, almost, complete(def, almost, 'run', T0 + 8000, UTC))).toBe('All 6 steps done. You are ready.');
  });

  it('says an optional step without a count, a reopened step, a skip and an un-skip', () => {
    const base = done(['date']);
    expect(announcementFor(def, base, complete(def, base, 'slides', T0 + 9000, UTC))).toBe('Add slides done.');
    expect(announcementFor(def, base, uncomplete(def, base, 'date', T0 + 9000))).toBe('Pick a date is open again.');
    const k = skip(def, base, 'slides', T0 + 9000);
    expect(announcementFor(def, base, k)).toBe('Add slides skipped.');
    expect(announcementFor(def, k, unskip(def, k, 'slides', T0 + 9500))).toBe('Add slides is open again.');
  });

  it('says nothing when nothing a person did changed, or when several things did at once', () => {
    const a = done(['date']);
    expect(announcementFor(def, a, a)).toBeNull();
    expect(announcementFor(def, emptySnapshot(), done(['date', 'agenda', 'invite']))).toBeNull(); // a merge from elsewhere
    expect(announcementFor(def, a, { ...a, dismissed: true })).toBeNull();
  });

  it('uses the app\'s words', () => {
    const before = emptySnapshot();
    const after = complete(def, before, 'date', T0, UTC);
    expect(
      announcementFor(def, before, after, { stepDone: (t, d, n) => `${t}: ${d}/${n}` }),
    ).toBe('Pick a date: 1/6');
    const labels = {
      optionalDone: (t: string) => `O ${t}`,
      halfway: (d: number, t: number) => `H ${d}/${t}`,
      milestone: (p: number) => `M ${p}`,
      complete: (n: number) => `C ${n}`,
      reopened: (t: string) => `R ${t}`,
      skipped: (t: string) => `S ${t}`,
    };
    expect(announcementFor(def, after, uncomplete(def, after, 'date', T0 + 1), labels)).toBe('R Pick a date');
    expect(announcementFor(def, after, skip(def, after, 'slides', T0 + 1), labels)).toBe('S Add slides');
    expect(announcementFor(def, after, complete(def, after, 'slides', T0 + 1, UTC), labels)).toBe('O Add slides');
    expect(announcementFor(def, done(['date']), complete(def, done(['date']), 'agenda', T0 + 5, UTC), labels)).toBe('M 25');
    expect(announcementFor(def, done(['date', 'agenda', 'invite']), complete(def, done(['date', 'agenda', 'invite']), 'test', T0 + 5, UTC), labels)).toBe('H 4/6');
    const almost = almostDone();
    expect(announcementFor(def, almost, complete(def, almost, 'run', T0 + 9, UTC), labels)).toBe('C 6');
  });
});
