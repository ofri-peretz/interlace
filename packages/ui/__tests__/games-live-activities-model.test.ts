/**
 * The Q&A board, reactions, raised hands and the spectrum as room activities: who may make which
 * move, what a move does to the slice, and that nothing read back from the room is trusted.
 */
import { describe, expect, it } from 'vitest';

import {
  BOARD_KEY,
  HANDS_KEY,
  RECENT_REACTIONS,
  REACTIONS_KEY,
  SPECTRUM_KEY,
  boardActivity,
  handsActivity,
  reactionsActivity,
  readBoard,
  readHands,
  readReactions,
  readSpectrum,
  spectrumActivity,
  submitEvent,
} from '../src/games/live-activities-model.js';
import type { ActivityContext, ActivityReducer, RoomState } from '../src/games/room-model.js';

const HOST = 'host';
const players = ['ann', 'bo', 'cy'].map((id) => ({ id, name: id.toUpperCase(), connected: true, joinedAt: 0 }));
const ctx = (playerId: string, at = 1000): ActivityContext => ({
  playerId,
  host: playerId === HOST,
  at,
  players: players as unknown as ActivityContext['players'],
});

type Out = ReturnType<ActivityReducer>;
const slice = (o: Out) => ('slice' in o ? o.slice : `refuse:${o.refuse}`);
const run = (reducer: ActivityReducer, from: unknown, action: unknown, by: string, at?: number) => slice(reducer(from, action, ctx(by, at)));
/** Runs moves in order, each as `[by, action]`, from nothing; returns the last slice. */
const chain = (reducer: ActivityReducer, moves: [string, unknown][]) =>
  moves.reduce<unknown>((s, [by, action], i) => {
    const out = reducer(s, action, ctx(by, 1000 + i * 5000));
    if (!('slice' in out)) throw new Error(`move ${i} refused: ${out.refuse}`);
    return out.slice;
  }, null);

const room = (shared: Record<string, unknown>): Pick<RoomState, 'shared' | 'players'> => ({
  shared,
  players: players as unknown as RoomState['players'],
});

describe('submitEvent', () => {
  it('builds a player move, and one that is not sent again', () => {
    expect(submitEvent('qa', 'ann', 'm1', { type: 'ask' })).toEqual({ type: 'submit', playerId: 'ann', id: 'm1', key: 'qa', action: { type: 'ask' } });
    expect(submitEvent('reactions', 'ann', 'm2', {}, { retry: false })).toMatchObject({ retry: false });
    expect(submitEvent('reactions', 'ann', 'm2', {}, { retry: true })).not.toHaveProperty('retry');
  });
});

describe('the Q&A board', () => {
  const board = boardActivity();
  const begun = () => chain(board, [[HOST, { type: 'begin', moderated: false }]]);

  it('is begun by the host only, moderated unless said otherwise', () => {
    expect(run(board, null, { type: 'begin' }, 'ann')).toBe('refuse:not-host');
    expect(readBoard(room({ qa: run(board, null, { type: 'begin' }, HOST) }))).toMatchObject({ moderated: true, open: true, questions: [] });
    expect(readBoard(room({ qa: begun() }))).toMatchObject({ moderated: false });
    expect(readBoard(room({ qa: run(board, null, { type: 'begin', open: false }, HOST) }))?.open).toBe(false);
  });

  it('takes a question as the player who sent it, whatever the move says', () => {
    const s = chain(board, [[HOST, { type: 'begin', moderated: false }], ['ann', { type: 'ask', text: 'Why?', by: 'bo' }]]);
    expect(readBoard(room({ qa: s }))?.questions).toMatchObject([{ id: 'q1', text: 'Why?', by: 'ann', status: 'live', at: 6000 }]);
  });

  it('holds a question for review when moderated, and the host moves it on', () => {
    let s = chain(board, [[HOST, { type: 'begin' }], ['ann', { type: 'ask', text: 'Why?' }]]);
    expect(readBoard(room({ qa: s }))?.questions[0]?.status).toBe('review');
    for (const [type, status] of [['approve', 'live'], ['answer', 'answered'], ['restore', 'live'], ['dismiss', 'dismissed']] as const) {
      s = chain(board, [[HOST, { type: 'begin' }], ['ann', { type: 'ask', text: 'Why?' }]]);
      const steps = { approve: [], answer: ['approve'], restore: ['approve', 'answer'], dismiss: ['approve'] }[type] as string[];
      for (const step of [...steps, type]) s = slice(board(s, { type: step, id: 'q1' }, ctx(HOST))) as unknown;
      expect(readBoard(room({ qa: s }))?.questions[0]?.status).toBe(status);
    }
  });

  it('counts one vote a person, never on their own, and takes it back', () => {
    const s = chain(board, [[HOST, { type: 'begin', moderated: false }], ['ann', { type: 'ask', text: 'Why?' }], ['bo', { type: 'vote', id: 'q1' }]]);
    expect(readBoard(room({ qa: s }))?.questions[0]?.votes).toEqual(['bo']);
    expect(run(board, s, { type: 'vote', id: 'q1' }, 'bo')).toBe('refuse:bad-action');
    expect(run(board, s, { type: 'vote', id: 'q1' }, 'ann')).toBe('refuse:bad-action');
    expect(readBoard(room({ qa: run(board, s, { type: 'unvote', id: 'q1' }, 'bo') }))?.questions[0]?.votes).toEqual([]);
  });

  it('numbers questions q1, q2, … however many other moves came between', () => {
    const s = chain(board, [[HOST, { type: 'begin', moderated: false }], ['ann', { type: 'ask', text: 'One?' }], ['bo', { type: 'vote', id: 'q1' }], ['bo', { type: 'ask', text: 'Two?' }]]);
    expect(readBoard(room({ qa: s }))?.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('pins, moderates and opens or closes, as the host', () => {
    const s = chain(board, [[HOST, { type: 'begin', moderated: false }], ['ann', { type: 'ask', text: 'Why?' }]]);
    expect(readBoard(room({ qa: run(board, s, { type: 'pin', id: 'q1' }, HOST) }))?.pinned).toBe('q1');
    expect(readBoard(room({ qa: run(board, run(board, s, { type: 'pin', id: 'q1' }, HOST), { type: 'pin', id: null }, HOST) }))?.pinned).toBeNull();
    expect(readBoard(room({ qa: run(board, s, { type: 'moderate', on: true }, HOST) }))?.moderated).toBe(true);
    const closed = run(board, s, { type: 'open', on: false }, HOST);
    expect(readBoard(room({ qa: closed }))?.open).toBe(false);
    expect(run(board, closed, { type: 'ask', text: 'Too late?' }, 'bo')).toBe('refuse:bad-action');
  });

  it('keeps the host\'s moves to the host, and the player\'s to the players', () => {
    const s = begun();
    for (const action of [{ type: 'approve', id: 'q1' }, { type: 'pin', id: null }, { type: 'moderate', on: true }, { type: 'open', on: true }, { type: 'dismiss', id: 'q1' }]) {
      expect(run(board, s, action, 'ann')).toBe('refuse:not-host');
    }
    for (const action of [{ type: 'ask', text: 'x' }, { type: 'vote', id: 'q1' }, { type: 'unvote', id: 'q1' }]) {
      expect(run(board, s, action, HOST)).toBe('refuse:bad-action');
    }
  });

  it('refuses a move before the board is begun, and anything that is not a move', () => {
    expect(run(board, null, { type: 'ask', text: 'x' }, 'ann')).toBe('refuse:wrong-phase');
    expect(run(board, 'junk', { type: 'ask', text: 'x' }, 'ann')).toBe('refuse:wrong-phase');
    const s = begun();
    for (const action of [
      null,
      'ask',
      [],
      { type: 7 },
      { type: 'launch' },
      { type: 'ask', text: 5 },
      { type: 'vote', id: 7 },
      { type: 'vote', id: '' },
      { type: 'approve' },
      { type: 'pin', id: 7 },
      { type: 'moderate', on: 'yes' },
    ]) {
      expect(run(board, s, action, HOST)).toMatch(/^refuse:/);
      expect(run(board, s, action, 'ann')).toMatch(/^refuse:/);
    }
  });

  it('applies the text rules it was given', () => {
    const strict = boardActivity({ blocklist: ['spam'], maxLength: 20, maxPerPerson: 1 });
    const s = chain(strict, [[HOST, { type: 'begin', moderated: false }]]);
    expect(run(strict, s, { type: 'ask', text: 'free spam here' }, 'ann')).toBe('refuse:bad-action');
    expect(run(strict, s, { type: 'ask', text: 'x'.repeat(40) }, 'ann')).toBe('refuse:bad-action');
    const one = run(strict, s, { type: 'ask', text: 'First' }, 'ann');
    expect(run(strict, one, { type: 'ask', text: 'Second' }, 'ann')).toBe('refuse:bad-action');
  });

  it('reads a board from the room as untrusted data, and drops what was said by anyone gone', () => {
    expect(readBoard(null)).toBeNull();
    expect(readBoard(room({}))).toBeNull();
    expect(readBoard(room({ qa: 'junk' }))).toBeNull();
    expect(readBoard(room({ qa: { questions: 'x', seq: 1 } }))).toBeNull();
    const raw = {
      seq: 4,
      moderated: false,
      open: false,
      pinned: 'q1',
      questions: [
        { id: 'q1', text: 'ok', by: 'ann', at: 1, status: 'live', votes: ['bo', 'bo', 'gone', 7] },
        { id: 'q2', text: 'from someone gone', by: 'gone', at: 2, status: 'live', votes: [] },
        { id: 'q3', text: 'bad status', by: 'ann', at: 3, status: 'hacked', votes: [] },
        { id: 'q4', text: 'bad votes', by: 'ann', at: 3, status: 'live', votes: 'all' },
        { id: 7, text: 'bad id', by: 'ann', at: 3, status: 'live', votes: [] },
        { id: 'q5', text: 8, by: 'ann', at: 3, status: 'live', votes: [] },
        { id: 'q6', text: 'bad by', by: '', at: 3, status: 'live', votes: [] },
        { id: 'q7', text: 'bad at', by: 'ann', at: 'now', status: 'live', votes: [] },
        'junk',
      ],
    };
    const got = readBoard(room({ qa: raw }))!;
    expect(got.questions).toEqual([{ id: 'q1', text: 'ok', by: 'ann', at: 1, status: 'live', votes: ['bo'] }]);
    expect(got).toMatchObject({ moderated: false, open: false, pinned: 'q1', seq: 4 });
    expect(readBoard(room({ qa: { ...raw, pinned: 3 } }))?.pinned).toBeNull();
  });
});

describe('reactions', () => {
  const kinds = ['clap', 'heart'];
  const reactions = reactionsActivity({ kinds, perWindow: 2, windowMs: 3000 });
  const started = () => chain(reactions, [[HOST, { type: 'start' }]]);

  it('starts empty, as the host, and the host clears it', () => {
    expect(run(reactions, null, { type: 'start' }, 'ann')).toBe('refuse:not-host');
    expect(readReactions(room({ reactions: started() }))).toEqual({ totals: { clap: 0, heart: 0 }, recent: [], n: 0, budget: {} });
    const s = chain(reactions, [[HOST, { type: 'start' }], ['ann', { type: 'react', kind: 'clap' }]]);
    expect(readReactions(room({ reactions: run(reactions, s, { type: 'clear' }, HOST) }))?.n).toBe(0);
    expect(run(reactions, s, { type: 'clear' }, 'bo')).toBe('refuse:not-host');
  });

  it('counts each reaction, gives it an id for the screen to float once, and stamps it with the room\'s clock', () => {
    const s = chain(reactions, [[HOST, { type: 'start' }], ['ann', { type: 'react', kind: 'clap' }], ['bo', { type: 'react', kind: 'heart' }], ['ann', { type: 'react', kind: 'clap' }]]);
    const got = readReactions(room({ reactions: s }))!;
    expect(got.totals).toEqual({ clap: 2, heart: 1 });
    expect(got.recent.map((r) => [r.id, r.kind, r.by, r.at])).toEqual([['r1', 'clap', 'ann', 6000], ['r2', 'heart', 'bo', 11000], ['r3', 'clap', 'ann', 16000]]);
    expect(got.n).toBe(3);
  });

  it('slows a person who reacts too fast, and lets them again after the window', () => {
    const start = started();
    const one = reactions(start, { type: 'react', kind: 'clap' }, ctx('ann', 10_000)) as { slice: unknown };
    const two = reactions(one.slice, { type: 'react', kind: 'clap' }, ctx('ann', 10_100)) as { slice: unknown };
    expect(slice(reactions(two.slice, { type: 'react', kind: 'clap' }, ctx('ann', 10_200)))).toBe('refuse:rate-limited');
    expect(slice(reactions(two.slice, { type: 'react', kind: 'clap' }, ctx('bo', 10_200)))).toMatchObject({ n: 3 });
    const later = reactions(two.slice, { type: 'react', kind: 'clap' }, ctx('ann', 14_000)) as { slice: { budget: Record<string, number[]> } };
    expect(later.slice.budget).toEqual({ ann: [14_000] });
  });

  it('keeps the budget of people in the window only, so it does not grow with the room\'s history', () => {
    let s = started();
    for (let i = 0; i < 30; i++) {
      s = (reactions(s, { type: 'react', kind: 'clap' }, ctx(`p${i}`, 1000 + i * 4000)) as { slice: unknown }).slice;
    }
    expect(Object.keys(readReactions(room({ reactions: s }))!.budget)).toEqual(['p29']);
  });

  it('keeps the latest few for the screen, and the full count', () => {
    let s = started();
    for (let i = 0; i < RECENT_REACTIONS + 10; i++) {
      s = (reactions(s, { type: 'react', kind: 'heart' }, ctx('ann', 1000 + i * 4000)) as { slice: unknown }).slice;
    }
    const got = readReactions(room({ reactions: s }))!;
    expect(got.recent).toHaveLength(RECENT_REACTIONS);
    expect((s as { recent: unknown[] }).recent).toHaveLength(RECENT_REACTIONS); // what the room stores stays small too
    expect(got.recent.at(-1)?.id).toBe(`r${RECENT_REACTIONS + 10}`);
    expect(got.totals.heart).toBe(RECENT_REACTIONS + 10);
  });

  it('refuses a kind it does not know, the host reacting, and a reaction before the start', () => {
    expect(run(reactions, started(), { type: 'react', kind: 'fire' }, 'ann')).toBe('refuse:bad-action');
    expect(run(reactions, started(), { type: 'react', kind: 7 }, 'ann')).toBe('refuse:bad-action');
    expect(run(reactions, started(), { type: 'react', kind: 'clap' }, HOST)).toBe('refuse:bad-action');
    expect(run(reactions, null, { type: 'react', kind: 'clap' }, 'ann')).toBe('refuse:wrong-phase');
    expect(run(reactions, started(), null, 'ann')).toBe('refuse:bad-action');
    expect(run(reactions, started(), { type: 4 }, 'ann')).toBe('refuse:bad-action');
    expect(run(reactions, started(), { type: 'dance' }, 'ann')).toBe('refuse:bad-action');
  });

  it('reads reactions from the room as untrusted data', () => {
    expect(readReactions(null)).toBeNull();
    expect(readReactions(room({ reactions: 'x' }))).toBeNull();
    expect(readReactions(room({ reactions: { n: 'a', totals: {}, recent: [], budget: {} } }))).toBeNull();
    const got = readReactions(
      room({
        reactions: {
          n: 3,
          totals: { clap: 2, bad: -1, '': 4, long: 1, hack: 'x' },
          recent: [{ id: 'r1', kind: 'clap', by: 'ann', at: 1 }, { id: 'r2', kind: 7, by: 'ann', at: 1 }, 'junk', { id: '', kind: 'clap', by: 'ann', at: 1 }],
          budget: { ann: [1, 'x', 3], bo: 'no' },
        },
      }),
    )!;
    expect(got.totals).toEqual({ clap: 2, long: 1 });
    expect(got.recent).toEqual([{ id: 'r1', kind: 'clap', by: 'ann', at: 1 }]);
    expect(got.budget).toEqual({ ann: [1, 3] });
    // A key that would set a prototype, as it arrives from the network, is dropped.
    const hostile = JSON.parse('{"n":1,"totals":{},"recent":[],"budget":{"__proto__":[1],"ann":[2]}}');
    const read = readReactions(room({ reactions: hostile }))!;
    expect(read.budget).toEqual({ ann: [2] });
    expect(Object.getPrototypeOf(read.budget)).toBe(Object.prototype);
  });
});

describe('raised hands', () => {
  const started = () => chain(handsActivity, [[HOST, { type: 'start' }]]);
  const withHands = () => chain(handsActivity, [[HOST, { type: 'start' }], ['ann', { type: 'raise' }], ['bo', { type: 'raise' }], ['cy', { type: 'raise' }]]);

  it('is started by the host, and a hand goes up under the player\'s own name', () => {
    expect(run(handsActivity, null, { type: 'start' }, 'ann')).toBe('refuse:not-host');
    expect(readHands(room({ hands: started() }))).toEqual({ hands: [], speaking: null });
    expect(readHands(room({ hands: withHands() }))?.hands.map((h) => [h.by, h.name])).toEqual([['ann', 'ANN'], ['bo', 'BO'], ['cy', 'CY']]);
  });

  it('keeps first raised, first called, and a second raise changes nothing', () => {
    const s = withHands();
    expect(run(handsActivity, s, { type: 'raise' }, 'ann')).toEqual(s);
    expect(readHands(room({ hands: run(handsActivity, s, { type: 'lower' }, 'ann') }))?.hands.map((h) => h.by)).toEqual(['bo', 'cy']);
  });

  it('lets the host call the next, call by name, finish, send a hand down and clear', () => {
    let s = withHands();
    s = run(handsActivity, s, { type: 'call' }, HOST);
    expect(readHands(room({ hands: s }))).toMatchObject({ speaking: { by: 'ann' } });
    s = run(handsActivity, s, { type: 'call', by: 'cy' }, HOST);
    expect(readHands(room({ hands: s }))).toMatchObject({ speaking: { by: 'cy' } });
    s = run(handsActivity, s, { type: 'done' }, HOST);
    expect(readHands(room({ hands: s }))?.speaking).toBeNull();
    s = run(handsActivity, s, { type: 'dismiss', by: 'bo' }, HOST);
    expect(readHands(room({ hands: s }))?.hands).toEqual([]);
    expect(readHands(room({ hands: run(handsActivity, withHands(), { type: 'clear' }, HOST) }))).toEqual({ hands: [], speaking: null });
  });

  it('keeps the host\'s moves to the host, and the player\'s to the players', () => {
    const s = withHands();
    for (const action of [{ type: 'call' }, { type: 'done' }, { type: 'clear' }, { type: 'dismiss', by: 'ann' }]) {
      expect(run(handsActivity, s, action, 'ann')).toBe('refuse:not-host');
    }
    expect(run(handsActivity, s, { type: 'raise' }, HOST)).toBe('refuse:bad-action');
    expect(run(handsActivity, s, { type: 'lower' }, HOST)).toBe('refuse:bad-action');
  });

  it('refuses a stranger raising, a move before the start, and anything that is not a move', () => {
    expect(run(handsActivity, started(), { type: 'raise' }, 'stranger')).toBe('refuse:bad-action');
    expect(run(handsActivity, null, { type: 'raise' }, 'ann')).toBe('refuse:wrong-phase');
    for (const action of [null, 'raise', { type: 4 }, { type: 'wave' }, { type: 'dismiss' }, { type: 'dismiss', by: 4 }, { type: 'call', by: 4 }]) {
      expect(run(handsActivity, withHands(), action, HOST)).toMatch(/^refuse:/);
    }
  });

  it('reads hands from the room as untrusted data, without anyone gone', () => {
    expect(readHands(null)).toBeNull();
    expect(readHands(room({ hands: 4 }))).toBeNull();
    expect(readHands(room({ hands: { hands: 'x' } }))).toBeNull();
    const got = readHands(
      room({
        hands: {
          hands: [{ by: 'ann', name: 'A', at: 1 }, { by: 'ann', name: 'again', at: 2 }, { by: 'gone', name: 'G', at: 3 }, { by: 'bo', name: 5, at: 3 }, null],
          speaking: { by: 'gone', name: 'G', at: 0 },
        },
      }),
    )!;
    expect(got.hands).toEqual([{ by: 'ann', name: 'A', at: 1 }]);
    expect(got.speaking).toBeNull();
    expect(readHands(room({ hands: { hands: [], speaking: { by: 'cy', name: 'C', at: 0 } } }))?.speaking?.by).toBe('cy');
    expect(readHands(room({ hands: { hands: [], speaking: 'x' } }))?.speaking).toBeNull();
  });
});

describe('the spectrum', () => {
  const spectrum = spectrumActivity({ min: 0, max: 100 });
  const started = () => chain(spectrum, [[HOST, { type: 'start' }]]);

  it('starts open and empty, as the host, and the host clears it', () => {
    expect(run(spectrum, null, { type: 'start' }, 'ann')).toBe('refuse:not-host');
    expect(readSpectrum(room({ spectrum: started() }))).toEqual({ placed: {}, open: true, values: [] });
    const s = chain(spectrum, [[HOST, { type: 'start' }], ['ann', { type: 'place', value: 10 }]]);
    expect(readSpectrum(room({ spectrum: run(spectrum, s, { type: 'clear' }, HOST) }))?.values).toEqual([]);
  });

  it('places a dot per person, and placing again moves it', () => {
    const s = chain(spectrum, [[HOST, { type: 'start' }], ['ann', { type: 'place', value: 10 }], ['bo', { type: 'place', value: 90 }], ['ann', { type: 'place', value: 30 }]]);
    expect(readSpectrum(room({ spectrum: s }))).toMatchObject({ placed: { ann: 30, bo: 90 }, values: [30, 90] });
  });

  it('keeps a dot on the line, and refuses what is not a number', () => {
    expect(readSpectrum(room({ spectrum: run(spectrum, started(), { type: 'place', value: 250 }, 'ann') }))?.placed.ann).toBe(100);
    expect(readSpectrum(room({ spectrum: run(spectrum, started(), { type: 'place', value: -5 }, 'ann') }))?.placed.ann).toBe(0);
    for (const value of ['50', Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
      expect(run(spectrum, started(), { type: 'place', value }, 'ann')).toBe('refuse:bad-action');
    }
  });

  it('closes and opens, and a closed spectrum takes no dot', () => {
    const closed = run(spectrum, started(), { type: 'open', on: false }, HOST);
    expect(run(spectrum, closed, { type: 'place', value: 5 }, 'ann')).toBe('refuse:wrong-phase');
    expect(readSpectrum(room({ spectrum: run(spectrum, closed, { type: 'open', on: true }, HOST) }))?.open).toBe(true);
    expect(run(spectrum, started(), { type: 'open', on: false }, 'ann')).toBe('refuse:not-host');
    expect(run(spectrum, started(), { type: 'open', on: 'no' }, HOST)).toBe('refuse:bad-action');
  });

  it('refuses a dot before the start, the host placing one, and anything that is not a move', () => {
    expect(run(spectrum, null, { type: 'place', value: 5 }, 'ann')).toBe('refuse:wrong-phase');
    expect(run(spectrum, started(), { type: 'place', value: 5 }, HOST)).toBe('refuse:bad-action');
    for (const action of [null, 'place', { type: 3 }, { type: 'drag' }]) expect(run(spectrum, started(), action, 'ann')).toBe('refuse:bad-action');
  });

  it('uses the default line, 0 to 100, and reads the room as untrusted data without anyone gone', () => {
    expect(readSpectrum(room({ spectrum: run(spectrumActivity(), started(), { type: 'place', value: 500 }, 'ann') }))?.placed.ann).toBe(100);
    expect(readSpectrum(null)).toBeNull();
    expect(readSpectrum(room({}))).toBeNull();
    expect(readSpectrum(room({ spectrum: { placed: 'x' } }))).toBeNull();
    const got = readSpectrum(room({ spectrum: { open: false, placed: { ann: 4, gone: 9, bo: 'x', '': 3 } } }))!;
    expect(got).toEqual({ open: false, placed: { ann: 4 }, values: [4] });
  });
});
