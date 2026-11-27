/**
 * @interlace/ui — games/team-model
 *
 * Teams for a live room: who is on which team, a fair automatic split, a move by hand, and each
 * team's score from the room's own player scores. Pure, so the host and a server run the same
 * rules.
 *
 * The teams live in the room (`RoomState.shared.teams`, written with a `share` event), so a phone
 * that joins late or reconnects gets them with the room state, the newest `seq` wins whatever
 * order messages arrive in, and a host that restores the room restores its teams. Everything
 * read back goes through `readTeams`, which treats the data as untrusted and drops anyone who is
 * no longer in the room.
 *
 * A team's colour is its place in the list: `teamColor(i)` is a `--team-N` token (five of them; a
 * sixth team reuses the first colour), and `teamMark(i)` is the letter that goes with it, so
 * colour is never the only way to tell teams apart.
 */

import { cleanName, readShared, rejectRoomEvent, type RoomHostEvent, type RoomPlayer, type RoomState } from './room-model.js';
import { rankEntries } from './leaderboard-model.js';
import { clampCount, isId, isRecord, shuffled, snakeDeal, smallestIndex, type Random } from './group-model.js';

/** The key in `RoomState.shared`. */
export const TEAMS_KEY = 'teams';
/** The most teams a room has. */
export const MAX_TEAMS = 12;
/** How many `--team-N` colour tokens there are. */
export const TEAM_COLORS = 5;
const MAX_NAME = 24;

export interface Team {
  /** `t1`, `t2`, … Stable: renaming a team or adding one never changes another's id. */
  id: string;
  name: string;
}

export interface TeamsState {
  /** In order. A team's colour and mark come from its place. */
  teams: Team[];
  /** Team id per player id. A player with no entry is not on a team yet. */
  members: Record<string, string>;
}

/** `count` empty teams (2 to `MAX_TEAMS`), named from `names`, then "Team 3", "Team 4"… */
export function createTeams(count: number, names: readonly string[] = []): TeamsState {
  const n = clampCount(count, 2, MAX_TEAMS);
  return {
    teams: Array.from({ length: n }, (_, i) => ({
      id: `t${i + 1}`,
      name: cleanName(names[i] ?? '', MAX_NAME) || `Team ${i + 1}`,
    })),
    members: {},
  };
}

/** Teams from untrusted data (a `share` value), or null when it is not teams. */
export function decodeTeams(raw: unknown): TeamsState | null {
  if (!isRecord(raw) || !Array.isArray(raw.teams)) return null;
  if (raw.teams.length < 2 || raw.teams.length > MAX_TEAMS) return null;
  const teams: Team[] = [];
  for (const t of raw.teams) {
    if (!isRecord(t) || !isId(t.id) || typeof t.name !== 'string') return null;
    if (teams.some((x) => x.id === t.id)) return null;
    teams.push({ id: t.id, name: cleanName(t.name, MAX_NAME) || `Team ${teams.length + 1}` });
  }
  const members = Object.entries(isRecord(raw.members) ? raw.members : {}).filter(
    ([id, team]) => id !== '__proto__' && typeof team === 'string' && teams.some((t) => t.id === team),
  ) as [string, string][];
  return { teams, members: Object.fromEntries(members) };
}

/** The room's teams, with anyone no longer in the room dropped; null when none are set. */
export function readTeams(room: Pick<RoomState, 'shared' | 'players'> | null | undefined): TeamsState | null {
  const teams = readShared(room, TEAMS_KEY, decodeTeams);
  if (!teams || !room) return teams;
  const here = new Set(room.players.map((p) => p.id));
  return { ...teams, members: Object.fromEntries(Object.entries(teams.members).filter(([id]) => here.has(id))) };
}

/** The host event that sets the teams for every screen, or clears them with null. */
export function teamsEvent(teams: TeamsState | null): RoomHostEvent {
  return { type: 'share', key: TEAMS_KEY, value: teams };
}

/** Whether the room would take these teams (the size limit on `shared` is the only way not). */
export function teamsFit(room: RoomState, teams: TeamsState): boolean {
  return rejectRoomEvent(room, teamsEvent(teams), room.hostId) === null;
}

/** The index of a team in the list, or -1. Its colour and mark come from it. */
export function teamIndex(teams: TeamsState, teamId: string): number {
  return teams.teams.findIndex((t) => t.id === teamId);
}

/** The team a player is on, or null. */
export function teamOf(teams: TeamsState, playerId: string): Team | null {
  const id = Object.hasOwn(teams.members, playerId) ? teams.members[playerId] : undefined;
  return teams.teams.find((t) => t.id === id) ?? null;
}

/** A team's players, in the order they joined the room. */
export function membersOf(teams: TeamsState, teamId: string, players: readonly RoomPlayer[]): RoomPlayer[] {
  return players.filter((p) => Object.hasOwn(teams.members, p.id) && teams.members[p.id] === teamId);
}

/** Players on no team yet, in the order they joined. */
export function unassigned(teams: TeamsState, players: readonly RoomPlayer[]): RoomPlayer[] {
  return players.filter((p) => !teamOf(teams, p.id));
}

/** The `var()` of a team's colour token: `var(--team-1)` … `var(--team-5)`, then round again. */
export function teamColor(index: number): string {
  return `var(--team-${(Math.max(0, index) % TEAM_COLORS) + 1})`;
}

/** The letter that goes with a team's colour: A, B, C … (it repeats after Z, which no room reaches). */
export function teamMark(index: number): string {
  return String.fromCharCode(65 + (Math.max(0, index) % 26));
}

/** Moves a player to a team, or off every team with null. The same object when nothing changes. */
export function moveToTeam(teams: TeamsState, playerId: string, teamId: string | null): TeamsState {
  const now = teamOf(teams, playerId)?.id ?? null;
  if (teamId === now) return teams;
  if (teamId === null) {
    const { [playerId]: _gone, ...members } = teams.members;
    return { ...teams, members };
  }
  if (!teams.teams.some((t) => t.id === teamId)) return teams;
  return { ...teams, members: { ...teams.members, [playerId]: teamId } };
}

/** Renames a team. The same object when the name is empty, unknown or unchanged. */
export function renameTeam(teams: TeamsState, teamId: string, name: string): TeamsState {
  const clean = cleanName(name, MAX_NAME);
  const team = teams.teams.find((t) => t.id === teamId);
  if (!team || !clean || team.name === clean) return teams;
  return { ...teams, teams: teams.teams.map((t) => (t === team ? { ...t, name: clean } : t)) };
}

/**
 * Changes the number of teams (2 to `MAX_TEAMS`). New teams are empty; the players of a team that
 * goes become unassigned (`placeNewcomers` or `autoBalance` then places them).
 */
export function resizeTeams(teams: TeamsState, count: number): TeamsState {
  const n = clampCount(count, 2, MAX_TEAMS);
  if (n === teams.teams.length) return teams;
  const kept = teams.teams.slice(0, n);
  const added = Array.from({ length: Math.max(0, n - kept.length) }, (_, i) => {
    const place = kept.length + i + 1;
    return { id: `t${nextNumber(teams.teams, place)}`, name: `Team ${place}` };
  });
  const all = [...kept, ...added];
  return {
    teams: all,
    members: Object.fromEntries(Object.entries(teams.members).filter(([, id]) => all.some((t) => t.id === id))),
  };
}

/** The lowest `tN` number at or above `from` that no team uses (a removed team's number is free again). */
function nextNumber(teams: readonly Team[], from: number): number {
  let n = from;
  while (teams.some((t) => t.id === `t${n}`)) n++;
  return n;
}

/** How many of `players` are on each team, in team order. */
function sizes(teams: TeamsState, players: readonly RoomPlayer[]): number[] {
  return teams.teams.map((t) => membersOf(teams, t.id, players).length);
}

/**
 * Puts every player with no team on the smallest one (the first on a tie), one by one. Call it
 * when someone joins late. The same object when everyone already has a team.
 */
export function placeNewcomers(teams: TeamsState, players: readonly RoomPlayer[]): TeamsState {
  const loose = unassigned(teams, players);
  if (!loose.length) return teams;
  const count = sizes(teams, players);
  const members = { ...teams.members };
  for (const p of loose) {
    const at = smallestIndex(count);
    members[p.id] = (teams.teams[at] as Team).id;
    count[at] = (count[at] as number) + 1;
  }
  return { ...teams, members };
}

export interface BalanceOptions {
  /** Points so far per player id. Strong players are spread across teams instead of piling onto one. */
  scores?: Record<string, number>;
  /** @default Math.random. Pass `seededRandom(n)` for a split you can repeat. */
  random?: Random;
}

/**
 * Splits every player across the teams so sizes differ by at most one. Players are shuffled, then
 * ordered by score (best first) and dealt 1 2 3 3 2 1 …, so with scores the teams start level and
 * without them it is a fair random split. Everyone is placed again, whoever was where.
 */
export function autoBalance(teams: TeamsState, players: readonly RoomPlayer[], options: BalanceOptions = {}): TeamsState {
  const { scores = {}, random } = options;
  const score = (id: string) => (Object.hasOwn(scores, id) && Number.isFinite(scores[id]) ? (scores[id] as number) : 0);
  const order = shuffled(players, random)
    .sort((a, b) => score(b.id) - score(a.id))
    .map((p) => p.id);
  const piles = snakeDeal(order, teams.teams.length);
  const members: Record<string, string> = {};
  piles.forEach((ids, i) => ids.forEach((id) => (members[id] = (teams.teams[i] as Team).id)));
  return { ...teams, members };
}

export interface TeamStanding {
  id: string;
  name: string;
  /** The team's place in the list: its colour and mark. */
  index: number;
  /** 1-based; ties share a rank. */
  rank: number;
  tied: boolean;
  /** Players on the team. */
  size: number;
  /** The players' points added up. */
  total: number;
  /** `total` per player, to one decimal; 0 for an empty team. */
  average: number;
  /** Points the team's players won in the last revealed round. */
  gained: number;
}

/**
 * Each team's score from the room's player scores, best first. `by` decides what ranks:
 * `average` (default) is fair when teams differ in size by one; `total` rewards a bigger team.
 */
export function teamStandings(
  teams: TeamsState,
  room: Pick<RoomState, 'players' | 'scores' | 'lastPoints'>,
  by: 'average' | 'total' = 'average',
): TeamStanding[] {
  const sum = (ids: RoomPlayer[], from: Record<string, number>) =>
    ids.reduce((acc, p) => acc + (Object.hasOwn(from, p.id) ? (from[p.id] as number) : 0), 0);
  const rows = teams.teams.map((t, index) => {
    const people = membersOf(teams, t.id, room.players);
    const total = sum(people, room.scores);
    const average = people.length ? Math.round((total / people.length) * 10) / 10 : 0;
    return { id: t.id, name: t.name, index, size: people.length, total, average, gained: sum(people, room.lastPoints) };
  });
  const ranked = rankEntries(rows.map((r) => ({ id: r.id, name: r.name, score: by === 'total' ? r.total : r.average })));
  return ranked.map((r) => ({
    ...(rows.find((x) => x.id === r.id) as (typeof rows)[number]),
    rank: r.rank,
    tied: r.tied,
  }));
}
