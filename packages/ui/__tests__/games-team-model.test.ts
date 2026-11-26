/**
 * Teams: the split, the moves, the scores, and reading them back from a room as untrusted data.
 */
import { describe, expect, it } from 'vitest';

import {
  applyRoomEvent,
  createRoom,
  type RoomPlayer,
  type RoomState,
} from '../src/games/room-model.js';
import { seededRandom } from '../src/games/group-model.js';
import {
  autoBalance,
  createTeams,
  decodeTeams,
  MAX_TEAMS,
  membersOf,
  moveToTeam,
  placeNewcomers,
  readTeams,
  renameTeam,
  resizeTeams,
  teamColor,
  teamIndex,
  teamMark,
  teamOf,
  teamsEvent,
  teamsFit,
  teamStandings,
  unassigned,
  type TeamsState,
} from '../src/games/team-model.js';

const HOST = 'host';

function roomOf(n: number): RoomState {
  let r = createRoom({ code: 'K7Q4MZ', hostId: HOST });
  for (let i = 0; i < n; i++) r = applyRoomEvent(r, { type: 'join', playerId: `p${i}`, name: `Player ${i}` }, `p${i}`);
  return r;
}

const sizesOf = (t: TeamsState, players: readonly RoomPlayer[]) => t.teams.map((x) => membersOf(t, x.id, players).length);

describe('createTeams', () => {
  it('makes between 2 and MAX_TEAMS empty teams with names', () => {
    expect(createTeams(3).teams).toEqual([
      { id: 't1', name: 'Team 1' },
      { id: 't2', name: 'Team 2' },
      { id: 't3', name: 'Team 3' },
    ]);
    expect(createTeams(1).teams).toHaveLength(2);
    expect(createTeams(Number.NaN).teams).toHaveLength(2);
    expect(createTeams(99).teams).toHaveLength(MAX_TEAMS);
    expect(createTeams(2, ['  Red   fox ', '', 'x'.repeat(40)]).teams.map((t) => t.name)).toEqual(['Red fox', 'Team 2']);
    expect(createTeams(3, ['A', 'B', 'x'.repeat(40)]).teams[2]!.name).toHaveLength(24);
    expect(createTeams(2).members).toEqual({});
  });
});

describe('colours and marks', () => {
  it('cycle through the five colour tokens, with a letter for each team', () => {
    expect([0, 1, 4, 5, 6].map(teamColor)).toEqual([
      'var(--team-1)',
      'var(--team-2)',
      'var(--team-5)',
      'var(--team-1)',
      'var(--team-2)',
    ]);
    expect(teamColor(-3)).toBe('var(--team-1)');
    expect([0, 1, 25, 26, -1].map(teamMark)).toEqual(['A', 'B', 'Z', 'A', 'A']);
  });
});

describe('autoBalance', () => {
  it.each([[3, 2], [8, 3], [31, 4], [40, 5], [120, 12], [7, 12]])('splits %i players over %i teams within one', (n, k) => {
    const room = roomOf(n);
    const t = autoBalance(createTeams(k), room.players, { random: seededRandom(n * k) });
    const sizes = sizesOf(t, room.players);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
    expect(unassigned(t, room.players)).toEqual([]);
  });

  it('is repeatable with a seeded random, and different with another', () => {
    const room = roomOf(30);
    const a = autoBalance(createTeams(4), room.players, { random: seededRandom(1) });
    const b = autoBalance(createTeams(4), room.players, { random: seededRandom(1) });
    const c = autoBalance(createTeams(4), room.players, { random: seededRandom(2) });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('spreads the strongest players across teams when it has scores', () => {
    const room = roomOf(12);
    const scores = Object.fromEntries(room.players.map((p, i) => [p.id, (12 - i) * 100]));
    const t = autoBalance(createTeams(4), room.players, { scores, random: seededRandom(5) });
    const top = room.players.slice(0, 4).map((p) => teamOf(t, p.id)!.id);
    expect(new Set(top).size).toBe(4);
    // Totals are level to within 300 (dealing in order would leave the first team 2,700 ahead).
    const totals = t.teams.map((x) => membersOf(t, x.id, room.players).reduce((n, p) => n + scores[p.id]!, 0));
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(300);
  });

  it('treats a missing, odd or non-finite score as 0, and places everyone again', () => {
    const room = roomOf(4);
    const start = moveToTeam(createTeams(2), 'p0', 't1');
    const t = autoBalance(start, room.players, {
      scores: { p0: Number.NaN, p1: Infinity, constructor: 9 } as Record<string, number>,
      random: seededRandom(3),
    });
    expect(sizesOf(t, room.players)).toEqual([2, 2]);
    expect(autoBalance(createTeams(2), [], {}).members).toEqual({});
    expect(Object.keys(autoBalance(createTeams(2), room.players).members)).toHaveLength(4);
  });
});

describe('moves and edits', () => {
  it('moves a player to a team or off all, and returns the same object when nothing changes', () => {
    const t0 = createTeams(2);
    const t1 = moveToTeam(t0, 'a', 't2');
    expect(teamOf(t1, 'a')?.name).toBe('Team 2');
    expect(moveToTeam(t1, 'a', 't2')).toBe(t1);
    expect(moveToTeam(t1, 'a', 'nope')).toBe(t1);
    expect(moveToTeam(t0, 'a', null)).toBe(t0);
    const t2 = moveToTeam(t1, 'a', null);
    expect(teamOf(t2, 'a')).toBeNull();
    expect(t1.members).toEqual({ a: 't2' }); // never mutated
    expect(teamIndex(t1, 't2')).toBe(1);
    expect(teamIndex(t1, 'zz')).toBe(-1);
  });

  it('renames a team, and ignores an empty, unknown or unchanged name', () => {
    const t = createTeams(2);
    expect(renameTeam(t, 't1', '  Owls ').teams[0]!.name).toBe('Owls');
    expect(renameTeam(t, 't1', '   ')).toBe(t);
    expect(renameTeam(t, 'zz', 'Owls')).toBe(t);
    expect(renameTeam(t, 't1', 'Team 1')).toBe(t);
  });

  it('adds and removes teams, leaving the players of a removed team unassigned', () => {
    let t = moveToTeam(moveToTeam(createTeams(3), 'a', 't3'), 'b', 't1');
    const smaller = resizeTeams(t, 2);
    expect(smaller.teams.map((x) => x.id)).toEqual(['t1', 't2']);
    expect(smaller.members).toEqual({ b: 't1' });
    expect(resizeTeams(t, 3)).toBe(t);
    expect(resizeTeams(t, 1).teams).toHaveLength(2);
    const bigger = resizeTeams(smaller, 4);
    expect(bigger.teams.map((x) => x.id)).toEqual(['t1', 't2', 't3', 't4']);
    expect(bigger.teams[2]!.name).toBe('Team 3');
    // An id that is taken is never reused for a different team.
    t = { teams: [{ id: 't1', name: 'A' }, { id: 't3', name: 'B' }], members: {} };
    expect(resizeTeams(t, 3).teams.map((x) => x.id)).toEqual(['t1', 't3', 't4']);
  });

  it('puts latecomers on the smallest team, one at a time', () => {
    const room = roomOf(7);
    let t = autoBalance(createTeams(3), room.players.slice(0, 6), { random: seededRandom(1) });
    expect(placeNewcomers(t, room.players.slice(0, 6))).toBe(t);
    t = placeNewcomers(t, room.players);
    expect(sizesOf(t, room.players).sort()).toEqual([2, 2, 3]);
    const empty = placeNewcomers(createTeams(3), room.players);
    expect(sizesOf(empty, room.players)).toEqual([3, 2, 2]);
  });

  it('lists who is where, in the order they joined', () => {
    const room = roomOf(4);
    const t = moveToTeam(moveToTeam(createTeams(2), 'p3', 't1'), 'p1', 't1');
    expect(membersOf(t, 't1', room.players).map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(unassigned(t, room.players).map((p) => p.id)).toEqual(['p0', 'p2']);
    expect(teamOf(t, 'constructor')).toBeNull();
    expect(membersOf({ teams: t.teams, members: {} }, 't1', room.players)).toEqual([]);
  });
});

describe('teamStandings', () => {
  function scored(): { room: RoomState; teams: TeamsState } {
    let room = roomOf(5);
    room = {
      ...room,
      scores: { p0: 100, p1: 300, p2: 200, p3: 50, p4: 50 },
      lastPoints: { p0: 10, p1: 30, p2: 20, p3: 5 },
    };
    let teams = createTeams(2);
    for (const [id, t] of [['p0', 't1'], ['p1', 't1'], ['p2', 't2'], ['p3', 't2'], ['p4', 't2']] as const)
      teams = moveToTeam(teams, id, t);
    return { room, teams };
  }

  it('ranks by average by default, so a bigger team has no edge', () => {
    const { room, teams } = scored();
    const rows = teamStandings(teams, room);
    expect(rows.map((r) => [r.id, r.rank, r.size, r.total, r.average, r.gained])).toEqual([
      ['t1', 1, 2, 400, 200, 40],
      ['t2', 2, 3, 300, 100, 25],
    ]);
    expect(rows[0]!.index).toBe(0);
    expect(rows[0]!.tied).toBe(false);
  });

  it('puts a bigger team with a lower average behind by default, and ahead by total', () => {
    const room = { ...roomOf(5), scores: { p0: 500, p1: 500, p2: 400, p3: 400, p4: 400 }, lastPoints: {} };
    let teams = createTeams(2);
    for (const [id, t] of [['p0', 't1'], ['p1', 't1'], ['p2', 't2'], ['p3', 't2'], ['p4', 't2']] as const) teams = moveToTeam(teams, id, t);
    expect(teamStandings(teams, room).map((r) => r.id)).toEqual(['t1', 't2']); // 500 each against 400 each
    expect(teamStandings(teams, room, 'total').map((r) => r.id)).toEqual(['t2', 't1']); // 1,200 against 1,000
  });

  it('can rank by total, and shares a rank on a tie', () => {
    const { room, teams } = scored();
    expect(teamStandings(teams, room, 'total').map((r) => r.id)).toEqual(['t1', 't2']);
    const tied = teamStandings(teams, { ...room, scores: { p0: 150, p1: 150, p2: 100, p3: 100, p4: 100 } }, 'total');
    expect(tied.map((r) => [r.rank, r.tied])).toEqual([[1, true], [1, true]]);
  });

  it('counts an empty team as 0, and a player without a score as 0', () => {
    const room = roomOf(2);
    const teams = moveToTeam(createTeams(3), 'p0', 't1');
    const rows = teamStandings(teams, { ...room, scores: {}, lastPoints: {} });
    expect(rows.map((r) => [r.size, r.total, r.average])).toEqual([[1, 0, 0], [0, 0, 0], [0, 0, 0]]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1]);
  });

  it('ignores inherited keys in the room\'s scores', () => {
    const room = roomOf(1);
    const teams = moveToTeam(createTeams(2), 'p0', 't1');
    const rows = teamStandings(teams, { players: [{ id: 'constructor', name: 'C', connected: true }, ...room.players], scores: {}, lastPoints: {} });
    expect(rows[0]!.total).toBe(0);
  });
});

describe('reading teams from a room', () => {
  const share = (room: RoomState, value: unknown) => applyRoomEvent(room, { type: 'share', key: 'teams', value }, HOST);

  it('round-trips through the room, and drops players who left it', () => {
    let room = roomOf(4);
    const teams = autoBalance(createTeams(2), room.players, { random: seededRandom(1) });
    room = share(room, teams);
    expect(readTeams(room)).toEqual(teams);
    room = applyRoomEvent(room, { type: 'remove', playerId: 'p0' }, HOST);
    expect(Object.keys(readTeams(room)!.members).sort()).toEqual(['p1', 'p2', 'p3']);
    expect(readTeams(null)).toBeNull();
    expect(readTeams(roomOf(2))).toBeNull();
  });

  it('sets and clears through a share event', () => {
    const room = roomOf(2);
    const t = createTeams(2);
    expect(teamsEvent(t)).toEqual({ type: 'share', key: 'teams', value: t });
    expect(readTeams(applyRoomEvent(room, teamsEvent(t), HOST))).toEqual(t);
    expect(readTeams(applyRoomEvent(applyRoomEvent(room, teamsEvent(t), HOST), teamsEvent(null), HOST))).toBeNull();
    expect(teamsFit(room, t)).toBe(true);
    expect(teamsFit(room, { teams: t.teams, members: Object.fromEntries(Array.from({ length: 6000 }, (_, i) => [`player-${i}`, 't1'])) })).toBe(false);
  });

  it.each([
    ['not an object', 5],
    ['no teams', {}],
    ['one team', { teams: [{ id: 't1', name: 'A' }] }],
    ['too many teams', { teams: Array.from({ length: MAX_TEAMS + 1 }, (_, i) => ({ id: `t${i}`, name: 'x' })) }],
    ['a team that is not an object', { teams: [{ id: 't1', name: 'A' }, 7] }],
    ['a bad id', { teams: [{ id: 't1', name: 'A' }, { id: 'a b', name: 'B' }] }],
    ['a non-string name', { teams: [{ id: 't1', name: 'A' }, { id: 't2', name: 4 }] }],
    ['a repeated id', { teams: [{ id: 't1', name: 'A' }, { id: 't1', name: 'B' }] }],
  ])('reads %s as no teams', (_label, raw) => {
    expect(decodeTeams(raw)).toBeNull();
  });

  it('keeps what it can use: clean names, known members only', () => {
    const t = decodeTeams({
      teams: [{ id: 't1', name: '  ' }, { id: 't2', name: 'x'.repeat(50) }],
      members: { a: 't1', b: 't9', c: 5, __proto__: 't1' },
    })!;
    expect(t.teams.map((x) => x.name)).toEqual(['Team 1', 'x'.repeat(24)]);
    expect(t.members).toEqual({ a: 't1' });
    expect(decodeTeams({ teams: [{ id: 't1', name: 'A' }, { id: 't2', name: 'B' }], members: 'no' })!.members).toEqual({});
  });
});
