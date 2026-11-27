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
  /**
   * When the join code stops letting new players in, in ms (host clock), or
   * null for a code that lasts as long as the room. Players already in can
   * still reconnect after it.
   */
  codeExpiresAt: number | null;
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
  /**
   * What the current round asks, as the host sent it with `question`: whatever
   * the game needs (a prompt and its choices, a number to guess). Every phone
   * and a player who joins late see the same round. null in the lobby.
   * Keep the answer out of it until `reveal`.
   */
  prompt: unknown;
  /** The round's answer, as the host sent it with `reveal`. null until then. */
  solution: unknown;
  /** Total points per player id. */
  scores: Record<string, number>;
  /** This round's answers per player id. Cleared when a new round starts. */
  answers: Record<string, RoomAnswer>;
  /** Points each player won in the last revealed round. */
  lastPoints: Record<string, number>;
  /**
   * Room-wide extras the host shares with every screen, by name: team assignments, breakout
   * groups, pairs (see `team-model`, `breakout-model`, `pair-model`). They ride in the room, so
   * they inherit its guarantees: the newest `seq` wins, a late joiner and a phone that reconnects
   * get them with the state, and a host that restores the room (`restoreRoom`) restores them.
   * Written by the host's `share` event; read with `readShared`, which treats them as untrusted.
   * Absent until the first `share`.
   */
  shared?: Record<string, unknown>;
  /**
   * The ids of each player's most recent `submit` events, so a message the network delivers twice
   * (or a player's own resend) is applied once, and a player can see theirs was taken.
   */
  acked?: Record<string, string[]>;
  /** Bumped on every change, so a client keeps only the newest state. */
  seq: number;
}

export interface RoomAnswer {
  value: unknown;
  /**
   * When it reached the host, in ms (host clock). `useRoom` stamps it on
   * arrival, so a player cannot claim an earlier answer than they gave.
   */
  at: number;
}

/** Why an activity refuses a move. */
export type ActivityRefusal = 'not-host' | 'wrong-phase' | 'full' | 'rate-limited' | 'bad-action';

export interface ActivityContext {
  /** Who made the move: a player's id, or the host's. */
  playerId: string;
  /** True when the host made it. */
  host: boolean;
  /** When it arrived, in ms (host clock). */
  at: number;
  /** Everyone in the room now. */
  players: readonly RoomPlayer[];
}

/**
 * An activity's rule: its slice of `RoomState.shared` (anything, or null before it starts: read it
 * as untrusted), one move, and who made it. Returns the new slice (null removes it) or why not.
 * Pure: the host runs it to decide and again to apply, so it must give the same answer twice.
 */
export type ActivityReducer = (
  slice: unknown,
  action: unknown,
  ctx: ActivityContext,
) => { slice: unknown } | { refuse: ActivityRefusal };

export interface RoomSettings {
  /** The activities this room runs, by the key of their slice. */
  activities?: Record<string, ActivityReducer>;
  /** The most players the room takes. @default 200 */
  maxPlayers?: number;
  /** The longest name, in characters. @default 24 */
  maxNameLength?: number;
}

export function createRoom(init: {
  code: string;
  hostId: string;
  rounds?: number | null;
  /** When the code stops admitting new players, in ms (host clock). */
  codeExpiresAt?: number | null;
}): RoomState {
  return {
    code: init.code,
    hostId: init.hostId,
    phase: 'lobby',
    locked: false,
    codeExpiresAt: init.codeExpiresAt ?? null,
    players: [],
    removed: [],
    round: 0,
    rounds: init.rounds ?? null,
    startsAt: null,
    endsAt: null,
    prompt: null,
    solution: null,
    scores: {},
    answers: {},
    lastPoints: {},
    seq: 0,
  };
}

// --- Events ---------------------------------------------------------------------

/** Events a player sends about themselves. */
export type RoomPlayerEvent =
  | {
      type: 'join';
      playerId: string;
      name: string;
      /**
       * When the join arrived, in ms. `useRoom` stamps it with the host's clock,
       * so an expired code cannot be beaten by a phone with its clock set back;
       * code that calls `applyRoomEvent` directly must stamp it too. While the
       * room has an expiry, an unstamped new join is refused as `expired`.
       */
      at?: number;
    }
  | { type: 'leave'; playerId: string }
  /**
   * A player's move in an activity that takes input from everyone (a question, a vote, a reaction, a
   * raised hand, a spot on a line). `key` names the activity (`RoomState.shared[key]`), `action` is
   * what it takes, and `id` is unique per move: the host applies a move once however often it
   * arrives. The host may send one too (`playerId` its own id), for what only it may do. Which
   * moves an activity allows is its reducer's rule (`RoomSettings.activities`).
   */
  | {
      type: 'submit';
      playerId: string;
      id: string;
      key: string;
      action: unknown;
      /**
       * When it arrived, in ms (host clock). `useRoom` stamps it; code that calls `applyRoomEvent`
       * directly must too. A `submit` without it is refused.
       */
      at?: number;
      /** Send it again until the host's state shows it. @default true. Off for moves that go stale (a reaction). */
      retry?: boolean;
    }
  | {
      type: 'answer';
      playerId: string;
      value: unknown;
      /**
       * When the answer arrived. `useRoom` replaces it with the host's clock on
       * receipt; code that calls `applyRoomEvent` directly must do the same
       * rather than trust the sender's value.
       */
      at: number;
    };

/** Events only the host sends. */
export type RoomHostEvent =
  | { type: 'lock'; locked: boolean }
  /** Moves the code's expiry: later to let latecomers in, null for no expiry. */
  | { type: 'extend-code'; expiresAt: number | null }
  | { type: 'remove'; playerId: string }
  /** Starts the countdown to the first round (or the next one). */
  | { type: 'countdown'; startsAt: number }
  /** Opens a round. `endsAt` null for no clock. `prompt`: what the round asks (see `RoomState.prompt`). */
  | { type: 'question'; endsAt: number | null; prompt?: unknown }
  /** Closes the round and adds each player's points. `solution`: the round's answer, for every screen. */
  | { type: 'reveal'; points: Record<string, number>; solution?: unknown }
  | { type: 'podium' }
  | { type: 'close' }
  /** Back to the lobby with the same players, scores at zero and the room open again. */
  | { type: 'restart' }
  /** Sets one named extra for every screen (`RoomState.shared`); `value` null removes it. */
  | { type: 'share'; key: string; value: unknown };

export type RoomEvent = RoomPlayerEvent | RoomHostEvent;

export type RoomRejection =
  | 'not-host'
  | 'not-you'
  | 'closed'
  | 'locked'
  | 'expired'
  | 'full'
  | 'removed'
  | 'name-empty'
  | 'name-taken'
  | 'wrong-phase'
  | 'already-answered'
  | 'unknown-player'
  /** A `share` with a key that is not a short lowercase name, or a value that is not JSON or too big. */
  | 'bad-share'
  /** A `submit` for an activity this room does not run. */
  | 'unknown-activity'
  /** A `submit` the activity cannot take (nonsense, or not allowed now). */
  | 'bad-action'
  /** A `submit` with an id the host already applied: said nothing to, never counted twice. */
  | 'duplicate'
  /** Too many moves too fast from this player, or from the room. */
  | 'rate-limited';

const HOST_EVENTS = new Set<RoomEvent['type']>([
  'lock',
  'extend-code',
  'remove',
  'countdown',
  'question',
  'reveal',
  'podium',
  'close',
  'restart',
  'share',
]);

/** Names of `shared` entries: lowercase, digits and dashes, so no key can be `__proto__`. */
const SHARE_KEY = /^[a-z][a-z0-9-]{0,31}$/;
/** The most a room's extras may weigh as JSON, in characters: every state message carries them. */
export const MAX_SHARED_SIZE = 60_000;

/** Which phases each host step may follow. */
const NEXT: Partial<Record<RoomEvent['type'], readonly RoomPhase[]>> = {
  countdown: ['lobby', 'reveal'],
  question: ['countdown', 'reveal'],
  reveal: ['question'],
  podium: ['reveal', 'question'],
  restart: ['podium', 'reveal', 'question', 'countdown', 'lobby'],
};

/**
 * True when a join at `at` (host clock) comes after the code stopped admitting new players.
 * Fails closed: when the room has an expiry, a join without `at` counts as expired, so a server
 * that forgets to stamp joins cannot let people in late. Stamp `join.at` with the host clock.
 */
export function codeExpired(state: Pick<RoomState, 'codeExpiresAt'>, at: number | undefined): boolean {
  if (state.codeExpiresAt === null) return false;
  return at === undefined || at >= state.codeExpiresAt;
}

/** A display name, trimmed, inner spaces collapsed, and cut to `max` characters. */
export function cleanName(name: string, max = 24): string {
  return Array.from(name.trim().replace(/\s+/g, ' ')).slice(0, max).join('').trim();
}

const sameName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;

/** How many ids of a player's `submit` moves the room remembers. */
export const ACK_KEEP = 16;

type SubmitEvent = Extract<RoomEvent, { type: 'submit' }>;

/** What a `submit` would do, or why it may not: the same call decides and applies. */
function runSubmit(
  state: RoomState,
  event: SubmitEvent,
  settings: RoomSettings,
): { slice: unknown } | { refuse: RoomRejection } {
  if (event.playerId !== state.hostId && !state.players.some((p) => p.id === event.playerId))
    return { refuse: 'unknown-player' };
  if (typeof event.id !== 'string' || !event.id || event.id.length > 64 || typeof event.at !== 'number' || !Number.isFinite(event.at))
    return { refuse: 'bad-action' };
  if (Object.hasOwn(state.acked ?? {}, event.playerId) && (state.acked as Record<string, string[]>)[event.playerId]!.includes(event.id))
    return { refuse: 'duplicate' };
  const reducer = SHARE_KEY.test(event.key) && settings.activities && Object.hasOwn(settings.activities, event.key) ? settings.activities[event.key] : undefined;
  if (!reducer) return { refuse: 'unknown-activity' };
  const slice = state.shared && Object.hasOwn(state.shared, event.key) ? state.shared[event.key] : null;
  let result: ReturnType<ActivityReducer>;
  try {
    result = reducer(slice, event.action, { playerId: event.playerId, host: event.playerId === state.hostId, at: event.at, players: state.players });
  } catch {
    return { refuse: 'bad-action' };
  }
  if ('refuse' in result) return result;
  const json = JSON.stringify(result.slice ?? null);
  return json === undefined || json.length > MAX_SHARED_SIZE ? { refuse: 'full' } : result;
}

function rejectSubmit(state: RoomState, event: SubmitEvent, settings: RoomSettings): RoomRejection | null {
  const result = runSubmit(state, event, settings);
  return 'refuse' in result ? result.refuse : null;
}

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
      if (codeExpired(state, event.at)) return 'expired';
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
    case 'submit':
      return rejectSubmit(state, event, settings);
    case 'share': {
      if (!SHARE_KEY.test(event.key)) return 'bad-share';
      const json = JSON.stringify(event.value);
      return json === undefined || json.length > MAX_SHARED_SIZE ? 'bad-share' : null;
    }
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
    case 'extend-code':
      return next({ codeExpiresAt: event.expiresAt });
    case 'remove': {
      const { [event.playerId]: _score, ...scores } = state.scores;
      const { [event.playerId]: _answer, ...answers } = state.answers;
      const { [event.playerId]: _acks, ...acked } = state.acked ?? {};
      return next({
        acked,
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
        prompt: event.prompt ?? null,
        solution: null,
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
      return next({ phase: 'reveal', scores, lastPoints, endsAt: null, solution: event.solution ?? null });
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
    case 'submit': {
      const result = runSubmit(state, event, settings) as { slice: unknown };
      const { [event.key]: _old, ...rest } = state.shared ?? {};
      const mine = Object.hasOwn(state.acked ?? {}, event.playerId) ? (state.acked as Record<string, string[]>)[event.playerId]! : [];
      return next({
        shared: result.slice === null ? rest : { ...rest, [event.key]: result.slice },
        acked: { ...state.acked, [event.playerId]: [...mine, event.id].slice(-ACK_KEEP) },
      });
    }
    case 'share': {
      const { [event.key]: _old, ...rest } = state.shared ?? {};
      return next({ shared: event.value === null ? rest : { ...rest, [event.key]: event.value } });
    }
    case 'restart':
      return next({
        phase: 'lobby',
        locked: false,
        round: 0,
        startsAt: null,
        endsAt: null,
        prompt: null,
        solution: null,
        answers: {},
        lastPoints: {},
        scores: Object.fromEntries(state.players.map((p) => [p.id, 0])),
      });
  }
}

// --- Guessing codes -------------------------------------------------------------

/*
 * Stops people guessing their way into a room. Every wrong code counts
 * against where it came from (a network, a device, whatever key your server
 * trusts) and against the room as a whole; past either limit, more tries are
 * refused until the window moves on. A six-character code from
 * `makeJoinCode` has about 600 million values, so five tries per source and
 * thirty per room leave a guesser nowhere, while a person who mistyped twice
 * is never stopped. Pure and serialisable: keep the state wherever the code
 * is checked (a server, an edge function, the host), call `checkJoinAttempt`
 * before comparing the code and `recordJoinAttempt` after.
 */

export interface JoinGuardOptions {
  /** Wrong tries one source may make in the window. @default 5 */
  perSource?: number;
  /** Wrong tries the whole room accepts in the window, across sources. @default 30 */
  total?: number;
  /** How far back wrong tries count, in ms. @default 10 minutes */
  windowMs?: number;
}

export interface JoinGuardState {
  /** Wrong tries, oldest first. */
  failures: { source: string; at: number }[];
}

export type JoinGuardVerdict =
  | { allowed: true; left: number }
  | {
      allowed: false;
      /** `source`: this source used its tries. `room`: the room stopped taking guesses. */
      reason: 'source' | 'room';
      /** When the oldest counted try leaves the window and one more is allowed, in ms. */
      retryAt: number;
    };

const DEFAULTS = { perSource: 5, total: 30, windowMs: 10 * 60_000 };

const settings = (o: JoinGuardOptions) => ({
  perSource: Math.max(1, Math.floor(o.perSource ?? DEFAULTS.perSource)),
  total: Math.max(1, Math.floor(o.total ?? DEFAULTS.total)),
  windowMs: Math.max(1, o.windowMs ?? DEFAULTS.windowMs),
});

export function createJoinGuard(): JoinGuardState {
  return { failures: [] };
}

/** Drops wrong tries older than the window. */
export function pruneJoinGuard(state: JoinGuardState, now: number, options: JoinGuardOptions = {}): JoinGuardState {
  const { windowMs } = settings(options);
  const failures = state.failures.filter((f) => now - f.at < windowMs);
  return failures.length === state.failures.length ? state : { failures };
}

/** May `source` try a code now? Ask before comparing the code, so a blocked source learns nothing. */
export function checkJoinAttempt(
  state: JoinGuardState,
  source: string,
  now: number,
  options: JoinGuardOptions = {},
): JoinGuardVerdict {
  const { perSource, total, windowMs } = settings(options);
  const recent = pruneJoinGuard(state, now, options).failures;
  const mine = recent.filter((f) => f.source === source);
  if (recent.length >= total) {
    return { allowed: false, reason: 'room', retryAt: recent[recent.length - total]!.at + windowMs };
  }
  if (mine.length >= perSource) {
    return { allowed: false, reason: 'source', retryAt: mine[mine.length - perSource]!.at + windowMs };
  }
  return { allowed: true, left: Math.min(perSource - mine.length, total - recent.length) };
}

/** The guard after a try: a wrong code is counted, a right one changes nothing. */
export function recordJoinAttempt(
  state: JoinGuardState,
  source: string,
  correct: boolean,
  now: number,
  options: JoinGuardOptions = {},
): JoinGuardState {
  const pruned = pruneJoinGuard(state, now, options);
  return correct ? pruned : { failures: [...pruned.failures, { source, at: now }] };
}

// --- Reading the state ----------------------------------------------------------

/**
 * How far the host's clock is ahead of this one, in ms, from `{ at, local }` pairs: the host's
 * send time and this client's receive time. A message can only arrive after it was sent, so each
 * `at - local` is a lower bound on the true offset and the largest is the closest. Pass the recent
 * samples only, so a host whose clock is reset is followed. 0 with no samples.
 */
export function clockOffset(samples: readonly { at: number; local: number }[]): number {
  let best = -Infinity;
  for (const s of samples) if (Number.isFinite(s.at) && Number.isFinite(s.local)) best = Math.max(best, s.at - s.local);
  return best === -Infinity ? 0 : best;
}

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

/**
 * One named extra from `RoomState.shared`, read as untrusted: `decode` gets whatever is there
 * (anything, from an older version of the app or a bad client) and returns the value or null.
 * Null too when it is absent, or when `decode` throws, so a screen shows "nothing set" rather
 * than breaking.
 */
export function readShared<T>(
  state: Pick<RoomState, 'shared'> | null | undefined,
  key: string,
  decode: (raw: unknown) => T | null,
): T | null {
  const shared = state?.shared;
  if (!shared || !Object.hasOwn(shared, key)) return null;
  try {
    return decode(shared[key]);
  } catch {
    return null;
  }
}

// --- Keeping a room across a refresh -------------------------------------------------

/**
 * How far `restoreRoom` moves `seq` ahead. A host that restores a save written just before its
 * last few changes would otherwise send states the phones already hold newer ones of, and every
 * phone would ignore them.
 */
export const RESTORE_SEQ_JUMP = 1_000;

const PHASES: readonly RoomPhase[] = ['lobby', 'countdown', 'question', 'reveal', 'podium', 'closed'];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nullableNum = (v: unknown): number | null | undefined => (v === null ? null : isNum(v) ? v : undefined);
const isCount = (v: unknown): v is number => isNum(v) && Number.isInteger(v) && v >= 0;

/** A record read from JSON, as plain own properties (a `__proto__` key stays data), values checked. */
function cleanRecord<T>(raw: unknown, ok: (v: unknown) => T | undefined): Record<string, T> {
  const out: [string, T][] = [];
  if (isRecord(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const value = ok(v);
      if (value !== undefined) out.push([k, value]);
    }
  }
  return Object.fromEntries(out);
}

/** The room as text, to keep in `localStorage` or on a server, so a host that refreshes can go on. */
export function serializeRoom(state: RoomState): string {
  return JSON.stringify(state);
}

/**
 * The room from text written by `serializeRoom`, or null when it is not one (absent, damaged, from
 * another host). Everything is checked and rebuilt, never trusted. Nobody is known to be here yet:
 * each player comes back `away`, and a phone that is still open says so by itself (it sees itself
 * away and joins again), so the host never shows someone present who left while it was down.
 * Scores, answers, rounds, clocks and the room's extras are kept, and `seq` moves ahead by
 * `RESTORE_SEQ_JUMP` so phones take the restored state as the newest.
 *
 * Pass `hostId` to refuse a room saved by someone else.
 */
export function restoreRoom(text: string | null | undefined, options: { hostId?: string } = {}): RoomState | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  const { code, hostId, phase, players, seq, round } = raw;
  if (typeof code !== 'string' || !code || typeof hostId !== 'string' || !hostId) return null;
  if (options.hostId !== undefined && hostId !== options.hostId) return null;
  if (!PHASES.includes(phase as RoomPhase) || !Array.isArray(players) || !isCount(seq) || !isCount(round)) return null;
  const seen = new Set<string>();
  const kept: RoomPlayer[] = [];
  for (const p of players) {
    if (!isRecord(p) || typeof p.id !== 'string' || typeof p.name !== 'string') return null;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    kept.push({ id: p.id, name: p.name, connected: false });
  }
  const rounds = raw.rounds === null || raw.rounds === undefined ? null : isCount(raw.rounds) ? raw.rounds : undefined;
  const startsAt = nullableNum(raw.startsAt ?? null);
  const endsAt = nullableNum(raw.endsAt ?? null);
  const codeExpiresAt = nullableNum(raw.codeExpiresAt ?? null);
  if (rounds === undefined || startsAt === undefined || endsAt === undefined || codeExpiresAt === undefined) return null;
  const num = (v: unknown) => (isNum(v) ? v : undefined);
  const answer = (v: unknown) => (isRecord(v) && isNum(v.at) ? { value: v.value, at: v.at } : undefined);
  const state: RoomState = {
    code,
    hostId,
    phase: phase as RoomPhase,
    locked: raw.locked === true,
    codeExpiresAt,
    players: kept,
    removed: Array.isArray(raw.removed) ? raw.removed.filter((id): id is string => typeof id === 'string') : [],
    round,
    rounds,
    startsAt,
    endsAt,
    prompt: raw.prompt ?? null,
    solution: raw.solution ?? null,
    scores: cleanRecord(raw.scores, num),
    answers: cleanRecord(raw.answers, answer),
    lastPoints: cleanRecord(raw.lastPoints, num),
    seq: seq + RESTORE_SEQ_JUMP,
  };
  const acked = cleanRecord(raw.acked, (v) =>
    Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64).slice(-ACK_KEEP) : undefined,
  );
  if (Object.keys(acked).length) state.acked = acked;
  if (isRecord(raw.shared)) state.shared = Object.fromEntries(Object.entries(raw.shared).filter(([k]) => SHARE_KEY.test(k)));
  return state;
}

/** Where a host keeps its room between page loads. `Storage` fits (`localStorage`, `sessionStorage`). */
export interface RoomStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * A room kept in `storage` under `key`. Storage that is missing, full or blocked (a private window,
 * a storage-less embed) never throws: `load` finds nothing and `save` does nothing, and the room
 * carries on in memory. Call `save` after every change, `clear` when the game ends.
 */
export function createRoomStore(
  storage: RoomStorage | null | undefined,
  key: string,
  options: { hostId?: string } = {},
): { load(): RoomState | null; save(state: RoomState): void; clear(): void } {
  return {
    load() {
      try {
        return restoreRoom(storage?.getItem(key), options);
      } catch {
        return null;
      }
    },
    save(state) {
      try {
        storage?.setItem(key, serializeRoom(state));
      } catch {
        /* a full or blocked store must not stop the game */
      }
    },
    clear() {
      try {
        storage?.removeItem(key);
      } catch {
        /* nothing to clear */
      }
    },
  };
}

// --- Transport ------------------------------------------------------------------

/** What travels between the host and the players. */
export type RoomMessage =
  /** A player asks the host to apply an event. */
  | { kind: 'intent'; from: string; event: RoomEvent }
  /** The host's room, after every change. */
  | {
      kind: 'state';
      state: RoomState;
      /** The host's clock when it sent this, in ms. Phones use it to read deadlines on the host's time. */
      at?: number;
    }
  /** A client that just arrived asks for the current state. */
  | { kind: 'hello'; from: string }
  /** The host refused a player's intent, and why. */
  | {
      kind: 'rejected';
      to: string;
      event: RoomEvent['type'];
      reason: RoomRejection;
      /** For a refused `submit`: its id, so the player stops sending that move. */
      id?: string;
    };

/**
 * How a room talks. `send` reaches every other client in the room (not the
 * sender); `subscribe` returns an unsubscribe. Wrap any realtime service in
 * these two functions.
 */
export interface RoomTransport<M = RoomMessage> {
  send(message: M): void;
  subscribe(listener: (message: M) => void): () => void;
  /** Optional: release the connection. */
  close?(): void;
}

/**
 * An in-memory room: every `connect()` is a client, and messages arrive on
 * the next microtask, like a network would deliver them. For tests, demos
 * and a host and players on one screen.
 */
export function createMemoryRoomHub<M = RoomMessage>(): { connect(): RoomTransport<M> } {
  const clients = new Set<(message: M) => void>();
  return {
    connect() {
      const own = new Set<(message: M) => void>();
      const deliver = (message: M) => own.forEach((l) => l(message));
      clients.add(deliver);
      return {
        send(message) {
          const copy = JSON.parse(JSON.stringify(message)) as M;
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
export function createBroadcastRoomTransport<M = RoomMessage>(name: string): RoomTransport<M> | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  const channel = new BroadcastChannel(name);
  return {
    send: (message) => channel.postMessage(message),
    subscribe(listener) {
      const handle = (e: MessageEvent<M>) => listener(e.data);
      channel.addEventListener('message', handle);
      return () => channel.removeEventListener('message', handle);
    },
    close: () => channel.close(),
  };
}
