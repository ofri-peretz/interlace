'use client';

/**
 * @interlace/ui — LiveRoom: useRoom, RoomLobby, RoomCountdown, RoomHostControls
 *
 * A game night on one big screen and everyone's phones. The host opens a
 * room and shows its JoinCode; players scan or type it and land in the
 * lobby; the host starts, everyone sees the same countdown, plays the same
 * rounds, and the night ends on a Podium. The rules of the room live in
 * `room-model.ts` (pure), and the network is whatever `RoomTransport` the
 * app passes, so no realtime vendor is built in.
 *
 * ## Anatomy
 *
 *   useRoom({ transport, selfId, host? })  → { room, isHost, send }
 *
 *   RoomLobby                      (section — data-slot="room-lobby", data-count)
 *     ├─ div                       (data-slot="room-lobby-join": your JoinCode, when given)
 *     ├─ h2                        (data-slot="room-lobby-count": "8 players")
 *     ├─ ul                        (data-slot="room-lobby-players")
 *     │   └─ li × n                (data-slot="room-lobby-player", data-self, data-away)
 *     │       └─ Button?           (data-slot="room-lobby-remove", host only)
 *     ├─ p                         (data-slot="room-lobby-empty", before anyone joins)
 *     ├─ div                       (data-slot="room-lobby-actions": host controls, or "Waiting for the host")
 *     └─ span aria-live            (data-slot="room-lobby-announce": "Dana joined")
 *
 *   RoomCountdown                  (div role="timer" — data-slot="room-countdown", data-state)
 *     ├─ span                      (data-slot="room-countdown-value": 3, 2, 1, then "Go")
 *     └─ span aria-live            (data-slot="room-countdown-announce")
 *
 *   RoomHostControls               (div role="group" — data-slot="room-host-controls", data-phase)
 *     ├─ p aria-live               (data-slot="room-host-status": "5 of 8 answered")
 *     ├─ Button                    (data-slot="room-host-primary": Start / Reveal / Next / Podium / Play again)
 *     ├─ Button                    (data-slot="room-host-lock": lock or unlock)
 *     └─ Button                    (data-slot="room-host-end")
 *
 * ## Who decides
 *
 * The host's `useRoom` holds the room. A player's `send` travels as an
 * intent; the host applies it only if the model allows it (no joining a
 * locked room, one answer a round, only the host starts) and sends the new
 * state to everyone, with `seq` so an old message never overwrites a new
 * one. A refused intent comes back to that player through `onRejected`.
 *
 * ## Time
 *
 * Deadlines are timestamps from the host's clock. Pass `now` (yours, minus
 * a measured offset) where phones' clocks drift; the countdown and the host
 * controls then agree to the second. Timing uses `setTimeout` to the next
 * whole second, never a frame loop.
 *
 * ## Motion
 *
 * A player's chip pops in when they join (scale only, 240ms);
 * each countdown number lands with a short scale (400ms). Under reduced
 * motion both are simply there. The words carry everything: joins and the
 * countdown are announced, sparsely.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `section` / `div` props                              |
 * | R6   | data-slot per part        | room-lobby-*, room-countdown-*, room-host-*          |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R8   | Enums, not booleans       | `size`                                               |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R25  | Client component          | the room runs in the browser                         |
 * | R26  | A11y                      | list of players; sparse live announcements; timer role |
 */

import * as React from 'react';
import { Lock, LockOpen, X } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import {
  answerProgress,
  applyRoomEvent,
  connectedPlayers,
  rejectRoomEvent,
  type RoomEvent,
  type RoomHostEvent,
  type RoomPlayer,
  type RoomRejection,
  type RoomSettings,
  type RoomState,
  type RoomTransport,
} from './room-model.js';

export const MIN_VIEWPORT = 320 as const;

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

// --- useRoom --------------------------------------------------------------------

export interface UseRoomOptions {
  /** How messages travel. null while connecting. */
  transport: RoomTransport | null;
  /** This client's id: the host's id for the host, the player's id for a player. */
  selfId: string;
  /** The room to start from, on the host only. Present = this client is the host. */
  host?: RoomState;
  /** A player only: accept states for this room code only. */
  code?: string;
  settings?: RoomSettings;
  /** A player's intent (or the host's own event) was refused. */
  onRejected?: (reason: RoomRejection, event: RoomEvent['type']) => void;
  /** The host's clock, which stamps each answer as it arrives. @default Date.now */
  now?: () => number;
}

export interface UseRoomResult {
  /** The room as this client knows it. null on a player until the host answers. */
  room: RoomState | null;
  isHost: boolean;
  /** Apply (host) or ask the host to apply (player). */
  send: (event: RoomEvent) => void;
}

export function useRoom({
  transport,
  selfId,
  host,
  code,
  settings,
  onRejected,
  now = Date.now,
}: UseRoomOptions): UseRoomResult {
  const isHost = host !== undefined;
  const [room, setRoom] = React.useState<RoomState | null>(host ?? null);
  const roomRef = React.useRef<RoomState | null>(host ?? null);
  const latest = React.useRef({ settings, onRejected, code, now });
  latest.current = { settings, onRejected, code, now };

  const apply = React.useCallback(
    (event: RoomEvent, from: string) => {
      const current = roomRef.current;
      if (!current) return;
      const reason = rejectRoomEvent(current, event, from, latest.current.settings);
      if (reason) {
        if (from === selfId) latest.current.onRejected?.(reason, event.type);
        else
          transport?.send({
            kind: 'rejected',
            to: from,
            event: event.type,
            reason,
          });
        return;
      }
      const next = applyRoomEvent(current, event, from, latest.current.settings);
      roomRef.current = next;
      setRoom(next);
      transport?.send({ kind: 'state', state: next });
    },
    [transport, selfId],
  );

  React.useEffect(() => {
    if (!transport) return;
    const off = transport.subscribe((message) => {
      if (isHost) {
        if (message.kind === 'intent') {
          // The host's clock decides when an answer arrived, never the sender's.
          const event = message.event;
          apply(event.type === 'answer' ? { ...event, at: latest.current.now() } : event, message.from);
        } else if (message.kind === 'hello' && roomRef.current)
          transport.send({ kind: 'state', state: roomRef.current });
        return;
      }
      if (message.kind === 'state') {
        const current = roomRef.current;
        const want = latest.current.code;
        if (want && message.state.code !== want) return;
        if (current && current.code === message.state.code && message.state.seq <= current.seq) return;
        roomRef.current = message.state;
        setRoom(message.state);
      } else if (message.kind === 'rejected' && message.to === selfId) {
        latest.current.onRejected?.(message.reason, message.event);
      }
    });
    if (isHost) {
      if (roomRef.current) transport.send({ kind: 'state', state: roomRef.current });
    } else {
      transport.send({ kind: 'hello', from: selfId });
    }
    return off;
  }, [transport, isHost, selfId, apply]);

  const send = React.useCallback(
    (event: RoomEvent) => {
      if (isHost) apply(event, selfId);
      else transport?.send({ kind: 'intent', from: selfId, event });
    },
    [isHost, apply, selfId, transport],
  );

  return { room, isHost, send };
}

/**
 * Whole seconds until `target` (a timestamp in ms), re-rendering at each
 * second boundary with `setTimeout`. null when there is no target.
 */
export function useSecondsLeft(target: number | null, now: () => number = Date.now): number | null {
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  const left = target === null ? null : Math.max(0, Math.ceil((target - now()) / 1000));
  React.useEffect(() => {
    if (target === null) return;
    const ms = target - now();
    if (ms <= 0) return;
    const t = setTimeout(tick, ms % 1000 || 1000);
    return () => clearTimeout(t);
  });
  return left;
}

// --- RoomLobby ------------------------------------------------------------------

export interface RoomLobbyLabels {
  /** The heading. @default (n) => n === 1 ? '1 player' : `${n} players` */
  count?: (n: number) => string;
  /** @default 'Waiting for players to join.' */
  empty?: string;
  /** On the viewer's own chip. @default 'You' */
  you?: string;
  /** On a player who dropped out. @default 'away' */
  away?: string;
  /** @default (name) => `Remove ${name}` */
  remove?: (name: string) => string;
  /** @default (names) => names.length === 1 ? `${names[0]} joined` : `${names.length} players joined` */
  joined?: (names: string[]) => string;
  /** A player's view, where the host controls would be. @default 'You are in. Waiting for the host to start.' */
  waiting?: string;
  /** Names the player list. @default 'Players' */
  list?: string;
}

/**
 * The lobby is a landmark named by its player count. With more than one lobby
 * on a page (a host screen beside a preview), give each its own `aria-label`,
 * which then names the landmark instead.
 */
type RoomLobbyProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  players: readonly RoomPlayer[];
  /** The viewer's id, to mark their chip. */
  selfId?: string;
  /** Your JoinCode (or any way in), shown beside the players. */
  join?: React.ReactNode;
  /** Host controls. Leave out on a player's screen to show `labels.waiting`. */
  actions?: React.ReactNode;
  /** Shows a remove button on each chip (host only). */
  onRemove?: (playerId: string) => void;
  /** Hide players who dropped out. @default false */
  hideAway?: boolean;
  labels?: RoomLobbyLabels;
};

const COUNT = (n: number) => (n === 1 ? '1 player' : `${n} players`);
const JOINED = (names: string[]) => (names.length === 1 ? `${names[0]} joined` : `${names.length} players joined`);

function RoomLobby({
  players,
  selfId,
  join,
  actions,
  onRemove,
  hideAway = false,
  labels,
  className,
  ...props
}: RoomLobbyProps) {
  const reduced = useReducedMotion();
  const listRef = React.useRef<HTMLUListElement>(null);
  const seen = React.useRef<Set<string> | null>(null);
  const [announce, setAnnounce] = React.useState('');
  const shown = hideAway ? players.filter((p) => p.connected) : players;
  const live = players.filter((p) => p.connected).length;
  const headingId = React.useId();

  React.useEffect(() => {
    const ids = new Set(players.map((p) => p.id));
    const before = seen.current;
    seen.current = ids;
    if (!before) return; // first render: no entrance, no announcement
    const fresh = players.filter((p) => !before.has(p.id));
    if (!fresh.length) return;
    setAnnounce((labels?.joined ?? JOINED)(fresh.map((p) => p.name)));
    if (reduced) return;
    const freshIds = new Set(fresh.map((p) => p.id));
    const chips = listRef.current?.querySelectorAll<HTMLElement>('[data-player-id]') ?? [];
    for (const el of chips) {
      if (!freshIds.has(el.dataset.playerId ?? '')) continue;
      if (typeof el.animate === 'function') {
        el.animate(
          // Scale only: a fading name would dip below text contrast mid-entrance.
          [{ transform: 'scale(0.6)' }, { transform: 'scale(1)' }],
          { duration: 240, easing: EASE },
        );
      }
    }
  }, [players, reduced, labels]);

  return (
    <section
      data-slot="room-lobby"
      data-count={live}
      data-min-viewport={String(MIN_VIEWPORT)}
      aria-labelledby={props['aria-label'] ? undefined : headingId}
      className={cn('@container', className)}
      {...props}
    >
      <div className={cn('grid gap-8', join && '@3xl:grid-cols-[2fr_3fr] @3xl:items-start')}>
        {join ? <div data-slot="room-lobby-join">{join}</div> : null}
        <div className="flex min-w-0 flex-col gap-4">
          <h2 id={headingId} data-slot="room-lobby-count" className="text-2xl font-semibold tabular-nums">
            {(labels?.count ?? COUNT)(live)}
          </h2>
          {shown.length ? (
            <ul
              ref={listRef}
              data-slot="room-lobby-players"
              aria-label={labels?.list ?? 'Players'}
              className="flex flex-wrap gap-2"
            >
              {shown.map((p) => {
                const self = p.id === selfId;
                return (
                  <li
                    key={p.id}
                    data-slot="room-lobby-player"
                    data-player-id={p.id}
                    data-self={self ? '' : undefined}
                    data-away={p.connected ? undefined : ''}
                    className={cn(
                      'bg-card text-card-foreground inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border py-1.5 ps-3.5 text-sm font-medium',
                      onRemove ? 'pe-1' : 'pe-3.5',
                      self ? 'border-primary' : 'border-border',
                      !p.connected && 'text-muted-foreground border-dashed',
                    )}
                  >
                    <span className="truncate">{p.name}</span>
                    {self ? (
                      <span className="text-primary shrink-0 text-xs font-semibold">{labels?.you ?? 'You'}</span>
                    ) : null}
                    {!p.connected ? <span className="shrink-0 text-xs">{labels?.away ?? 'away'}</span> : null}
                    {onRemove && !self ? (
                      <Button
                        data-slot="room-lobby-remove"
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="rounded-full"
                        aria-label={(labels?.remove ?? ((n: string) => `Remove ${n}`))(p.name)}
                        onClick={() => onRemove(p.id)}
                      >
                        <X aria-hidden />
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p data-slot="room-lobby-empty" className="text-muted-foreground">
              {labels?.empty ?? 'Waiting for players to join.'}
            </p>
          )}
          <div data-slot="room-lobby-actions" className="pt-2">
            {actions ?? (
              <p className="text-muted-foreground">{labels?.waiting ?? 'You are in. Waiting for the host to start.'}</p>
            )}
          </div>
        </div>
      </div>
      <span data-slot="room-lobby-announce" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </section>
  );
}
RoomLobby.displayName = 'RoomLobby';

// --- RoomCountdown --------------------------------------------------------------

export interface RoomCountdownLabels {
  /** Names the timer. @default 'Starting in' */
  name?: string;
  /** Spoken once, when the countdown appears. @default (s) => `Starting in ${s} seconds` */
  starting?: (seconds: number) => string;
  /** Shown and spoken at 0. @default 'Go' */
  go?: string;
}

type RoomCountdownProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** When it reaches 0, in ms (host clock). null: idle. */
  startsAt: number | null;
  /** Your clock, corrected to the host's. @default Date.now */
  now?: () => number;
  /** Called once at 0. */
  onDone?: () => void;
  /** @default 'default' */
  size?: 'default' | 'stage';
  labels?: RoomCountdownLabels;
};

const COUNTDOWN_SIZE = {
  default: 'size-28 text-5xl',
  stage: 'size-44 text-7xl',
} as const;

function RoomCountdown({
  startsAt,
  now = Date.now,
  onDone,
  size = 'default',
  labels,
  className,
  ...props
}: RoomCountdownProps) {
  const reduced = useReducedMotion();
  const left = useSecondsLeft(startsAt, now);
  const valueRef = React.useRef<HTMLSpanElement>(null);
  const done = left === 0;
  const fired = React.useRef<number | null>(null);
  const [announce, setAnnounce] = React.useState('');
  const go = labels?.go ?? 'Go';
  const latest = React.useRef(onDone);
  latest.current = onDone;

  // Speak once on arrival and once at 0, never every second. The deps are
  // `startsAt` alone on purpose: a new `now` or `labels` must not re-announce
  // mid-countdown.
  React.useEffect(() => {
    if (startsAt === null) return;
    const s = Math.max(0, Math.ceil((startsAt - now()) / 1000));
    if (s > 0) setAnnounce((labels?.starting ?? ((n: number) => `Starting in ${n} seconds`))(s));
  }, [startsAt]);

  React.useEffect(() => {
    if (!done || startsAt === null || fired.current === startsAt) return;
    fired.current = startsAt;
    setAnnounce(go);
    latest.current?.();
  }, [done, startsAt, go]);

  React.useEffect(() => {
    if (left === null || reduced) return;
    const el = valueRef.current;
    if (!el || typeof el.animate !== 'function') return;
    el.animate(
      // Scale only, like the chips: a fading number would dip below text contrast.
      [{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }],
      { duration: 400, easing: EASE },
    );
  }, [left, reduced]);

  return (
    <div
      role="timer"
      aria-label={labels?.name ?? 'Starting in'}
      data-slot="room-countdown"
      data-state={startsAt === null ? 'idle' : done ? 'done' : 'running'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        'border-primary text-foreground grid place-items-center rounded-full border-4 font-semibold tabular-nums',
        done && 'bg-primary text-primary-foreground',
        COUNTDOWN_SIZE[size],
        className,
      )}
      {...props}
    >
      <span ref={valueRef} data-slot="room-countdown-value" className={cn('leading-none', done && 'text-[0.6em]')}>
        {left === null ? '' : done ? go : left}
      </span>
      <span data-slot="room-countdown-announce" aria-live="assertive" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
RoomCountdown.displayName = 'RoomCountdown';

// --- RoomHostControls -----------------------------------------------------------

export interface RoomHostControlsLabels {
  /** @default 'Host controls' */
  group?: string;
  /** @default 'Start' */
  start?: string;
  /** @default (min, n) => `Needs ${min} players to start. ${n} so far.` */
  needMore?: (min: number, players: number) => string;
  /** @default (n) => n === 1 ? '1 player is in.' : `${n} players are in.` */
  ready?: (players: number) => string;
  /** @default 'Starting…' */
  starting?: string;
  /** @default (a, t) => `${a} of ${t} answered` */
  answered?: (answered: number, total: number) => string;
  /** @default 'Reveal now' */
  reveal?: string;
  /** @default (round, rounds) => rounds ? `Round ${round} of ${rounds}` : `Round ${round}` */
  round?: (round: number, rounds: number | null) => string;
  /** @default 'Next round' */
  next?: string;
  /** @default 'Show the podium' */
  podium?: string;
  /** @default 'Play again' */
  restart?: string;
  /** @default 'Lock the room' */
  lock?: string;
  /** @default 'Unlock the room' */
  unlock?: string;
  /** @default 'End the game' */
  end?: string;
  /** @default 'The game has ended.' */
  closed?: string;
}

type RoomHostControlsProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  room: RoomState;
  /** `send` from the host's `useRoom`. */
  send: (event: RoomHostEvent) => void;
  /** Players needed to start. @default 1 */
  minPlayers?: number;
  /** Seconds of countdown before each round. @default 3 */
  countdownSeconds?: number;
  /** Seconds per round, or null for no clock. @default 20 */
  roundSeconds?: number | null;
  /** Points per player id for the round being revealed. @default () => ({}) */
  score?: (room: RoomState) => Record<string, number>;
  /**
   * Move on by itself: open the round when the countdown ends, reveal when
   * the clock runs out or everyone has answered. @default true
   */
  autoAdvance?: boolean;
  /** @default Date.now */
  now?: () => number;
  labels?: RoomHostControlsLabels;
};

const NO_POINTS = () => ({});

function RoomHostControls({
  room,
  send,
  minPlayers = 1,
  countdownSeconds = 3,
  roundSeconds = 20,
  score = NO_POINTS,
  autoAdvance = true,
  now = Date.now,
  labels,
  className,
  ...props
}: RoomHostControlsProps) {
  const L = labels ?? {};
  const live = connectedPlayers(room).length;
  const { answered, total } = answerProgress(room);
  const latest = React.useRef({ send, score, now, roundSeconds });
  latest.current = { send, score, now, roundSeconds };

  const openRound = React.useCallback(() => {
    const { send: s, now: n, roundSeconds: r } = latest.current;
    s({ type: 'question', endsAt: r === null ? null : n() + r * 1000 });
  }, []);
  const reveal = React.useCallback(() => {
    latest.current.send({ type: 'reveal', points: latest.current.score(room) });
  }, [room]);

  // Countdown over → open the round. Clock out or all in → reveal.
  React.useEffect(() => {
    if (!autoAdvance) return;
    const n = latest.current.now;
    if (room.phase === 'countdown' && room.startsAt !== null) {
      const t = setTimeout(openRound, Math.max(0, room.startsAt - n()));
      return () => clearTimeout(t);
    }
    if (room.phase === 'question') {
      if (total > 0 && answered >= total) {
        const t = setTimeout(reveal, 600);
        return () => clearTimeout(t);
      }
      if (room.endsAt !== null) {
        const t = setTimeout(reveal, Math.max(0, room.endsAt - n()));
        return () => clearTimeout(t);
      }
    }
    return undefined;
  }, [autoAdvance, room.phase, room.startsAt, room.endsAt, answered, total, openRound, reveal]);

  const countdown = () => send({ type: 'countdown', startsAt: now() + countdownSeconds * 1000 });
  const last = room.rounds !== null && room.round >= room.rounds;

  let status: string;
  let primary: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  } | null = null;
  switch (room.phase) {
    case 'lobby':
      status =
        live < minPlayers
          ? (L.needMore ?? ((m: number, n: number) => `Needs ${m} players to start. ${n} so far.`))(minPlayers, live)
          : (L.ready ?? ((n: number) => (n === 1 ? '1 player is in.' : `${n} players are in.`)))(live);
      primary = {
        label: L.start ?? 'Start',
        onClick: countdown,
        disabled: live < minPlayers,
      };
      break;
    case 'countdown':
      status = L.starting ?? 'Starting…';
      break;
    case 'question':
      status = (L.answered ?? ((a: number, t: number) => `${a} of ${t} answered`))(answered, total);
      primary = { label: L.reveal ?? 'Reveal now', onClick: reveal };
      break;
    case 'reveal':
      status = (L.round ?? ((r: number, rs: number | null) => (rs ? `Round ${r} of ${rs}` : `Round ${r}`)))(
        room.round,
        room.rounds,
      );
      primary = last
        ? {
            label: L.podium ?? 'Show the podium',
            onClick: () => send({ type: 'podium' }),
          }
        : { label: L.next ?? 'Next round', onClick: countdown };
      break;
    case 'podium':
      status = (L.round ?? ((r: number, rs: number | null) => (rs ? `Round ${r} of ${rs}` : `Round ${r}`)))(
        room.round,
        room.rounds,
      );
      primary = {
        label: L.restart ?? 'Play again',
        onClick: () => send({ type: 'restart' }),
      };
      break;
    default:
      status = L.closed ?? 'The game has ended.';
  }

  return (
    <div
      role="group"
      aria-label={L.group ?? 'Host controls'}
      data-slot="room-host-controls"
      data-phase={room.phase}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex flex-wrap items-center gap-3', className)}
      {...props}
    >
      <p
        data-slot="room-host-status"
        aria-live="polite"
        className="text-muted-foreground basis-full text-sm tabular-nums"
      >
        {status}
      </p>
      {primary ? (
        <Button
          data-slot="room-host-primary"
          type="button"
          size="lg"
          disabled={primary.disabled}
          onClick={primary.onClick}
        >
          {primary.label}
        </Button>
      ) : null}
      {room.phase !== 'closed' ? (
        <>
          <Button
            data-slot="room-host-lock"
            type="button"
            variant="outline"
            onClick={() => send({ type: 'lock', locked: !room.locked })}
          >
            {room.locked ? <Lock aria-hidden /> : <LockOpen aria-hidden />}
            {room.locked ? (L.unlock ?? 'Unlock the room') : (L.lock ?? 'Lock the room')}
          </Button>
          <Button data-slot="room-host-end" type="button" variant="ghost" onClick={() => send({ type: 'close' })}>
            {L.end ?? 'End the game'}
          </Button>
        </>
      ) : null}
    </div>
  );
}
RoomHostControls.displayName = 'RoomHostControls';

export { RoomLobby, RoomCountdown, RoomHostControls };
export type { RoomLobbyProps, RoomCountdownProps, RoomHostControlsProps };
