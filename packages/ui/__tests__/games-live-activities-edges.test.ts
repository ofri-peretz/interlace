/**
 * The edges of the room's Q&A board, reactions, hands and spectrum rules, and of the room's `submit`: the
 * exact refusal for each malformed move, the length and size limits to the character, and what a restored
 * room keeps. Mutation testing (#270) found that none of these was asserted.
 */
import { describe, expect, it } from 'vitest';

import {
  BOARD_KEY, HANDS_KEY, REACTIONS_KEY, RECENT_REACTIONS, SPECTRUM_KEY,
  boardActivity, handsActivity, reactionsActivity, readBoard, readHands, readReactions, readSpectrum, spectrumActivity,
} from '../src/games/live-activities-model.js';
import {
  ACK_KEEP, MAX_SHARED_SIZE, applyRoomEvent, createRoom, rejectRoomEvent, restoreRoom, serializeRoom,
  type ActivityContext, type ActivityReducer, type RoomState,
} from '../src/games/room-model.js';

const players = ['ann', 'bo', 'cy'].map((id) => ({ id, name: id.toUpperCase(), connected: true }));
const ctx = (playerId: string, at = 1000, host = false): ActivityContext => ({ playerId, host, at, players });
const as = (reducer: ActivityReducer, slice: unknown, action: unknown, by = 'ann', at = 1000) => reducer(slice, action, ctx(by, at, by === 'host'));
const BAD = { refuse: 'bad-action' };
const room = (key: string, slice: unknown, ids = ['ann', 'bo', 'cy']) => ({ shared: { [key]: slice }, players: ids.map((id) => ({ id, name: id, connected: true })) });
const long = (n: number) => 'x'.repeat(n);

const board = boardActivity();
const startedBoard = () => (as(board, null, { type: 'begin', moderated: false }, 'host') as { slice: unknown }).slice;

describe('the Q&A board: what is not a move is refused, exactly', () => {
  it('refuses a move that is not an object with a text type', () => {
    for (const action of [null, undefined, 'ask', 4, [], { type: 7 }, {}]) expect(as(board, startedBoard(), action)).toEqual(BAD);
  });

  it('refuses an unknown move, and a question that is not text', () => {
    expect(as(board, startedBoard(), { type: 'dance' })).toEqual(BAD);
    expect(as(board, startedBoard(), { type: 'ask', text: 5 })).toEqual(BAD);
  });

  it('refuses the host asking or voting, and a player doing the host\'s moves', () => {
    expect(as(board, startedBoard(), { type: 'ask', text: 'Hi' }, 'host')).toEqual(BAD);
    expect(as(board, startedBoard(), { type: 'vote', id: 'q1' }, 'host')).toEqual(BAD);
    expect(as(board, startedBoard(), { type: 'approve', id: 'q1' })).toEqual({ refuse: 'not-host' });
    expect(as(board, startedBoard(), { type: 'moderate', on: true })).toEqual({ refuse: 'not-host' });
  });

  it('wants a question id of 1 to 64 characters to vote, unvote, approve, dismiss, restore or answer', () => {
    const asked = (as(board, startedBoard(), { type: 'ask', text: 'Why?' }) as { slice: unknown }).slice;
    for (const type of ['vote', 'unvote']) {
      for (const id of ['', long(65), 7, null]) expect(as(board, asked, { type, id }, 'bo')).toEqual(BAD);
    }
    const voted = (as(board, asked, { type: 'vote', id: 'q1' }, 'bo') as { slice: unknown }).slice;
    expect(voted).toBeDefined();
    expect(as(board, voted, { type: 'unvote', id: 'q1' }, 'bo')).toHaveProperty('slice');
    {
    }
    for (const type of ['approve', 'dismiss', 'restore', 'answer']) {
      for (const id of ['', long(65), 7, null]) expect(as(board, asked, { type, id }, 'host')).toEqual(BAD);
    }
  });

  it('wants a question id of up to 64 characters to pin it, or null to unpin; and a true or false for moderate and open', () => {
    const asked = (as(board, startedBoard(), { type: 'ask', text: 'Why?' }) as { slice: unknown }).slice;
    for (const id of ['', long(65), 7, undefined]) expect(as(board, asked, { type: 'pin', id }, 'host')).toEqual(BAD);
    expect(as(board, asked, { type: 'pin', id: null }, 'host')).toHaveProperty('slice');
    expect(as(board, asked, { type: 'pin', id: 'q1' }, 'host')).toHaveProperty('slice');
    for (const type of ['moderate', 'open']) {
      for (const on of ['yes', 1, null, undefined]) expect(as(board, asked, { type, on }, 'host')).toEqual(BAD);
      expect(as(board, asked, { type, on: false }, 'host')).toHaveProperty('slice');
    }
  });

  it('refuses a move before the board begins, and only the host begins it', () => {
    expect(as(board, null, { type: 'ask', text: 'Hi' })).toEqual({ refuse: 'wrong-phase' });
    expect(as(board, null, { type: 'begin' })).toEqual({ refuse: 'not-host' });
  });
});

describe('the Q&A board: one-character ids, 64-character ids, and what a vote list keeps', () => {
  const question = (over: Record<string, unknown> = {}) => ({ id: 'q1', text: 'Why?', by: 'ann', at: 5, status: 'live', votes: [], ...over });
  const withQuestions = (qs: unknown[]) => ({ questions: qs, moderated: false, open: true, pinned: null, seq: 1 });

  it('reads a one-character question id, writer and voter', () => {
    const read = readBoard(room(BOARD_KEY, withQuestions([question({ id: 'q', by: 'a', votes: ['b'] })]), ['a', 'b']))!;
    expect(read.questions).toHaveLength(1);
    expect(read.questions[0]!.votes).toEqual(['b']);
  });

  it('keeps only text voters when a vote is cast on a slice a restored host held', () => {
    const slice = withQuestions([question({ votes: [5, null, '', 'bo', 'bo', long(65)] })]);
    const out = (as(board, slice, { type: 'vote', id: 'q1' }, 'cy') as { slice: any }).slice;
    expect(out.questions[0].votes).toEqual(['bo', 'cy']);
  });

  it('acts on a question whose id is exactly 64 characters', () => {
    const id = long(64);
    const live = withQuestions([question({ id })]);
    const review = withQuestions([question({ id, status: 'review' })]);
    expect(as(board, live, { type: 'vote', id }, 'bo')).toHaveProperty('slice');
    expect((as(board, review, { type: 'approve', id }, 'host') as { slice: any }).slice.questions[0].status).toBe('live');
    expect((as(board, live, { type: 'pin', id }, 'host') as { slice: any }).slice.pinned).toBe(id);
  });
});

describe('the Q&A board: what a room holds is read to the character', () => {
  const question = (over: Record<string, unknown> = {}) => ({ id: 'q1', text: 'Why?', by: 'ann', at: 5, status: 'live', votes: [], ...over });
  const slice = (questions: unknown[]) => ({ questions, moderated: true, open: true, pinned: null, seq: 1 });
  const ids = (qs: unknown[]) => readBoard(room(BOARD_KEY, slice(qs)))!.questions.map((q) => q.id);

  it('keeps a question id and a writer of 64 characters, and drops 65', () => {
    expect(ids([question({ id: long(64) })])).toEqual([long(64)]);
    expect(ids([question({ id: long(65) })])).toEqual([]);
    expect(ids([question({ id: '' })])).toEqual([]);
    expect(readBoard(room(BOARD_KEY, slice([question({ by: long(64) })]), [long(64)]))!.questions).toHaveLength(1);
    expect(readBoard(room(BOARD_KEY, slice([question({ by: long(65) })]), [long(65)]))!.questions).toHaveLength(0);
    expect(ids([question({ by: '' })])).toEqual([]);
  });

  it('keeps a voter of 64 characters, drops 65 and anything that is not text, and counts a voter once', () => {
    const voters = ['bo', 'bo', 5, null, '', long(65), 'cy', long(64)];
    const read = readBoard(room(BOARD_KEY, slice([question({ votes: voters })]), ['ann', 'bo', 'cy', long(64)]))!;
    expect(read.questions[0]!.votes).toEqual(['bo', 'cy', long(64)]);
  });

  it('drops a question that is not the shape', () => {
    expect(ids([null, 'x', question({ text: 5 }), question({ at: 'now' }), question({ status: 'weird' }), question({ votes: 'bo' }), question({ id: 'q2' })])).toEqual(['q2']);
  });
});

describe('reactions: the limits, to the character and the millisecond', () => {
  const react = reactionsActivity({ kinds: ['clap', 'heart'] });
  const started = () => (as(react, null, { type: 'start' }, 'host') as { slice: any }).slice;
  const send = (slice: unknown, by: string, at: number, kind = 'clap') => as(react, slice, { type: 'react', kind }, by, at) as { slice: any };

  it('starts with every kind at nothing and nothing recent, and refuses a phone starting it', () => {
    expect(started()).toEqual({ totals: { clap: 0, heart: 0 }, recent: [], n: 0, budget: {} });
    expect(as(react, null, { type: 'start' })).toEqual({ refuse: 'not-host' });
  });

  it('refuses what is not a reaction, exactly', () => {
    for (const action of [null, 'react', 3, [], {}, { type: 5 }, { type: 'dance' }]) expect(as(react, started(), action)).toEqual(BAD);
    expect(as(react, started(), { type: 'react', kind: 'clap' }, 'host')).toEqual(BAD);
    expect(as(react, started(), { type: 'react', kind: 'shout' })).toEqual(BAD);
    expect(as(react, started(), { type: 'react', kind: 3 })).toEqual(BAD);
    expect(as(react, null, { type: 'react', kind: 'clap' })).toEqual({ refuse: 'wrong-phase' });
  });

  it('keeps the last 40 reactions, and says how many there have been', () => {
    expect(RECENT_REACTIONS).toBe(40);
    let s = started();
    for (let i = 0; i < 41; i++) s = send(s, 'ann', 1000 + i * 5000).slice;
    expect(s.recent).toHaveLength(40);
    expect(s.recent[0].id).toBe('r2');
    expect(s.recent[39].id).toBe('r41');
    expect(s.n).toBe(41);
    expect(s.totals.clap).toBe(41);
    const big = { ...s, recent: Array.from({ length: 45 }, (_, i) => ({ id: `r${i}`, kind: 'clap', by: 'ann', at: i })) };
    const read = readReactions(room(REACTIONS_KEY, big))!;
    expect(read.recent).toHaveLength(40);
    expect(read.recent[0]!.id).toBe('r5');
  });

  it('forgets a player\'s times after the window, to the millisecond (3000 by default)', () => {
    let s = started();
    s = send(s, 'ann', 10_000).slice;
    expect(send(s, 'bo', 12_999).slice.budget.ann).toEqual([10_000]); // 2999 ms: still inside the window
    expect(send(s, 'bo', 13_000).slice.budget.ann).toBeUndefined(); // exactly 3000 ms: out
    const slow = reactionsActivity({ kinds: ['clap'], windowMs: 10_000 });
    const t = (as(slow, null, { type: 'start' }, 'host') as { slice: any }).slice;
    const first = as(slow, t, { type: 'react', kind: 'clap' }, 'ann', 10_000) as { slice: any };
    expect((as(slow, first.slice, { type: 'react', kind: 'clap' }, 'bo', 19_999) as { slice: any }).slice.budget.ann).toEqual([10_000]);
  });

  it('refuses a move of another type that carries a valid kind, and drops recent entries that are not reactions', () => {
    expect(as(react, started(), { type: 'dance', kind: 'clap' })).toEqual(BAD);
    const base = { id: 'r1', kind: 'clap', by: 'ann', at: 1 };
    const read = readReactions(room(REACTIONS_KEY, { totals: {}, recent: [null, 'x', 4, [], { ...base, at: 'now' }, { ...base, id: 'r2' }], n: 2, budget: {} }))!;
    expect(read.recent.map((r) => r.id)).toEqual(['r2']);
  });

  it('keeps a reaction id of 20 characters and a kind of 32, and drops longer or empty ones', () => {
    const slice = (r: unknown) => ({ totals: {}, recent: [r], n: 1, budget: {} });
    const rd = (r: unknown) => readReactions(room(REACTIONS_KEY, slice(r)))!.recent.length;
    const base = { id: 'r1', kind: 'clap', by: 'ann', at: 1 };
    expect(rd({ ...base, id: long(20) })).toBe(1);
    expect(rd({ ...base, id: long(21) })).toBe(0);
    expect(rd({ ...base, kind: long(32) })).toBe(1);
    expect(rd({ ...base, kind: long(33) })).toBe(0);
    expect(rd({ ...base, by: long(64) })).toBe(1);
    expect(rd({ ...base, by: long(65) })).toBe(0);
    expect(rd({ ...base, id: '' })).toBe(0);
  });
});

describe('raised hands: the moves and the reading, exactly', () => {
  const hands = handsActivity;
  const started = () => (as(hands, null, { type: 'start' }, 'host') as { slice: any }).slice;
  const raised = () => (as(hands, started(), { type: 'raise' }, 'ann', 100) as { slice: any }).slice;

  it('refuses what is not a move, a host raising, and a stranger raising', () => {
    for (const action of [null, 'raise', 3, [], {}, { type: 5 }, { type: 'dance' }]) expect(as(hands, started(), action)).toEqual(BAD);
    expect(as(hands, started(), { type: 'raise' }, 'host')).toEqual(BAD);
    expect(as(hands, started(), { type: 'raise' }, 'stranger')).toEqual(BAD);
    expect(as(hands, null, { type: 'raise' })).toEqual({ refuse: 'wrong-phase' });
    expect(as(hands, null, { type: 'start' })).toEqual({ refuse: 'not-host' });
  });

  it('wants a player id of 1 to 64 characters to dismiss, and for a call a name only when there is one', () => {
    for (const by of ['', long(65), 7, undefined]) expect(as(hands, raised(), { type: 'dismiss', by }, 'host')).toEqual(BAD);
    expect(as(hands, raised(), { type: 'dismiss', by: 'ann' }, 'host')).toHaveProperty('slice');
    for (const by of ['', long(65), 7, null]) expect(as(hands, raised(), { type: 'call', by }, 'host')).toEqual(BAD);
    expect(as(hands, raised(), { type: 'dismiss', by: 'ann' })).toEqual({ refuse: 'not-host' });
  });

  it('calls or dismisses a person whose id is exactly 64 characters', () => {
    const id = long(64);
    const slice = { hands: [{ by: id, name: 'N', at: 1 }], speaking: null };
    expect((as(hands, slice, { type: 'call', by: id }, 'host') as { slice: any }).slice.speaking.by).toBe(id);
    expect((as(hands, slice, { type: 'dismiss', by: id }, 'host') as { slice: any }).slice.hands).toEqual([]);
  });

  it('calls the person asked for, or the first in line when no one is named', () => {
    let s = raised();
    s = (as(hands, s, { type: 'raise' }, 'bo', 200) as { slice: any }).slice;
    expect((as(hands, s, { type: 'call' }, 'host') as { slice: any }).slice.speaking.by).toBe('ann');
    expect((as(hands, s, { type: 'call', by: 'bo' }, 'host') as { slice: any }).slice.speaking.by).toBe('bo');
  });

  it('reads a hand of 64 characters, drops 65, and reads no speaker as none', () => {
    const hand = (by: string) => ({ by, name: 'N', at: 1 });
    const rd = (slice: unknown, ids: string[]) => readHands(room(HANDS_KEY, slice, ids));
    expect(rd({ hands: [hand(long(64))], speaking: null }, [long(64)])!.hands).toHaveLength(1);
    expect(rd({ hands: [hand(long(65))], speaking: null }, [long(65)])!.hands).toHaveLength(0);
    expect(rd({ hands: [], speaking: null }, [])!.speaking).toBeNull();
    expect(rd({ hands: [], speaking: hand('ann') }, ['ann'])!.speaking).toEqual(hand('ann'));
    expect(rd({ hands: [], speaking: 'ann' }, ['ann'])!.speaking).toBeNull(); // a speaker that is not a hand is no speaker
    expect(rd({ hands: [], speaking: hand('gone') }, ['ann'])!.speaking).toBeNull();
  });
});

describe('spectrum: the moves and the reading, exactly', () => {
  const spec = spectrumActivity();
  const started = () => (as(spec, null, { type: 'start' }, 'host') as { slice: any }).slice;

  it('refuses what is not a move, exactly', () => {
    for (const action of [null, 'place', 3, [], {}, { type: 5 }, { type: 'dance' }]) expect(as(spec, started(), action)).toEqual(BAD);
    expect(as(spec, started(), { type: 'dance', value: 5 })).toEqual(BAD);
    expect(as(spec, started(), { type: 'place', value: 'x' })).toEqual(BAD);
    expect(as(spec, started(), { type: 'place', value: Infinity })).toEqual(BAD);
    expect(as(spec, started(), { type: 'place', value: 5 }, 'host')).toEqual(BAD);
    expect(as(spec, started(), { type: 'open', on: false })).toEqual({ refuse: 'not-host' });
  });

  it('reads a player key of 64 characters and drops 65 or empty, and a value that is not a finite number', () => {
    const rd = (placed: Record<string, unknown>, ids: string[]) => Object.keys(readSpectrum(room(SPECTRUM_KEY, { placed, open: true }, ids))!.placed);
    expect(rd({ [long(64)]: 5 }, [long(64)])).toEqual([long(64)]);
    expect(rd({ [long(65)]: 5 }, [long(65)])).toEqual([]);
    expect(rd({ '': 5 }, [''])).toEqual([]);
    expect(rd({ ann: '5', bo: NaN, cy: 7 }, ['ann', 'bo', 'cy'])).toEqual(['cy']);
    expect(rd({ ann: Number.POSITIVE_INFINITY }, ['ann'])).toEqual([]);
  });
});

describe('the room\'s submit: ids, sizes and what a restored room keeps', () => {
  const settings = { activities: { counter: ((slice: unknown, action: unknown) => ({ slice: (action as { value?: unknown }).value ?? slice ?? 0 })) as ActivityReducer } };
  const base = () => {
    let r: RoomState = createRoom({ code: 'K7Q4MZ', hostId: 'host' });
    r = applyRoomEvent(r, { type: 'join', playerId: 'ann', name: 'Ann' }, 'ann', settings);
    return r;
  };
  const submit = (r: RoomState, id: unknown, value: unknown = 1, at: unknown = 1000) =>
    applyRoomEvent(r, { type: 'submit', playerId: 'ann', id, key: 'counter', action: { value }, at } as never, 'ann', settings);

  it('wants an id of 1 to 64 characters and a finite time', () => {
    const r = base();
    const why = (id: unknown, ...time: unknown[]) =>
      rejectRoomEvent(r, { type: 'submit', playerId: 'ann', id, key: 'counter', action: { value: 1 }, at: time.length ? time[0] : 1000 } as never, 'ann', settings);
    expect(why(long(64))).toBeNull();
    expect(why(long(65))).toBe('bad-action');
    expect(why('')).toBe('bad-action');
    expect(why(5)).toBe('bad-action');
    expect(why('a', undefined)).toBe('bad-action');
    expect(why('a', Number.NaN)).toBe('bad-action');
    expect(why('a', '1000')).toBe('bad-action');
    expect(why('a', Number.POSITIVE_INFINITY)).toBe('bad-action');
    expect(submit(r, long(64)).shared?.counter).toBe(1);
  });

  it('refuses a move the activity refuses, and one that is too big, to the character', () => {
    const r = base();
    const ev = { type: 'submit', playerId: 'ann', id: 'a', key: 'counter', action: {}, at: 1 } as never;
    const refusing = { activities: { counter: (() => ({ refuse: 'bad-action' })) as ActivityReducer } };
    expect(rejectRoomEvent(r, ev, 'ann', refusing)).toBe('bad-action');
    const sized = (n: number) => rejectRoomEvent(r, { type: 'submit', playerId: 'ann', id: 'a', key: 'counter', action: { value: 'x'.repeat(n) }, at: 1 } as never, 'ann', settings);
    const exact = MAX_SHARED_SIZE - 2; // a string whose JSON, with its two quotes, is exactly MAX_SHARED_SIZE
    expect(sized(exact)).toBeNull();
    expect(sized(exact + 1)).toBe('full');
    const undef = { activities: { counter: (() => ({ slice: () => 1 })) as ActivityReducer } }; // JSON has no form for a function
    expect(rejectRoomEvent(r, ev, 'ann', undef)).toBe('full');
  });

  it('remembers the last 16 ids of a player\'s moves, and a restored room keeps the same', () => {
    expect(ACK_KEEP).toBe(16);
    let r = base();
    for (let i = 0; i < 20; i++) r = submit(r, `m${i}`, i);
    expect(r.acked!.ann).toEqual(Array.from({ length: 16 }, (_, i) => `m${i + 4}`));
    const back = restoreRoom(serializeRoom(r), { hostId: 'host' })!;
    expect(back.acked!.ann).toEqual(r.acked!.ann);
  });

  it('restores acknowledgements as ids of 1 to 64 characters, and not more than the last 16', () => {
    const raw = JSON.parse(serializeRoom(base()));
    const restore = (ann: unknown) => restoreRoom(JSON.stringify({ ...raw, acked: { ann } }), { hostId: 'host' })?.acked;
    expect(restore([long(64)])!.ann).toEqual([long(64)]);
    expect(restore(['a'])!.ann).toEqual(['a']);
    expect(restore([long(65), '', 7, null, 'ok'])!.ann).toEqual(['ok']);
    expect(restore('nope')).toBeUndefined();
    expect(restore(Array.from({ length: 20 }, (_, i) => `a${i}`))!.ann).toHaveLength(16);
    expect(restore(Array.from({ length: 20 }, (_, i) => `a${i}`))!.ann![0]).toBe('a4');
    expect(restore([])!.ann).toEqual([]);
  });
});
