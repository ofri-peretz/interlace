'use client';

/**
 * @interlace/ui — PairHost, PairCard
 *
 * Pair talk for a live room: the host pairs everyone (a group of three when the room is odd), each
 * pair gets a prompt card and a timer, and "swap partners" pairs everyone again with someone new.
 * Each phone shows who its partner is, the card and the time left. The rules are
 * `games/pair-model`; the state rides in the room (`RoomState.shared`), so a phone that joins late
 * or reconnects shows its partner and card at once.
 *
 * ## States
 *
 * | State   | Host screen (PairHost)                                | Phone (PairCard)                      | Leaves by              |
 * | ------- | ----------------------------------------------------- | ------------------------------------- | ---------------------- |
 * | none    | minutes, "Start pairing"                              | nothing                               | Start → paired         |
 * | paired  | round, timer, Swap partners, +1 min, every pair, card | partner, card, time left              | Swap → paired, Stop → none |
 *
 * ## Anatomy
 *
 *   PairHost                       (section — data-slot="pair-host", data-state=none|paired)
 *     ├─ div                       (data-slot="pair-host-setup": minutes, start)
 *     ├─ div                       (data-slot="pair-host-bar": round, RoomClock, swap, +1 min, stop)
 *     ├─ ul > li × n               (data-slot="pair-host-pair": names, the card, "new card")
 *     └─ span aria-live            (data-slot="pair-host-announce")
 *
 *   PairCard                       (section — data-slot="pair-card", data-state=paired|waiting)
 *     ├─ div role="status"         (data-slot="pair-card-live": round, partner, the card)
 *     └─ RoomClock                 (the time left)
 *
 * ## Screen readers
 *
 * The phone's partner and card sit in one status region, so a swap is read once ("Round 2. Your
 * partner is Dana. Card: …") and nothing is read while the clock runs; the clock speaks only a
 * minute and ten seconds before the end, and at the end.
 *
 * ## Motion
 *
 * A new card gives its box one small scale pulse (transform only, 240ms). Under reduced motion it
 * simply appears.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `section` props                                      |
 * | R6   | data-slot per part        | pair-host-*, pair-card-*                             |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R25  | Client component          | reacts to the room                                   |
 * | R26  | A11y                      | labelled controls; one status region                 |
 */

import * as React from 'react';

import { motionEase } from '../lib/motion-token.js';
import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { RoomClock, type RoomClockLabels } from './room-clock.js';
import { connectedPlayers, type RoomHostEvent, type RoomState } from './room-model.js';
import type { Random } from './group-model.js';
import {
  extendPairs,
  newCard,
  pairsEvent,
  partnerOf,
  placeNewcomers,
  readPairs,
  startPairs,
  swapPartners,
  type PairsState,
} from './pair-model.js';

export const MIN_VIEWPORT = 320 as const;

const SELECT =
  'border-input bg-background text-foreground h-control-sm max-w-full min-w-0 rounded-lg border ps-2 pe-1 text-sm focus-visible:outline-hidden focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** The minutes the host can choose from; 0 is no timer. */
const MINUTES = [0, 1, 2, 3, 5, 10] as const;

/** "Dana", "Dana and Eli", "Dana, Eli and Sam": names in a list, in the page's language. */
function list(names: readonly string[]): string {
  return new Intl.ListFormat(undefined, { type: 'conjunction' }).format(names);
}

// --- PairHost -------------------------------------------------------------------

export interface PairHostLabels {
  /** @default 'Pair talk' */
  name?: string;
  /** @default 'Time for each round' */
  time?: string;
  /** @default (m) => m === 0 ? 'No timer' : m === 1 ? '1 minute' : `${m} minutes` */
  minutes?: (minutes: number) => string;
  /** @default 'Start pairing' */
  start?: string;
  /** Before any pairs. @default 'Pair everyone up. Each pair gets a card to talk about.' */
  empty?: string;
  /** @default 'Needs at least 2 players.' */
  needMore?: string;
  /** @default (round) => `Round ${round}` */
  round?: (round: number) => string;
  /** @default 'Swap partners' */
  swap?: string;
  /** @default 'Add 1 minute' */
  extend?: string;
  /** @default 'Stop pair talk' */
  stop?: string;
  /** @default (names) => `New card for ${names}` */
  newCard?: (names: string) => string;
  /** The new-card button's visible text. @default 'New card' */
  newCardText?: string;
  /** @default 'away' */
  away?: string;
  /** Spoken after a swap. @default (round, pairs) => `Partners swapped. Round ${round}, ${pairs} pairs.` */
  swapped?: (round: number, pairs: number) => string;
  /** Shown when a lone player waits. @default 'Waiting for a partner' */
  alone?: string;
  clock?: RoomClockLabels;
}

type PairHostProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  room: RoomState;
  /** `send` from the host's `useRoom`. */
  send: (event: RoomHostEvent) => void;
  /** The cards to talk about, one per pair, dealt from a shuffled deck. */
  prompts: readonly string[];
  /** Minutes to offer first; 0 for no timer. @default 5 */
  defaultMinutes?: number;
  /** Pair up a player who joins after the pairing. @default true */
  autoPlace?: boolean;
  /** Your clock, which sets the timer. For a host that is `useRoom`'s `now`. @default Date.now */
  now?: () => number;
  /** @default Math.random */
  random?: Random;
  labels?: PairHostLabels;
};

function PairHost({
  room,
  send,
  prompts,
  defaultMinutes = 5,
  autoPlace = true,
  now = Date.now,
  random,
  labels,
  className,
  ...props
}: PairHostProps) {
  const L = labels ?? {};
  const state = readPairs(room);
  const [minutes, setMinutes] = React.useState(defaultMinutes);
  const [announce, setAnnounce] = React.useState('');
  const timeId = React.useId();
  const latest = React.useRef({ send, now, random, prompts });
  latest.current = { send, now, random, prompts };

  const write = React.useCallback((next: PairsState | null) => latest.current.send(pairsEvent(next)), []);
  const live = connectedPlayers(room);
  const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name ?? id;

  // Someone who joined after the pairing, or came back to it, is paired too. Players who are away are left out.
  React.useEffect(() => {
    if (!autoPlace || !state) return;
    const next = placeNewcomers(state, connectedPlayers(room), latest.current.random);
    if (next !== state) write(next);
  }, [autoPlace, state, room.players, write]);

  const options = () => ({
    now: latest.current.now(),
    seconds: minutes === 0 ? null : minutes * 60,
    random: latest.current.random,
  });

  const swap = () => {
    if (!state) return;
    const next = swapPartners(state, live, options());
    if (!next) return;
    write(next);
    setAnnounce((L.swapped ?? ((r: number, n: number) => `Partners swapped. Round ${r}, ${n} pairs.`))(next.round, next.pairs.length));
  };

  return (
    <section
      aria-label={L.name ?? 'Pair talk'}
      data-slot="pair-host"
      data-state={state ? 'paired' : 'none'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container flex flex-col gap-5', className)}
      {...props}
    >
      {state ? (
        <div data-slot="pair-host-bar" className="flex flex-wrap items-center gap-3">
          <p data-slot="pair-host-round" className="text-lg font-semibold tabular-nums">
            {(L.round ?? ((r: number) => `Round ${r}`))(state.round)}
          </p>
          <RoomClock endsAt={state.endsAt} now={now} labels={L.clock} />
          <Button data-slot="pair-host-swap" type="button" onClick={swap} disabled={live.length < 1}>
            {L.swap ?? 'Swap partners'}
          </Button>
          <Button
            data-slot="pair-host-extend"
            type="button"
            variant="outline"
            onClick={() => write(extendPairs(state, 60, latest.current.now()))}
          >
            {L.extend ?? 'Add 1 minute'}
          </Button>
          <Button data-slot="pair-host-stop" type="button" variant="ghost" onClick={() => write(null)}>
            {L.stop ?? 'Stop pair talk'}
          </Button>
        </div>
      ) : (
        <div data-slot="pair-host-setup" className="flex flex-wrap items-end gap-3">
          <p className="text-muted-foreground basis-full text-sm">
            {L.empty ?? 'Pair everyone up. Each pair gets a card to talk about.'}
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={timeId} className="text-sm font-medium">
              {L.time ?? 'Time for each round'}
            </label>
            <select
              id={timeId}
              data-slot="pair-host-minutes"
              className={SELECT}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {(L.minutes ?? ((n: number) => (n === 0 ? 'No timer' : n === 1 ? '1 minute' : `${n} minutes`)))(m)}
                </option>
              ))}
            </select>
          </div>
          <Button
            data-slot="pair-host-start"
            type="button"
            disabled={live.length < 2}
            onClick={() => {
              const next = startPairs(live, latest.current.prompts, options());
              if (next) write(next);
            }}
          >
            {L.start ?? 'Start pairing'}
          </Button>
          {live.length < 2 ? <p className="text-muted-foreground text-sm">{L.needMore ?? 'Needs at least 2 players.'}</p> : null}
        </div>
      )}

      {state ? (
        <ul data-slot="pair-host-pairs" className="grid list-none gap-4 p-0 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {state.pairs.map((pair) => {
            const names = list(pair.members.map(nameOf));
            return (
              <li
                key={pair.id}
                data-slot="pair-host-pair"
                data-pair-id={pair.id}
                data-size={pair.members.length}
                className="bg-card text-card-foreground border-border flex min-w-0 flex-col gap-2 rounded-xl border p-4"
              >
                <p className="font-semibold break-words">
                  {pair.members.length === 1 ? `${names} · ${L.alone ?? 'Waiting for a partner'}` : names}
                  {pair.members.some((m) => room.players.find((p) => p.id === m)?.connected === false) ? (
                    <span className="text-muted-foreground ms-1.5 text-xs font-normal">{L.away ?? 'away'}</span>
                  ) : null}
                </p>
                {pair.prompt ? <p className="text-muted-foreground text-sm break-words">{pair.prompt}</p> : null}
                {state.deck.length ? (
                  <Button
                    data-slot="pair-host-newcard"
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    aria-label={(L.newCard ?? ((n: string) => `New card for ${n}`))(names)}
                    onClick={() => write(newCard(state, pair.id, latest.current.random))}
                  >
                    {L.newCardText ?? 'New card'}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <span data-slot="pair-host-announce" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </section>
  );
}
PairHost.displayName = 'PairHost';

// --- PairCard -------------------------------------------------------------------

export interface PairCardLabels {
  /** Names the card. The host's screen is 'Pair talk', so the two are distinct landmarks when a page shows both. @default 'Your pair' */
  name?: string;
  /** @default (round) => `Round ${round}` */
  round?: (round: number) => string;
  /** @default (names) => `Your partner is ${names}` */
  partner?: (names: string) => string;
  /** For a group of three. @default (names) => `Your group is ${names}` */
  group?: (names: string) => string;
  /** When no partner is here yet. @default 'Waiting for a partner' */
  waiting?: string;
  /** @default 'Card' */
  card?: string;
  /** @default 'away' */
  away?: string;
  /** Said in place of the time at 0. @default 'Time is up. Wait for the host.' */
  timeUp?: string;
  clock?: RoomClockLabels;
}

type PairCardProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  room: Pick<RoomState, 'shared' | 'players'> | null;
  /** The viewer's player id. */
  selfId: string;
  /** Your clock, corrected to the host's (`useRoom`'s `now`). @default Date.now */
  now?: () => number;
  labels?: PairCardLabels;
};

function PairCard({ room, selfId, now = Date.now, labels, className, ...props }: PairCardProps) {
  const L = labels ?? {};
  const reduced = useReducedMotion();
  const state = readPairs(room);
  const found = state ? partnerOf(state, selfId) : null;
  const boxRef = React.useRef<HTMLDivElement>(null);
  const seen = React.useRef<string | null>(null);

  // One small pulse when the round or the card changes, never on the first look.
  const key = found ? `${state?.round}:${found.pair.prompt}` : null;
  React.useEffect(() => {
    const before = seen.current;
    seen.current = key;
    if (before === null || key === null || before === key || reduced) return;
    const el = boxRef.current;
    if (el && typeof el.animate === 'function') el.animate([{ transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 240, easing: motionEase(el, 'enter') });
  }, [key, reduced]);

  if (!state) return null;
  const people = (found?.partners ?? []).map((id) => room?.players.find((p) => p.id === id));
  const names = list(people.map((p, i) => p?.name ?? found?.partners[i] ?? ''));
  const away = people.some((p) => p && !p.connected);

  return (
    <section
      aria-label={L.name ?? 'Your pair'}
      data-slot="pair-card"
      data-state={found && found.partners.length ? 'paired' : 'waiting'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('bg-card text-card-foreground border-border flex flex-col gap-4 rounded-2xl border p-5', className)}
      {...props}
    >
      <div ref={boxRef} role="status" data-slot="pair-card-live" className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm font-semibold tabular-nums">{(L.round ?? ((r: number) => `Round ${r}`))(state.round)}</p>
        {found && found.partners.length ? (
          <h2 data-slot="pair-card-partner" className="text-xl font-semibold break-words">
            {(found.partners.length > 1 ? (L.group ?? ((n: string) => `Your group is ${n}`)) : (L.partner ?? ((n: string) => `Your partner is ${n}`)))(names)}
            {away ? <span className="text-muted-foreground ms-2 text-sm font-normal">{L.away ?? 'away'}</span> : null}
          </h2>
        ) : (
          <h2 data-slot="pair-card-partner" className="text-muted-foreground text-xl font-semibold">
            {L.waiting ?? 'Waiting for a partner'}
          </h2>
        )}
        {found?.pair.prompt ? (
          <div data-slot="pair-card-prompt" className="bg-muted text-foreground rounded-xl p-4">
            <p className="text-muted-foreground mb-1 text-xs font-semibold">{L.card ?? 'Card'}</p>
            <p className="text-lg break-words">{found.pair.prompt}</p>
          </div>
        ) : null}
      </div>
      <RoomClock endsAt={state.endsAt} now={now} labels={{ done: L.timeUp ?? 'Time is up. Wait for the host.', ...L.clock }} />
    </section>
  );
}
PairCard.displayName = 'PairCard';

export { PairCard, PairHost };
export type { PairCardProps, PairHostProps };
