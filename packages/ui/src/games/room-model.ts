/**
 * @interlace/ui — games/room-model
 *
 * The pure core of a live room: one host on a big screen, players on their
 * phones, a join code, a lobby, rounds and a podium. Every client runs the
 * same reducer, so the host's screen and every phone agree on what happens,
 * and a server can replay a room from its events.
 *
 * The host is the authority. Players send intents (join, leave, answer); the
 * host applies them with `applyRoomEvent`, which refuses anything the sender
 * may not do, and sends the new state to everyone. How messages travel is a
 * `RoomTransport`: two functions, so any realtime service fits behind it. The
 * kit ships an in-memory hub (tests, demos, one screen) and a
 * BroadcastChannel transport (tabs on one device); a WebSocket or hosted
 * realtime adapter is a few lines in the app.
 *
 * Time is always a timestamp in ms from the host's clock (`startsAt`,
 * `endsAt`), so a phone that joins late counts down to the same moment.
 */

import { rankEntries, type RankedEntry } from './leaderboard-model.js';

// --- Join codes -----------------------------------------------------------------

/** Letters and digits no one misreads: no 0/O, 1/I/L, or U/V. */
export const JOIN_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTWXYZ';

export interface JoinCodeOptions {
  /** @default 6 */
  length?: number;
  /** @default JOIN_CODE_ALPHABET. Pass '0123456789' for a numeric PIN. */
  alphabet?: string;
}

/**
 * A new join code. Leave `random` out to draw from `crypto.getRandomValues`
 * without bias (rejection sampling on a bit mask); pass a function returning
 * a float in [0, 1) for seeded tests. The alphabet holds at most 256 characters.
 */
export function makeJoinCode(options: JoinCodeOptions = {}, random?: () => number): string {
  const { length = 6, alphabet = JOIN_CODE_ALPHABET } = options;
  const n = alphabet.length;
  if (n < 1 || n > 256) throw new RangeError('A join code alphabet holds 1 to 256 characters.');
  const crypto = (globalThis as { crypto?: Crypto }).crypto;
  let code = '';
  if (!random && crypto?.getRandomValues) {
    const mask = 2 ** Math.ceil(Math.log2(n)) - 1;
    while (code.length < length) {
      for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
        const index = byte & mask;
        if (index < n && code.length < length) code += alphabet[index];
      }
    }
    return code;
  }
  const pick = random ?? Math.random;
  for (let i = 0; i < length; i++) code += alphabet[Math.min(n - 1, Math.floor(pick() * n))];
  return code;
}

/**
 * What someone typed, as a code: upper case, spaces and dashes dropped.
 * Returns null when it has the wrong length or a character outside the
 * alphabet, so the field can say so before anything is sent.
 */
export function normalizeJoinCode(input: string, options: JoinCodeOptions = {}): string | null {
  const { length = 6, alphabet = JOIN_CODE_ALPHABET } = options;
  const code = input.toUpperCase().replace(/[\s\-–—.]/g, '');
  if (code.length !== length) return null;
  for (const ch of code) if (!alphabet.includes(ch)) return null;
  return code;
}

/** A code in groups for reading aloud and on a big screen: "K7Q 4MZ". */
export function formatJoinCode(code: string, group = 3): string {
  if (group <= 0) return code;
  const parts: string[] = [];
  for (let i = 0; i < code.length; i += group) parts.push(code.slice(i, i + group));
  return parts.join(' ');
}

// --- State ----------------------------------------------------------------------

export type RoomPhase = 'lobby' | 'countdown' | 'question' | 'reveal' | 'podium' | 'closed';

export interface RoomPlayer {
  id: string;
  name: string;
  /** False after `leave`; the player keeps their score and can come back. */
  connected: boolean;
}

export interface RoomState {
  code: string;
  hostId: string;
  phase: RoomPhase;
  /** No new players while locked. Players already in can still reconnect. */
  locked: boolean;
  /** In the order they joined. */
  players: RoomPlayer[];
  /** Players the host removed; they cannot join again with the same id. */
  removed: string[];
  /** 0 in the lobby, then 1, 2, 3… */
  round: number;
  /** How many rounds the game has, when known. */
  rounds: number | null;
  /** When the countdown ends, in ms (host clock). */
  startsAt: number | null;
  /** When the current question closes, in ms (host clock). null: no clock. */
  endsAt: number | null;
  /** Total points per player id. */
  scores: Record<string, number>;
  /** This round's answers per player id. Cleared when a new round starts. */
  answers: Record<string, RoomAnswer>;
  /** Points each player won in the last revealed round. */
  lastPoints: Record<string, number>;
  /** Bumped on every change, so a client keeps only the newest state. */
  seq: number;
}

export interface RoomAnswer {
  value: unknown;
  /** When it arrived, in ms (host clock). */
  at: number;
}

export interface RoomSettings {
  /** The most players the room takes. @default 200 */
  maxPlayers?: number;
  /** The longest name, in characters. @default 24 */
  maxNameLength?: number;
}

export function createRoom(init: { code: string; hostId: string; rounds?: number | null }): RoomState {
  return {
    code: init.code,
    hostId: init.hostId,
    phase: 'lobby',
    locked: false,
    players: [],
    removed: [],
    round: 0,
    rounds: init.rounds ?? null,
    startsAt: null,
    endsAt: null,
    scores: {},
    answers: {},
    lastPoints: {},
    seq: 0,
  };
}

// --- Events ---------------------------------------------------------------------

/** Events a player sends about themselves. */
export type RoomPlayerEvent =
  | { type: 'join'; playerId: string; name: string }
  | { type: 'leave'; playerId: string }
  | { type: 'answer'; playerId: string; value: unknown; at: number };

/** Events only the host sends. */
export type RoomHostEvent =
  | { type: 'lock'; locked: boolean }
  | { type: 'remove'; playerId: string }
  /** Starts the countdown to the first round (or the next one). */
  | { type: 'countdown'; startsAt: number }
  /** Opens a round. `endsAt` null for no clock. */
  | { type: 'question'; endsAt: number | null }
  /** Closes the round and adds each player's points. */
  | { type: 'reveal'; points: Record<string, number> }
  | { type: 'podium' }
  | { type: 'close' }
  /** Back to the lobby with the same players, scores at zero. */
  | { type: 'restart' };

export type RoomEvent = RoomPlayerEvent | RoomHostEvent;

export type RoomRejection =
  | 'not-host'
  | 'not-you'
  | 'closed'
  | 'locked'
  | 'full'
  | 'removed'
  | 'name-empty'
  | 'name-taken'
  | 'wrong-phase'
  | 'already-answered'
  | 'unknown-player';

const HOST_EVENTS = new Set<RoomEvent['type']>([
  'lock',
  'remove',
  'countdown',
  'question',
  'reveal',
  'podium',
  'close',
  'restart',
]);

/** Which phases each host step may follow. */
const NEXT: Partial<Record<RoomEvent['type'], readonly RoomPhase[]>> = {
  countdown: ['lobby', 'reveal'],
  question: ['countdown', 'reveal'],
  reveal: ['question'],
  podium: ['reveal', 'question'],
  restart: ['podium', 'reveal', 'question', 'countdown', 'lobby'],
};

/** A display name, trimmed, inner spaces collapsed, and cut to `max` characters. */
export function cleanName(name: string, max = 24): string {
  return Array.from(name.trim().replace(/\s+/g, ' ')).slice(0, max).join('').trim();
}

const sameName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;

/**
 * Why `from` may not apply `event` to `state`, or null when they may. The
 * host's own id may send any event; a player may send only their own.
 */
export function rejectRoomEvent(
  state: RoomState,
  event: RoomEvent,
  from: string,
  settings: RoomSettings = {},
): RoomRejection | null {
  const isHost = from === state.hostId;
  if (HOST_EVENTS.has(event.type)) {
    if (!isHost) return 'not-host';
  } else if (!isHost && (event as RoomPlayerEvent).playerId !== from) {
    return 'not-you';
  }
  if (state.phase === 'closed') return 'closed';

  const allowed = NEXT[event.type];
  if (allowed && !allowed.includes(state.phase)) return 'wrong-phase';

  switch (event.type) {
    case 'join': {
      if (state.removed.includes(event.playerId)) return 'removed';
      const name = cleanName(event.name, settings.maxNameLength);
      if (!name) return 'name-empty';
      const known = state.players.find((p) => p.id === event.playerId);
      if (state.players.some((p) => p.id !== event.playerId && sameName(p.name, name))) return 'name-taken';
      if (known) return null; // a reconnect, even when locked
      if (state.locked) return 'locked';
      if (state.players.length >= (settings.maxPlayers ?? 200)) return 'full';
      return null;
    }
    case 'leave':
      return state.players.some((p) => p.id === event.playerId) ? null : 'unknown-player';
    case 'answer':
      if (state.phase !== 'question') return 'wrong-phase';
      if (!state.players.some((p) => p.id === event.playerId)) return 'unknown-player';
      if (event.playerId in state.answers) return 'already-answered';
      return null;
    case 'remove':
      return state.players.some((p) => p.id === event.playerId) ? null : 'unknown-player';
    default:
      return null;
  }
}

/**
 * The room after `event` from `from`. Returns the same object when the
 * event is refused (see `rejectRoomEvent`), so `next === state` means
 * nothing happened.
 */
export function applyRoomEvent(
  state: RoomState,
  event: RoomEvent,
  from: string,
  settings: RoomSettings = {},
): RoomState {
  if (rejectRoomEvent(state, event, from, settings)) return state;
  const next = (patch: Partial<RoomState>): RoomState => ({
    ...state,
    ...patch,
    seq: state.seq + 1,
  });

  switch (event.type) {
    case 'join': {
      const name = cleanName(event.name, settings.maxNameLength);
      const known = state.players.some((p) => p.id === event.playerId);
      return next({
        players: known
          ? state.players.map((p) => (p.id === event.playerId ? { ...p, name, connected: true } : p))
          : [...state.players, { id: event.playerId, name, connected: true }],
        scores: known ? state.scores : { ...state.scores, [event.playerId]: 0 },
      });
    }
    case 'leave':
      return next({
        players: state.players.map((p) => (p.id === event.playerId ? { ...p, connected: false } : p)),
      });
    case 'answer':
      return next({
        answers: {
          ...state.answers,
          [event.playerId]: { value: event.value, at: event.at },
        },
      });
    case 'lock':
      return next({ locked: event.locked });
    case 'remove': {
      const { [event.playerId]: _score, ...scores } = state.scores;
      const { [event.playerId]: _answer, ...answers } = state.answers;
      return next({
        players: state.players.filter((p) => p.id !== event.playerId),
        removed: [...state.removed, event.playerId],
        scores,
        answers,
      });
    }
    case 'countdown':
      return next({
        phase: 'countdown',
        startsAt: event.startsAt,
        endsAt: null,
      });
    case 'question':
      return next({
        phase: 'question',
        round: state.round + 1,
        endsAt: event.endsAt,
        answers: {},
        lastPoints: {},
      });
    case 'reveal': {
      const scores = { ...state.scores };
      const lastPoints: Record<string, number> = {};
      for (const p of state.players) {
        const won = Number.isFinite(event.points[p.id]) ? event.points[p.id]! : 0;
        lastPoints[p.id] = won;
        scores[p.id] = (scores[p.id] ?? 0) + won;
      }
      return next({ phase: 'reveal', scores, lastPoints, endsAt: null });
    }
    case 'podium':
      return next({ phase: 'podium', endsAt: null });
    case 'close':
      return next({
        phase: 'closed',
        locked: true,
        startsAt: null,
        endsAt: null,
      });
    case 'restart':
      return next({
        phase: 'lobby',
        round: 0,
        startsAt: null,
        endsAt: null,
        answers: {},
        lastPoints: {},
        scores: Object.fromEntries(state.players.map((p) => [p.id, 0])),
      });
  }
}

// --- Reading the state ----------------------------------------------------------

/** Players still connected. */
export function connectedPlayers(state: RoomState): RoomPlayer[] {
  return state.players.filter((p) => p.connected);
}

/** How many connected players have answered this round, of how many. */
export function answerProgress(state: RoomState): {
  answered: number;
  total: number;
} {
  const live = connectedPlayers(state);
  return {
    answered: live.filter((p) => p.id in state.answers).length,
    total: live.length,
  };
}

/** Everyone in the room by score, ties sharing a rank (the leaderboard's ranking). */
export function roomStandings(state: RoomState): RankedEntry[] {
  return rankEntries(
    state.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: state.scores[p.id] ?? 0,
    })),
  );
}

// --- Transport ------------------------------------------------------------------

/** What travels between the host and the players. */
export type RoomMessage =
  /** A player asks the host to apply an event. */
  | { kind: 'intent'; from: string; event: RoomEvent }
  /** The host's room, after every change. */
  | { kind: 'state'; state: RoomState }
  /** A client that just arrived asks for the current state. */
  | { kind: 'hello'; from: string }
  /** The host refused a player's intent, and why. */
  | {
      kind: 'rejected';
      to: string;
      event: RoomEvent['type'];
      reason: RoomRejection;
    };

/**
 * How a room talks. `send` reaches every other client in the room (not the
 * sender); `subscribe` returns an unsubscribe. Wrap any realtime service in
 * these two functions.
 */
export interface RoomTransport {
  send(message: RoomMessage): void;
  subscribe(listener: (message: RoomMessage) => void): () => void;
  /** Optional: release the connection. */
  close?(): void;
}

/**
 * An in-memory room: every `connect()` is a client, and messages arrive on
 * the next microtask, like a network would deliver them. For tests, demos
 * and a host and players on one screen.
 */
export function createMemoryRoomHub(): { connect(): RoomTransport } {
  const clients = new Set<(message: RoomMessage) => void>();
  return {
    connect() {
      const own = new Set<(message: RoomMessage) => void>();
      const deliver = (message: RoomMessage) => own.forEach((l) => l(message));
      clients.add(deliver);
      return {
        send(message) {
          const copy = JSON.parse(JSON.stringify(message)) as RoomMessage;
          queueMicrotask(() => clients.forEach((c) => c !== deliver && c(copy)));
        },
        subscribe(listener) {
          own.add(listener);
          return () => own.delete(listener);
        },
        close() {
          clients.delete(deliver);
          own.clear();
        },
      };
    },
  };
}

/**
 * A transport over `BroadcastChannel`: every tab of the same site on this
 * device that opens the same `name` is in the room. Null where the browser
 * has no BroadcastChannel.
 */
export function createBroadcastRoomTransport(name: string): RoomTransport | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  const channel = new BroadcastChannel(name);
  return {
    send: (message) => channel.postMessage(message),
    subscribe(listener) {
      const handle = (e: MessageEvent<RoomMessage>) => listener(e.data);
      channel.addEventListener('message', handle);
      return () => channel.removeEventListener('message', handle);
    },
    close: () => channel.close(),
  };
}
