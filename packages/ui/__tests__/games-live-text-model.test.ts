/**
 * Typed text on a room: the word cloud, the open wall (and shared reflections) and the note board. Nothing
 * reaches a screen without the host's checks.
 */
import { describe, expect, it } from 'vitest';

import {
  CLOUD_KEY, MAX_NOTES_IN_ROOM, MAX_POSTS_IN_ROOM, MAX_WORDS_IN_ROOM, NOTES_KEY, NOTES_PER_PLAYER, POSTS_PER_PLAYER, WALL_KEY,
  cloudActivity, notesActivity, readCloud, readNotes, readWall, wallActivity,
  type CloudState, type NotesState, type WallState,
} from '../src/games/live-text-model.js';
import { foldNote } from './live-text-helpers.js';

const players = ['p1', 'p2', 'p3'].map((id) => ({ id, name: id, connected: true }));
const ctx = (playerId: string, host = false, at = 1) => ({ playerId, host, at, players });
const room = (key: string, slice: unknown, ids = ['p1', 'p2']) => ({ shared: { [key]: slice }, players: ids.map((id) => ({ id, name: id, connected: true })) });

describe('word cloud', () => {
  const act = cloudActivity({ blocklist: ['badword'] });
  const run = (slice: unknown, action: unknown, who = 'p1', host = false) => act(slice, action, ctx(who, host));
  const start = () => (run(null, { type: 'start' }, 'host', true) as { slice: CloudState }).slice;

  it('lets only the host start, with 1 to 10 words each (3 by default)', () => {
    expect(start()).toMatchObject({ entries: [], maxWords: 3, open: true });
    expect(run(null, { type: 'start' })).toEqual({ refuse: 'not-host' });
    expect(run(null, { type: 'start', maxWords: 5 }, 'host', true)).toMatchObject({ slice: { maxWords: 5 } });
    for (const maxWords of [0, 11, 1.5, 'x']) expect(run(null, { type: 'start', maxWords }, 'host', true)).toEqual({ refuse: 'bad-action' });
  });

  it('takes one word at a time, up to the limit, the same word once, as the player the room says', () => {
    let s = start();
    for (const text of ['Sea', 'Sun', 'Sand']) s = (run(s, { type: 'word', text }) as { slice: CloudState }).slice;
    expect(s.entries.map((e) => e.text)).toEqual(['Sea', 'Sun', 'Sand']);
    expect(run(s, { type: 'word', text: 'More' })).toEqual({ refuse: 'bad-action' }); // the fourth
    expect(run(start(), { type: 'word', text: 'Sea' })).toMatchObject({ slice: {} });
    const once = run(start(), { type: 'word', text: 'Sea' }) as { slice: CloudState };
    expect(run(once.slice, { type: 'word', text: ' sea ' })).toEqual({ refuse: 'bad-action' }); // the same word, folded
    expect(run(once.slice, { type: 'word', text: 'Sea' }, 'p2')).toMatchObject({ slice: {} }); // another person may
  });

  it('refuses text that is not one clean word, and the host sending', () => {
    for (const text of ['two words', 'x'.repeat(26), '', 'http://x.com', 'badword', 'B4DW0RD', 7, null]) expect(run(start(), { type: 'word', text })).toEqual({ refuse: 'bad-action' });
    expect(run(start(), { type: 'word', text: 'Sea' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(null, { type: 'word', text: 'Sea' })).toEqual({ refuse: 'wrong-phase' });
    expect(cloudActivity({ maxLength: 99 })(start(), { type: 'word', text: 'x'.repeat(26) }, ctx('p1'))).toEqual({ refuse: 'bad-action' }); // the cap is the cloud's
    expect(cloudActivity({ maxLength: 5 })(start(), { type: 'word', text: 'Mediterranean' }, ctx('p1'))).toEqual({ refuse: 'bad-action' }); // a stricter one is kept
  });

  it('closes, reopens and clears for the host only', () => {
    const closed = run(start(), { type: 'open', on: false }, 'host', true) as { slice: CloudState };
    expect(run(closed.slice, { type: 'word', text: 'Sea' })).toEqual({ refuse: 'wrong-phase' });
    expect(run(closed.slice, { type: 'open', on: true }, 'host', true)).toMatchObject({ slice: { open: true } });
    expect(run(start(), { type: 'open', on: 'x' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(start(), { type: 'open', on: false })).toEqual({ refuse: 'not-host' });
    expect(run(null, { type: 'clear' }, 'host', true)).toEqual({ refuse: 'wrong-phase' });
    const full = { ...start(), entries: [{ by: 'p1', text: 'Sea' }], open: false };
    expect(run(full, { type: 'clear' }, 'host', true)).toMatchObject({ slice: { entries: [], open: true } });
    expect(run(full, { type: 'clear' })).toEqual({ refuse: 'not-host' });
    for (const action of [null, 'word', 3, {}, { type: 5 }, { type: 'dance' }]) expect(run(start(), action)).toEqual({ refuse: 'bad-action' });
  });

  it('stops growing at the room limit', () => {
    const lots = { ...start(), maxWords: 10, entries: Array.from({ length: MAX_WORDS_IN_ROOM }, (_, i) => ({ by: `q${i}`, text: `w${i}` })) };
    expect(run(lots, { type: 'word', text: 'Sea' })).toEqual({ refuse: 'full' });
  });

  it('reads the room as untrusted, and drops words of people who left', () => {
    expect(readCloud(null)).toBeNull();
    expect(readCloud({ shared: {}, players: [] })).toBeNull();
    for (const bad of [5, { entries: 'x', maxWords: 3 }, { entries: [], maxWords: 0 }, { entries: [], maxWords: 11 }, { entries: [], maxWords: 'x' }]) expect(readCloud(room(CLOUD_KEY, bad))).toBeNull();
    const slice = { entries: [{ by: 'p1', text: 'Sea' }, { by: 'gone', text: 'Sun' }, { by: 'p2', text: '' }, { by: 'p2', text: 'x'.repeat(61) }, null, { by: 'p2', text: 'Sand' }], maxWords: 3, open: false };
    const read = readCloud(room(CLOUD_KEY, slice))!;
    expect(read.words).toEqual([{ text: 'Sea', by: 'p1' }, { text: 'Sand', by: 'p2' }]);
    expect(read.open).toBe(false);
  });
});

describe('open wall', () => {
  const act = wallActivity({ blocklist: ['badword'] });
  const run = (slice: unknown, action: unknown, who = 'p1', host = false, at = 1) => act(slice, action, ctx(who, host, at));
  const start = (options: Record<string, unknown> = {}) => (run(null, { type: 'start', ...options }, 'host', true) as { slice: WallState }).slice;
  const post = (s: unknown, text: string, who = 'p1', at = 1) => (run(s, { type: 'post', text }, who, false, at) as { slice: WallState }).slice;

  it('starts moderated unless the host says otherwise, only for the host', () => {
    expect(start()).toMatchObject({ moderated: true, open: true, spotlight: null, n: 0 });
    expect(start({ moderated: false }).moderated).toBe(false);
    expect(run(null, { type: 'start' })).toEqual({ refuse: 'not-host' });
    expect(run(null, { type: 'start', moderated: 'no' }, 'host', true)).toEqual({ refuse: 'bad-action' });
  });

  it('holds a post for review when moderated and shows it at once when not', () => {
    const a = post(start(), 'Hello there');
    expect(a.posts).toEqual([{ id: 'w1', text: 'Hello there', by: 'p1', at: 1, status: 'review' }]);
    expect(readWall(room(WALL_KEY, a))).toMatchObject({ live: [], review: [{ id: 'w1' }] });
    const b = post(start({ moderated: false }), 'Hello there');
    expect(readWall(room(WALL_KEY, b))).toMatchObject({ live: [{ id: 'w1' }], review: [] });
  });

  it('checks every post on the host, and refuses the host posting, a post before it starts and one when closed', () => {
    for (const text of ['', 'x'.repeat(201), 'see http://x.com', 'a badword here', 'mail me a@b.co', 4]) expect(run(start(), { type: 'post', text })).toEqual({ refuse: 'bad-action' });
    expect(run(start(), { type: 'post', text: 'Hi' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(null, { type: 'post', text: 'Hi' })).toEqual({ refuse: 'wrong-phase' });
    const closed = run(start(), { type: 'open', on: false }, 'host', true) as { slice: WallState };
    expect(run(closed.slice, { type: 'post', text: 'Hi' })).toEqual({ refuse: 'wrong-phase' });
  });

  it('limits each person to five posts at a time, and a dismissed post does not count', () => {
    let s = start({ moderated: false });
    for (let i = 0; i < POSTS_PER_PLAYER; i++) s = post(s, `Post ${i}`);
    expect(run(s, { type: 'post', text: 'One more' })).toEqual({ refuse: 'rate-limited' });
    expect(run(s, { type: 'post', text: 'Other person' }, 'p2')).toMatchObject({ slice: {} });
    const dismissed = (run(s, { type: 'dismiss', id: 'w1' }, 'host', true) as { slice: WallState }).slice;
    expect(run(dismissed, { type: 'post', text: 'Now it fits' })).toMatchObject({ slice: {} });
  });

  it('stops at the room limit', () => {
    const lots = { ...start(), posts: Array.from({ length: MAX_POSTS_IN_ROOM }, (_, i) => ({ id: `w${i}`, text: 't', by: `q${i}`, at: i, status: 'dismissed' })), n: MAX_POSTS_IN_ROOM };
    expect(run(lots, { type: 'post', text: 'Hi' })).toEqual({ refuse: 'full' });
  });

  it('approves, dismisses, spotlights and clears for the host only', () => {
    const s = post(start(), 'Hello');
    const live = (run(s, { type: 'approve', id: 'w1' }, 'host', true) as { slice: WallState }).slice;
    expect(live.posts[0]?.status).toBe('live');
    const lit = (run(live, { type: 'spotlight', id: 'w1' }, 'host', true) as { slice: WallState }).slice;
    expect(lit.spotlight).toBe('w1');
    expect((run(lit, { type: 'spotlight', id: null }, 'host', true) as { slice: WallState }).slice.spotlight).toBeNull();
    expect((run(lit, { type: 'dismiss', id: 'w1' }, 'host', true) as { slice: WallState }).slice).toMatchObject({ spotlight: null });
    expect(run(s, { type: 'spotlight', id: 'w1' }, 'host', true)).toEqual({ refuse: 'bad-action' }); // not showing yet
    expect(run(s, { type: 'spotlight', id: 5 }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(s, { type: 'approve', id: 'zzz' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(s, { type: 'approve', id: 4 }, 'host', true)).toEqual({ refuse: 'bad-action' });
    for (const type of ['approve', 'dismiss', 'spotlight', 'open', 'clear']) expect(run(s, { type, id: 'w1', on: true })).toEqual({ refuse: 'not-host' });
    expect(run(null, { type: 'approve', id: 'w1' }, 'host', true)).toEqual({ refuse: 'wrong-phase' });
    expect((run(lit, { type: 'dismiss', id: 'w1' }, 'host', true) as { slice: WallState }).slice.posts[0]?.status).toBe('dismissed');
    expect((run(live, { type: 'dismiss', id: 'w1' }, 'host', true) as { slice: WallState }).slice.spotlight).toBeNull();
    expect(run(s, { type: 'open', on: 'x' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(lit, { type: 'open', on: false }, 'host', true)).toMatchObject({ slice: { open: false } });
    expect(run(lit, { type: 'clear' }, 'host', true)).toMatchObject({ slice: { posts: [], spotlight: null, open: true } });
    for (const action of [null, 'post', 3, {}, { type: 5 }, { type: 'dance' }]) expect(run(s, action)).toEqual({ refuse: 'bad-action' });
  });

  it('dismissing another post keeps the spotlight where it is', () => {
    let s = start({ moderated: false });
    s = post(s, 'One');
    s = post(s, 'Two', 'p2');
    const lit = (run(s, { type: 'spotlight', id: 'w1' }, 'host', true) as { slice: WallState }).slice;
    expect((run(lit, { type: 'dismiss', id: 'w2' }, 'host', true) as { slice: WallState }).slice.spotlight).toBe('w1');
  });

  it('reads the room as untrusted: newest first, no one who left, a spotlight only on a showing post', () => {
    expect(readWall(null)).toBeNull();
    expect(readWall({ shared: {}, players: [] })).toBeNull();
    for (const bad of [5, { posts: 'x', n: 1 }, { posts: [], n: 'x' }]) expect(readWall(room(WALL_KEY, bad))).toBeNull();
    const slice = {
      moderated: false, open: false, n: 9, spotlight: 'w3',
      posts: [
        { id: 'w1', text: 'old', by: 'p1', at: 1, status: 'live' },
        { id: 'w2', text: 'new', by: 'p2', at: 5, status: 'live' },
        { id: 'w3', text: 'gone', by: 'gone', at: 6, status: 'live' },
        { id: 'w4', text: 'queued', by: 'p1', at: 7, status: 'review' },
        { id: 'w5', text: 'bad status', by: 'p1', at: 7, status: 'weird' },
        { id: 'w6', text: 'bad', by: '', at: 7, status: 'live' },
        null,
      ],
    };
    const read = readWall(room(WALL_KEY, slice))!;
    expect(read.live.map((p) => p.id)).toEqual(['w2', 'w1']);
    expect(read.review.map((p) => p.id)).toEqual(['w4']);
    expect(read.spotlight).toBeNull(); // w3's writer left
    expect(read.open).toBe(false);
    expect(readWall(room(WALL_KEY, { ...slice, spotlight: 'w2' }))?.spotlight).toBe('w2');
    expect(readWall(room(WALL_KEY, { ...slice, spotlight: 4 }))?.spotlight).toBeNull();
    expect(readWall(room(WALL_KEY, { posts: [], n: 0 }))).toMatchObject({ moderated: true, open: true });
  });
});

describe('note board', () => {
  const COLUMNS = [{ id: 'now', label: 'Now' }, { id: 'later', label: 'Later' }];
  const act = notesActivity({ blocklist: ['badword'] });
  const run = (slice: unknown, action: unknown, who = 'p1', host = false, at = 1) => act(slice, action, ctx(who, host, at));
  const start = () => (run(null, { type: 'start', columns: COLUMNS }, 'host', true) as { slice: NotesState }).slice;
  const add = (s: unknown, column: string, text: string, who = 'p1', at = 1) => (run(s, { type: 'add', column, text }, who, false, at) as { slice: NotesState }).slice;

  it('starts with two to six well-formed columns, only for the host', () => {
    expect(start()).toMatchObject({ columns: COLUMNS, notes: [], moves: [], open: true, n: 0 });
    expect(run(null, { type: 'start', columns: COLUMNS })).toEqual({ refuse: 'not-host' });
    for (const columns of [[], 'x', [COLUMNS[0]], COLUMNS.concat(COLUMNS), Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, label: 'C' })), [{ id: 'a b', label: 'A' }, COLUMNS[1]], [{ id: 'a', label: '' }, COLUMNS[1]], [COLUMNS[0], COLUMNS[0]], [null, COLUMNS[1]], [{ id: 'a', label: 5 }, COLUMNS[1]]]) {
      expect(run(null, { type: 'start', columns }, 'host', true)).toEqual({ refuse: 'bad-action' });
    }
  });

  it('takes a checked note in a column, with an id and a time from the room', () => {
    const s = add(start(), 'later', '  A note ', 'p1', 77);
    expect(s.notes).toEqual([{ id: 'n1', column: 'later', text: 'A note', by: 'p1', at: 77 }]);
    for (const [column, text] of [['zzz', 'x'], [3, 'x'], ['now', ''], ['now', 'x'.repeat(141)], ['now', 'http://x.com'], ['now', 'badword'], ['now', 5]]) {
      expect(run(start(), { type: 'add', column, text })).toEqual({ refuse: 'bad-action' });
    }
    expect(run(start(), { type: 'add', column: 'now', text: 'Hi' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(null, { type: 'add', column: 'now', text: 'Hi' })).toEqual({ refuse: 'wrong-phase' });
  });

  it('limits each person to ten notes, and the room to its limit', () => {
    let s = start();
    for (let i = 0; i < NOTES_PER_PLAYER; i++) s = add(s, 'now', `Note ${i}`);
    expect(run(s, { type: 'add', column: 'now', text: 'More' })).toEqual({ refuse: 'rate-limited' });
    const lots = { ...start(), notes: Array.from({ length: MAX_NOTES_IN_ROOM }, (_, i) => ({ id: `n${i}`, column: 'now', text: 't', by: `q${i}`, at: i })) };
    expect(run(lots, { type: 'add', column: 'now', text: 'Hi' })).toEqual({ refuse: 'full' });
  });

  it('lets any phone move a note to another column, keeping only its latest move', () => {
    let s = add(start(), 'now', 'A note');
    s = (run(s, { type: 'move', id: 'n1', column: 'later' }, 'p2', false, 5) as { slice: NotesState }).slice;
    s = (run(s, { type: 'move', id: 'n1', column: 'now' }, 'p3', false, 9) as { slice: NotesState }).slice;
    expect(s.moves).toEqual([{ id: 'n1', column: 'now', at: 9 }]);
    expect(run(s, { type: 'move', id: 'zzz', column: 'now' })).toEqual({ refuse: 'bad-action' });
    expect(run(s, { type: 'move', id: 7, column: 'now' })).toEqual({ refuse: 'bad-action' });
    expect(run(s, { type: 'move', id: 'n1', column: 'zzz' })).toEqual({ refuse: 'bad-action' });
    expect(run(s, { type: 'move', id: 'n1', column: 'now' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(null, { type: 'move', id: 'n1', column: 'now' })).toEqual({ refuse: 'wrong-phase' });
    const closed = (run(s, { type: 'open', on: false }, 'host', true) as { slice: NotesState }).slice;
    expect(run(closed, { type: 'move', id: 'n1', column: 'later' })).toEqual({ refuse: 'wrong-phase' });
    expect(run(closed, { type: 'add', column: 'now', text: 'x' })).toEqual({ refuse: 'wrong-phase' });
  });

  it('closes, reopens and clears for the host only', () => {
    const s = add(start(), 'now', 'A note');
    expect(run(s, { type: 'open', on: false })).toEqual({ refuse: 'not-host' });
    expect(run(s, { type: 'clear' })).toEqual({ refuse: 'not-host' });
    expect(run(null, { type: 'clear' }, 'host', true)).toEqual({ refuse: 'wrong-phase' });
    expect(run(s, { type: 'open', on: 'x' }, 'host', true)).toEqual({ refuse: 'bad-action' });
    expect(run(s, { type: 'open', on: true }, 'host', true)).toMatchObject({ slice: { open: true } });
    expect(run(s, { type: 'clear' }, 'host', true)).toMatchObject({ slice: { notes: [], moves: [], open: true } });
    for (const action of [null, 'add', 3, {}, { type: 5 }, { type: 'dance' }]) expect(run(s, action)).toEqual({ refuse: 'bad-action' });
  });

  it('reads the room as untrusted, drops notes of people who left (and their moves), and folds into columns', () => {
    expect(readNotes(null)).toBeNull();
    expect(readNotes({ shared: {}, players: [] })).toBeNull();
    for (const bad of [5, { columns: 'x', notes: [], moves: [], n: 1 }, { columns: [COLUMNS[0]], notes: [], moves: [], n: 1 }, { columns: COLUMNS, notes: [], moves: [], n: 'x' }, { columns: COLUMNS, notes: 'x', moves: [], n: 1 }]) {
      expect(readNotes(room(NOTES_KEY, bad))).toBeNull();
    }
    const slice = {
      columns: COLUMNS, n: 5, open: false,
      notes: [
        { id: 'n1', column: 'now', text: 'A', by: 'p1', at: 1 },
        { id: 'n2', column: 'now', text: 'B', by: 'gone', at: 2 },
        { id: 'n3', column: 'zzz', text: 'C', by: 'p1', at: 3 },
        { id: 'n4', column: 'later', text: 'D', by: 'p2', at: 4 },
        null,
      ],
      moves: [{ id: 'n1', column: 'later', at: 9 }, { id: 'n2', column: 'later', at: 9 }, { id: 'n4', column: 'zzz', at: 9 }, null],
    };
    const read = readNotes(room(NOTES_KEY, slice))!;
    expect(read.notes.map((n) => n.id)).toEqual(['n1', 'n4']);
    expect(read.moves).toEqual([{ id: 'n1', column: 'later', at: 9 }]);
    expect(read.open).toBe(false);
    expect(foldNote(read)).toEqual({ now: [], later: ['n1', 'n4'] });
  });
});
