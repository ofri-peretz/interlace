/**
 * @interlace/ui — games/breakout-model
 *
 * Breakouts for a live room: split the players into groups with a timer, send one message to
 * every group, and call everyone back. Pure, so the host and a server run the same rules.
 *
 * The state lives in the room (`RoomState.shared.breakouts`, written with a `share` event), so a
 * phone that joins late or reconnects shows its group at once, the newest `seq` wins whatever
 * order messages arrive in, and a host that restores the room restores the breakouts, with the
 * timer still running to the same moment (`endsAt` is a host timestamp).
 *
 * ## Messages
 *
 * Each message carries a count `n`. A phone speaks a message once, when `n` is higher than any it
 * has seen, so the same state arriving twice, or an older one arriving late, is never read again.
 *
 * ## Recall
 *
 * `recallBreakouts` keeps the groups and marks the breakouts `recalled` (with the time), so every
 * phone says "back to the main room" instead of showing a group; `clearBreakouts` removes them.
 */

import { cleanName, readShared, type RoomHostEvent, type RoomPlayer, type RoomState } from './room-model.js';
import { clampCount, isId, isRecord, shuffled, smallestIndex, snakeDeal, type Random } from './group-model.js';

/** The key in `RoomState.shared`. */
export const BREAKOUTS_KEY = 'breakouts';
/** The most groups a room splits into. */
export const MAX_GROUPS = 50;
/** The longest message, in characters. */
export const MAX_MESSAGE = 280;
const MAX_NAME = 24;

export interface Breakout {
  /** `g1`, `g2`, … */
  id: string;
  name: string;
}

export interface BreakoutMessage {
  /** 1 for the first message, then up by one. A phone speaks a message once, by this. */
  n: number;
  text: string;
  /** When it was sent, in ms (host clock). */
  at: number;
}

export interface BreakoutsState {
  /** `open` while people are in their groups; `recalled` once everyone is called back. */
  status: 'open' | 'recalled';
  groups: Breakout[];
  /** Group id per player id. A player with no entry is not in a group (joined late, or moved out). */
  members: Record<string, string>;
  /** When the groups opened, in ms (host clock). */
  startedAt: number;
  /** When time is up, in ms (host clock). null: no timer. */
  endsAt: number | null;
  /** The latest message to every group, or null. */
  message: BreakoutMessage | null;
  /** When everyone was recalled, in ms (host clock). null while open. */
  recalledAt: number | null;
}

export interface OpenOptions {
  /** How many groups. Wins over `size`. */
  groups?: number;
  /** People per group, roughly: the room is split into as many groups as that gives. */
  size?: number;
  /** How long they have, in seconds. Leave out for no timer. */
  seconds?: number | null;
  /** Names for the groups; the rest are "Group 3", "Group 4"… */
  names?: readonly string[];
  /** When it opens, in ms (host clock). */
  now: number;
  /** @default Math.random */
  random?: Random;
}

/**
 * Splits `players` into groups of near-equal size, chosen at random. With neither `groups` nor
 * `size` it makes two. Never more groups than people. Null when there is no one to split.
 */
export function openBreakouts(players: readonly RoomPlayer[], options: OpenOptions): BreakoutsState | null {
  if (!players.length) return null;
  const { groups, size, seconds = null, names = [], now, random } = options;
  const wanted = groups ?? (size && size > 0 ? Math.round(players.length / size) : 2);
  const count = Math.min(players.length, clampCount(wanted, 1, MAX_GROUPS));
  const list = Array.from({ length: count }, (_, i) => ({
    id: `g${i + 1}`,
    name: cleanName(names[i] ?? '', MAX_NAME) || `Group ${i + 1}`,
  }));
  const members: Record<string, string> = {};
  snakeDeal(shuffled(players, random), count).forEach((pile, i) =>
    pile.forEach((p) => (members[p.id] = (list[i] as Breakout).id)),
  );
  return {
    status: 'open',
    groups: list,
    members,
    startedAt: now,
    endsAt: seconds === null ? null : now + Math.max(0, seconds) * 1000,
    message: null,
    recalledAt: null,
  };
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Breakouts from untrusted data (a `share` value), or null when it is not breakouts. */
export function decodeBreakouts(raw: unknown): BreakoutsState | null {
  if (!isRecord(raw) || !Array.isArray(raw.groups) || raw.groups.length < 1 || raw.groups.length > MAX_GROUPS) return null;
  if (raw.status !== 'open' && raw.status !== 'recalled') return null;
  if (!num(raw.startedAt)) return null;
  const groups: Breakout[] = [];
  for (const g of raw.groups) {
    if (!isRecord(g) || !isId(g.id) || typeof g.name !== 'string' || groups.some((x) => x.id === g.id)) return null;
    groups.push({ id: g.id, name: cleanName(g.name, MAX_NAME) || `Group ${groups.length + 1}` });
  }
  const endsAt = raw.endsAt === null || raw.endsAt === undefined ? null : num(raw.endsAt) ? raw.endsAt : undefined;
  const recalledAt = raw.recalledAt === null || raw.recalledAt === undefined ? null : num(raw.recalledAt) ? raw.recalledAt : undefined;
  if (endsAt === undefined || recalledAt === undefined) return null;
  const m = raw.message;
  const message =
    isRecord(m) && num(m.n) && Number.isInteger(m.n) && m.n >= 1 && num(m.at) && typeof m.text === 'string'
      ? { n: m.n, text: clip(m.text), at: m.at }
      : null;
  const members = Object.entries(isRecord(raw.members) ? raw.members : {}).filter(
    ([, g]) => typeof g === 'string' && groups.some((x) => x.id === g),
  ) as [string, string][];
  return {
    status: raw.status,
    groups,
    members: Object.fromEntries(members),
    startedAt: raw.startedAt,
    endsAt,
    message,
    recalledAt,
  };
}

/** The room's breakouts, with anyone no longer in the room dropped; null when none are set. */
export function readBreakouts(room: Pick<RoomState, 'shared' | 'players'> | null | undefined): BreakoutsState | null {
  const state = readShared(room, BREAKOUTS_KEY, decodeBreakouts);
  if (!state || !room) return state;
  const here = new Set(room.players.map((p) => p.id));
  return { ...state, members: Object.fromEntries(Object.entries(state.members).filter(([id]) => here.has(id))) };
}

/** The host event that sets the breakouts for every screen, or removes them with null. */
export function breakoutsEvent(state: BreakoutsState | null): RoomHostEvent {
  return { type: 'share', key: BREAKOUTS_KEY, value: state };
}

/** A message as sent: trimmed, spaces collapsed, cut to `MAX_MESSAGE` characters. */
function clip(text: string): string {
  return Array.from(text.trim().replace(/[^\S\n]+/g, ' '))
    .slice(0, MAX_MESSAGE)
    .join('')
    .trim();
}

/**
 * Sends `text` to every group. The same object when the text is empty or the players were recalled
 * (a message to no group). The count goes up by one, so a phone speaks it once.
 */
export function broadcast(state: BreakoutsState, text: string, at: number): BreakoutsState {
  const clean = clip(text);
  if (!clean || state.status !== 'open') return state;
  return { ...state, message: { n: (state.message?.n ?? 0) + 1, text: clean, at } };
}

/** Calls everyone back: the groups stay for reading, the timer stops, the message goes. */
export function recallBreakouts(state: BreakoutsState, at: number): BreakoutsState {
  if (state.status === 'recalled') return state;
  return { ...state, status: 'recalled', endsAt: null, message: null, recalledAt: at };
}

/** Sends everyone back to their groups, from a recall, with a fresh timer. */
export function reopenBreakouts(state: BreakoutsState, now: number, seconds: number | null = null): BreakoutsState {
  if (state.status === 'open') return state;
  return {
    ...state,
    status: 'open',
    startedAt: now,
    endsAt: seconds === null ? null : now + Math.max(0, seconds) * 1000,
    message: null,
    recalledAt: null,
  };
}

/** Gives the groups `seconds` more (from now, if time is up or there was no timer). */
export function extendBreakouts(state: BreakoutsState, seconds: number, now: number): BreakoutsState {
  if (state.status !== 'open' || !(seconds > 0)) return state;
  return { ...state, endsAt: Math.max(state.endsAt ?? now, now) + seconds * 1000 };
}

/** The group a player is in, or null. */
export function groupOf(state: BreakoutsState, playerId: string): Breakout | null {
  const id = Object.hasOwn(state.members, playerId) ? state.members[playerId] : undefined;
  return state.groups.find((g) => g.id === id) ?? null;
}

/** A group's players, in the order they joined the room. */
export function groupMembers(state: BreakoutsState, groupId: string, players: readonly RoomPlayer[]): RoomPlayer[] {
  return players.filter((p) => Object.hasOwn(state.members, p.id) && state.members[p.id] === groupId);
}

/** Moves a player to a group. The same object when nothing changes or the group is unknown. */
export function moveToGroup(state: BreakoutsState, playerId: string, groupId: string): BreakoutsState {
  if (groupOf(state, playerId)?.id === groupId || !state.groups.some((g) => g.id === groupId)) return state;
  return { ...state, members: { ...state.members, [playerId]: groupId } };
}

/** Puts each player in no group on the smallest group (the first on a tie): someone who joined late. */
export function placeNewcomers(state: BreakoutsState, players: readonly RoomPlayer[]): BreakoutsState {
  const loose = players.filter((p) => !groupOf(state, p.id));
  if (!loose.length || state.status !== 'open') return state;
  const count = state.groups.map((g) => groupMembers(state, g.id, players).length);
  const members = { ...state.members };
  for (const p of loose) {
    const at = smallestIndex(count);
    members[p.id] = (state.groups[at] as Breakout).id;
    count[at] = (count[at] as number) + 1;
  }
  return { ...state, members };
}

/** Whole seconds until time is up, 0 once it has passed, null with no timer. */
export function breakoutSecondsLeft(state: BreakoutsState, now: number): number | null {
  return state.endsAt === null ? null : Math.max(0, Math.ceil((state.endsAt - now) / 1000));
}
