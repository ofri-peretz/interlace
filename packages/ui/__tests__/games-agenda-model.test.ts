/**
 * The presenter's agenda: what each event does to the clock, planned against elapsed, the gentle
 * over-time tiers, intents from a second screen, and keeping the agenda across a refresh.
 */
import { describe, expect, it } from 'vitest';

import {
  acceptIntent,
  agendaProgress,
  applyAgendaEvent,
  createAgenda,
  createAgendaStore,
  elapsedMs,
  formatClock,
  MAX_PLANNED,
  MAX_SECTIONS,
  paceTier,
  plannedMs,
  restoreAgenda,
  serializeAgenda,
  type AgendaEvent,
  type AgendaState,
} from '../src/games/agenda-model.js';

const T0 = 1_000_000;
const MIN = 60_000;

const make = () =>
  createAgenda([
    { id: 'intro', title: 'Welcome', notes: 'Say hello.\nName the goal.', plannedSeconds: 300 },
    { id: 'demo', title: 'Demo', notes: 'Show the room.', plannedSeconds: 600 },
    { id: 'qa', title: 'Questions', plannedSeconds: 300 },
  ]);

/** Runs events at the given times (ms after T0). */
function run(state: AgendaState, steps: [AgendaEvent['type'] | AgendaEvent, number][]): AgendaState {
  return steps.reduce(
    (s, [event, at]) => applyAgendaEvent(s, typeof event === 'string' ? ({ type: event } as AgendaEvent) : event, T0 + at),
    state,
  );
}

describe('createAgenda', () => {
  it('builds sections with clean titles, notes and times', () => {
    const a = createAgenda([
      { title: '  A   title ', notes: 'n', plannedSeconds: 90.7 },
      { id: 'x', title: '', plannedSeconds: -5 },
      { id: 'x', title: 'Dup', plannedSeconds: 1e9 },
      { id: 'a b', title: 'Odd id' },
      { id: 's1', title: 'Clash' },
    ]);
    expect(a.sections.map((s) => s.title)).toEqual(['A title', 'Section 2', 'Dup', 'Odd id', 'Clash']);
    expect(a.sections.map((s) => s.plannedSeconds)).toEqual([90, 0, MAX_PLANNED, 0, 0]);
    expect(new Set(a.sections.map((s) => s.id)).size).toBe(5);
    expect(a.sections[0]!.notes).toBe('n');
    expect(a.sections[1]!.notes).toBe('');
    expect(a).toMatchObject({ current: 0, status: 'idle', since: null, seq: 0, spent: {} });
  });

  it('never gives two sections the same id, even when a made-up id is one already given', () => {
    const a = createAgenda([{ id: 's2', title: 'A' }, { title: 'B' }, { title: 'C' }]);
    expect(a.sections.map((s) => s.id)).toEqual(['s2', 's2-1', 's3']);
  });

  it('caps the sections and the notes', () => {
    expect(createAgenda(Array.from({ length: 100 }, (_, i) => ({ title: `S${i}` }))).sections).toHaveLength(MAX_SECTIONS);
    expect(createAgenda([{ title: 'x', notes: 'n'.repeat(9000) }]).sections[0]!.notes).toHaveLength(4000);
    expect(createAgenda([]).sections).toEqual([]);
  });
});

describe('the clock', () => {
  it('starts, runs, pauses and resumes without losing or double counting a second', () => {
    let a = run(make(), [['start', 0]]);
    expect(a).toMatchObject({ status: 'running', current: 0, since: T0, seq: 1 });
    expect(elapsedMs(a, 0, T0 + 90_000)).toBe(90_000);
    a = run(a, [['pause', 100_000]]);
    expect(a).toMatchObject({ status: 'paused', since: null });
    expect(elapsedMs(a, 0, T0 + 500_000)).toBe(100_000); // paused: time stands still
    a = run(a, [['resume', 200_000]]);
    expect(elapsedMs(a, 0, T0 + 230_000)).toBe(130_000);
  });

  it('moves on: banks the section, starts the next at zero, and finishes after the last', () => {
    let a = run(make(), [['start', 0], ['next', 4 * MIN]]);
    expect(a.current).toBe(1);
    expect(elapsedMs(a, 0, T0 + 99 * MIN)).toBe(4 * MIN);
    expect(elapsedMs(a, 1, T0 + 5 * MIN)).toBe(MIN);
    a = run(a, [['next', 14 * MIN], ['next', 18 * MIN]]);
    expect(a).toMatchObject({ status: 'done', since: null, current: 2 });
    expect([0, 1, 2].map((i) => elapsedMs(a, i, T0 + 99 * MIN))).toEqual([4 * MIN, 10 * MIN, 4 * MIN]);
    expect(applyAgendaEvent(a, { type: 'next' }, T0 + 20 * MIN)).toBe(a);
  });

  it('treats next on an idle agenda as start, and pause or resume at the wrong time as nothing', () => {
    const a = make();
    expect(applyAgendaEvent(a, { type: 'next' }, T0)).toMatchObject({ status: 'running', current: 0 });
    expect(applyAgendaEvent(a, { type: 'pause' }, T0)).toBe(a);
    expect(applyAgendaEvent(a, { type: 'resume' }, T0)).toBe(a);
    const running = run(a, [['start', 0]]);
    expect(applyAgendaEvent(running, { type: 'start' }, T0)).toBe(running);
    expect(applyAgendaEvent(running, { type: 'resume' }, T0)).toBe(running);
    const paused = run(running, [['pause', 1000]]);
    expect(applyAgendaEvent(paused, { type: 'pause' }, T0)).toBe(paused);
    expect(applyAgendaEvent(createAgenda([]), { type: 'start' }, T0).status).toBe('idle');
  });

  it('keeps a paused agenda paused when it moves, and a running one running', () => {
    const paused = run(make(), [['start', 0], ['pause', MIN], ['next', 2 * MIN]]);
    expect(paused).toMatchObject({ status: 'paused', current: 1, since: null });
    expect(elapsedMs(paused, 1, T0 + 9 * MIN)).toBe(0);
    const running = run(make(), [['start', 0], ['next', MIN]]);
    expect(running).toMatchObject({ status: 'running', current: 1, since: T0 + MIN });
  });

  it('goes back, and returns to the last section from done', () => {
    let a = run(make(), [['start', 0], ['next', MIN], ['previous', 2 * MIN]]);
    expect(a.current).toBe(0);
    expect(elapsedMs(a, 0, T0 + 3 * MIN)).toBe(2 * MIN); // MIN before + MIN since
    expect(applyAgendaEvent(a, { type: 'previous' }, T0 + 3 * MIN)).toBe(a); // already first
    a = run(a, [['next', 3 * MIN], ['next', 4 * MIN], ['next', 5 * MIN]]);
    expect(a.status).toBe('done');
    a = run(a, [['previous', 6 * MIN]]);
    expect(a).toMatchObject({ status: 'running', current: 2, since: T0 + 6 * MIN });
    const idle = make();
    expect(applyAgendaEvent(idle, { type: 'previous' }, T0)).toBe(idle);
  });

  it('jumps to a section, and ignores an index out of range or the one it is on', () => {
    const a = run(make(), [['start', 0]]);
    const there = applyAgendaEvent(a, { type: 'goto', index: 2 }, T0 + MIN);
    expect(there).toMatchObject({ current: 2, status: 'running', since: T0 + MIN });
    expect(applyAgendaEvent(a, { type: 'goto', index: 0 }, T0)).toBe(a);
    for (const index of [-1, 3, 1.5, Number.NaN]) expect(applyAgendaEvent(a, { type: 'goto', index }, T0)).toBe(a);
    // Before starting, it only chooses where to start; once done it brings the agenda back.
    const idle = make();
    expect(applyAgendaEvent(idle, { type: 'goto', index: 1 }, T0)).toMatchObject({ current: 1, status: 'idle', since: null });
    expect(applyAgendaEvent(idle, { type: 'goto', index: 0 }, T0)).toBe(idle);
    const done = run(a, [['next', MIN], ['next', 2 * MIN], ['next', 3 * MIN]]);
    expect(applyAgendaEvent(done, { type: 'goto', index: 0 }, T0 + 4 * MIN)).toMatchObject({ status: 'running', current: 0 });
  });

  it('adds and takes away planned time on the current section, within bounds', () => {
    const a = make();
    expect(applyAgendaEvent(a, { type: 'add-time', seconds: 60 }, T0).sections[0]!.plannedSeconds).toBe(360);
    expect(applyAgendaEvent(a, { type: 'add-time', seconds: -999 }, T0).sections[0]!.plannedSeconds).toBe(0);
    expect(applyAgendaEvent(a, { type: 'add-time', seconds: 1e9 }, T0).sections[0]!.plannedSeconds).toBe(MAX_PLANNED);
    expect(applyAgendaEvent(a, { type: 'add-time', seconds: 0 }, T0)).toBe(a);
    expect(applyAgendaEvent(a, { type: 'add-time', seconds: Number.NaN }, T0)).toBe(a);
    const zero = applyAgendaEvent(a, { type: 'add-time', seconds: -300 }, T0);
    expect(applyAgendaEvent(zero, { type: 'add-time', seconds: -60 }, T0)).toBe(zero);
    expect(applyAgendaEvent(createAgenda([]), { type: 'add-time', seconds: 60 }, T0).seq).toBe(0);
  });

  it('resets to the start with every clock at zero, and a newer seq', () => {
    const a = run(make(), [['start', 0], ['next', MIN], ['pause', 2 * MIN]]);
    const r = applyAgendaEvent(a, { type: 'reset' }, T0 + 3 * MIN);
    expect(r).toMatchObject({ current: 0, status: 'idle', spent: {}, since: null, seq: a.seq + 1 });
    expect(r.sections).toEqual(a.sections);
  });

  it('bumps seq on a change and never on a no-op, and never mutates', () => {
    const a = make();
    const frozen = JSON.stringify(a);
    const b = applyAgendaEvent(a, { type: 'start' }, T0);
    expect(b.seq).toBe(a.seq + 1);
    expect(JSON.stringify(a)).toBe(frozen);
  });

  it('survives a clock that steps back: no negative time', () => {
    const a = run(make(), [['start', 0], ['pause', -5000]]);
    expect(elapsedMs(a, 0, T0)).toBe(0);
    const running = run(make(), [['start', 0]]);
    expect(elapsedMs(running, 0, T0 - 5000)).toBe(0);
  });

  it('knows nothing of a section that is not there', () => {
    expect(elapsedMs(make(), 9, T0)).toBe(0);
    expect(plannedMs(make(), 9)).toBe(0);
    expect(plannedMs(make(), 1)).toBe(600_000);
  });
});

describe('over time, gently', () => {
  it('is ok below 80%, near up to the plan, over past it, and ok when nothing is planned', () => {
    expect(paceTier(0, 100)).toBe('ok');
    expect(paceTier(79, 100)).toBe('ok');
    expect(paceTier(80, 100)).toBe('near');
    expect(paceTier(100, 100)).toBe('near');
    expect(paceTier(101, 100)).toBe('over');
    expect(paceTier(10_000, 0)).toBe('ok');
  });

  it('reports each section, the totals and how far the session is from its plan', () => {
    // Intro planned 5:00 ran 6:00 (1:00 over); demo planned 10:00 is at 4:00.
    const a = run(make(), [['start', 0], ['next', 6 * MIN]]);
    const p = agendaProgress(a, T0 + 10 * MIN);
    expect(p.sections.map((s) => [s.id, s.status, s.elapsed, s.delta, s.tier])).toEqual([
      ['intro', 'done', 6 * MIN, MIN, 'over'],
      ['demo', 'current', 4 * MIN, 0 - 6 * MIN, 'ok'],
      ['qa', 'upcoming', 0, 0, 'ok'],
    ]);
    expect(p.current?.id).toBe('demo');
    expect(p.plannedTotal).toBe(20 * MIN);
    expect(p.elapsedTotal).toBe(10 * MIN);
    // The half-done demo is not "ahead": only the intro's overrun counts.
    expect(p.drift).toBe(MIN);
    const later = agendaProgress(a, T0 + 20 * MIN);
    expect(later.current).toMatchObject({ delta: 4 * MIN, tier: 'over' });
    expect(later.drift).toBe(5 * MIN);
  });

  it('counts a skipped section as time saved, and a revisited one as presented', () => {
    const a = run(make(), [['start', 0], [{ type: 'goto', index: 2 }, MIN], [{ type: 'previous' }, 2 * MIN]]);
    const p = agendaProgress(a, T0 + 3 * MIN);
    expect(p.sections[2]).toMatchObject({ status: 'upcoming', elapsed: MIN, delta: MIN - 5 * MIN });
    const done = run(make(), [['start', 0], [{ type: 'goto', index: 2 }, MIN], ['next', 2 * MIN]]);
    const skippedRow = agendaProgress(done, T0 + 3 * MIN).sections[1]!;
    expect(skippedRow).toMatchObject({ status: 'done', elapsed: 0, delta: -10 * MIN });
    expect(agendaProgress(done, T0 + 3 * MIN).drift).toBeLessThan(0);
  });

  it('is empty and calm for an agenda with no sections', () => {
    const p = agendaProgress(createAgenda([]), T0);
    expect(p).toMatchObject({ sections: [], current: null, plannedTotal: 0, elapsedTotal: 0, drift: 0 });
  });
});

describe('formatClock', () => {
  it('reads m:ss, h:mm:ss, and 0:00 for nonsense', () => {
    expect([0, 999, 1000, 61_000, 3_599_000, 3_600_000, 3_661_000, 36_000_000].map(formatClock)).toEqual([
      '0:00', '0:00', '0:01', '1:01', '59:59', '1:00:00', '1:01:01', '10:00:00',
    ]);
    expect([-5000, Number.NaN, Infinity].map(formatClock)).toEqual(['0:00', '0:00', '0:00']);
  });
});

describe('intents from a second screen', () => {
  it('applies one that was made against the current state, once', () => {
    const a = make();
    const applied = new Set<string>();
    expect(acceptIntent(a, { id: 'i1', seq: a.seq }, applied)).toBe(true);
    applied.add('i1');
    expect(acceptIntent(a, { id: 'i1', seq: a.seq }, applied)).toBe(false); // repeated
    expect(acceptIntent(a, { id: 'i2', seq: a.seq - 1 }, applied)).toBe(false); // out of date
    expect(acceptIntent(a, { id: 'i3', seq: a.seq + 1 }, applied)).toBe(false); // from a state this window does not have
  });
});

describe('keeping the agenda across a refresh', () => {
  it('round-trips, with seq well ahead and a running section still counting', () => {
    const a = run(make(), [['start', 0], ['next', 4 * MIN]]);
    const b = restoreAgenda(serializeAgenda(a))!;
    expect(b).toMatchObject({ current: 1, status: 'running', since: T0 + 4 * MIN, seq: a.seq + 1000 });
    expect(b.sections).toEqual(a.sections);
    // Two minutes later, after the refresh, the section reads what it ran.
    expect(elapsedMs(b, 1, T0 + 6 * MIN)).toBe(2 * MIN);
    expect(elapsedMs(b, 0, T0 + 6 * MIN)).toBe(4 * MIN);
  });

  it('restores paused, done and idle agendas', () => {
    for (const steps of [[], [['start', 0], ['pause', MIN]], [['start', 0], ['next', 1], ['next', 2], ['next', 3]]] as [AgendaEvent['type'], number][][]) {
      const a = run(make(), steps);
      expect(restoreAgenda(serializeAgenda(a))).toMatchObject({ status: a.status, current: a.current, since: null });
    }
  });

  const good = () => JSON.parse(serializeAgenda(run(make(), [['start', 0]]))) as Record<string, unknown>;

  it.each([
    ['nothing', () => null],
    ['not JSON', () => '{nope'],
    ['an array', () => '[1]'],
    ['sections not a list', () => JSON.stringify({ ...good(), sections: 'x' })],
    ['an unknown status', () => JSON.stringify({ ...good(), status: 'weird' })],
    ['a bad seq', () => JSON.stringify({ ...good(), seq: -2 })],
    ['a text seq', () => JSON.stringify({ ...good(), seq: 'x' })],
    ['a fractional current', () => JSON.stringify({ ...good(), current: 0.5 })],
    ['a current out of range', () => JSON.stringify({ ...good(), current: 9 })],
    ['a negative current', () => JSON.stringify({ ...good(), current: -1 })],
    ['no sections', () => JSON.stringify({ ...good(), sections: [] })],
    ['a running agenda with no start time', () => JSON.stringify({ ...good(), since: null })],
  ])('refuses %s', (_label, make) => {
    expect(restoreAgenda(make() as string | null)).toBeNull();
  });

  it('rebuilds what it keeps: bad times and notes are reset, not trusted', () => {
    const raw = {
      ...good(),
      sections: [
        { id: 'intro', title: 5, notes: 7, plannedSeconds: 'x' },
        { id: 'demo', title: 'Demo', notes: 'n', plannedSeconds: 60 },
        'junk',
      ],
      spent: { intro: -5, demo: 'x', constructor: 4 },
      current: 1,
    };
    const a = restoreAgenda(JSON.stringify(raw))!;
    expect(a.sections.map((s) => [s.title, s.notes, s.plannedSeconds])).toEqual([['Section 1', '', 0], ['Demo', 'n', 60]]);
    expect(a.spent).toEqual({ intro: 0, demo: 0 });
    const numeric = restoreAgenda(JSON.stringify({ ...good(), sections: [{ id: 7, title: 'Seven', plannedSeconds: 60 }], current: 0 }))!;
    expect(numeric.sections.map((s) => s.id)).toEqual(['s1']);
    const noSpent = restoreAgenda(JSON.stringify({ ...good(), spent: 'x' }))!;
    expect(noSpent.spent).toEqual({ intro: 0, demo: 0, qa: 0 });
  });
});

describe('createAgendaStore', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  };

  it('saves, loads and clears', () => {
    const store = createAgendaStore(memory(), 'agenda');
    expect(store.load()).toBeNull();
    store.save(make());
    expect(store.load()?.sections).toHaveLength(3);
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('never throws when storage is missing or broken', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    for (const storage of [broken, null, undefined]) {
      const store = createAgendaStore(storage, 'agenda');
      expect(() => store.save(make())).not.toThrow();
      expect(store.load()).toBeNull();
      expect(() => store.clear()).not.toThrow();
    }
  });
});
