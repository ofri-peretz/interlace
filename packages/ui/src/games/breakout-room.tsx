'use client';

/**
 * @interlace/ui — BreakoutHost, BreakoutCard
 *
 * Breakouts for a live room: the host splits the room into groups with a timer, sends one message
 * to every group, and calls everyone back; each phone shows its group, who is in it, the time left
 * and the latest message. The rules are `games/breakout-model`; the state rides in the room
 * (`RoomState.shared`), so a phone that joins late or reconnects shows its group at once and no
 * message can put an old state back.
 *
 * ## States
 *
 * | State    | Host screen (BreakoutHost)                          | Phone (BreakoutCard)                     | Leaves by                   |
 * | -------- | --------------------------------------------------- | ---------------------------------------- | --------------------------- |
 * | none     | group count, minutes, "Open breakouts"              | nothing                                  | Open → open                 |
 * | open     | timer, +2 min, message to all, groups, Recall       | your group, members, time, last message  | Recall → recalled           |
 * | recalled | "Everyone is back", Send out again, Close           | "Back in the main room"                  | Send out again → open       |
 *
 * ## Anatomy
 *
 *   BreakoutHost                   (section — data-slot="breakout-host", data-state=none|open|recalled)
 *     ├─ div                       (data-slot="breakout-host-setup": groups, minutes, open)
 *     ├─ RoomClock + buttons       (data-slot="breakout-host-bar": time left, +2 min, recall)
 *     ├─ form                      (data-slot="breakout-host-message": textarea + send)
 *     ├─ ul > li × n               (data-slot="breakout-host-group": members, each with a move select)
 *     └─ span aria-live            (data-slot="breakout-host-announce")
 *
 *   BreakoutCard                   (section — data-slot="breakout-card", data-state=open|recalled|waiting)
 *     ├─ h2                        (data-slot="breakout-card-group": "You are in Group 2")
 *     ├─ ul                        (data-slot="breakout-card-members")
 *     ├─ RoomClock                 (the time left)
 *     └─ div role="status"         (data-slot="breakout-card-message": the latest message from the host)
 *
 * ## Messages are spoken once
 *
 * A message has a count; the phone keeps the highest it has seen in this session and shows (and so
 * speaks) a message only when it is newer. The same state arriving twice, or an older one arriving
 * late, changes nothing on screen and says nothing.
 *
 * ## Motion
 *
 * A new message gives its box one small scale pulse (transform only, 240ms). Under reduced motion
 * it simply appears.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `section` props                                      |
 * | R6   | data-slot per part        | breakout-host-*, breakout-card-*                     |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R25  | Client component          | reacts to the room                                   |
 * | R26  | A11y                      | labelled form and selects; status regions            |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { Textarea } from '../primitives/textarea.js';
import { RoomClock, type RoomClockLabels } from './room-clock.js';
import { connectedPlayers, type RoomHostEvent, type RoomPlayer, type RoomState } from './room-model.js';
import type { Random } from './group-model.js';
import {
  breakoutsEvent,
  broadcast,
  extendBreakouts,
  groupMembers,
  groupOf,
  MAX_GROUPS,
  MAX_MESSAGE,
  moveToGroup,
  openBreakouts,
  placeNewcomers,
  readBreakouts,
  recallBreakouts,
  reopenBreakouts,
  type BreakoutMessage,
  type BreakoutsState,
} from './breakout-model.js';

export const MIN_VIEWPORT = 320 as const;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

const SELECT =
  'border-input bg-background text-foreground h-control-sm max-w-full min-w-0 rounded-lg border ps-2 pe-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** The minutes the host can choose from; 0 is no timer. */
const MINUTES = [0, 2, 5, 10, 15, 20, 30] as const;

// --- BreakoutHost ---------------------------------------------------------------

export interface BreakoutHostLabels {
  /** @default 'Breakouts' */
  name?: string;
  /** @default 'Number of groups' */
  groups?: string;
  /** @default 'Time for each group' */
  time?: string;
  /** @default (m) => m === 0 ? 'No timer' : `${m} minutes` */
  minutes?: (minutes: number) => string;
  /** @default 'Open breakouts' */
  open?: string;
  /** Before any breakouts. @default 'Split the room into groups. People move to their group on their phone.' */
  empty?: string;
  /** @default 'Add 2 minutes' */
  extend?: string;
  /** @default 'Bring everyone back' */
  recall?: string;
  /** @default 'Message to every group' */
  message?: string;
  /** @default 'Send to all groups' */
  send?: string;
  /** @default (left) => `${left} characters left` */
  remaining?: (left: number) => string;
  /** @default (n) => `Message sent to ${n} groups` */
  sent?: (groups: number) => string;
  /** @default (message) => `Last message: ${message}` */
  last?: (message: string) => string;
  /** @default 'Everyone is back in the main room.' */
  recalled?: string;
  /** @default 'Send them out again' */
  again?: string;
  /** @default 'Close breakouts' */
  close?: string;
  /** @default (n) => n === 1 ? '1 person' : `${n} people` */
  size?: (n: number) => string;
  /** @default (player) => `Move ${player} to` */
  move?: (player: string) => string;
  /** @default 'away' */
  away?: string;
  /** Names the timer. @default 'Time left' */
  clock?: RoomClockLabels;
}

type BreakoutHostProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  room: RoomState;
  /** `send` from the host's `useRoom`. */
  send: (event: RoomHostEvent) => void;
  /** Groups to offer first. @default 3 */
  defaultGroups?: number;
  /** Minutes to offer first; 0 for no timer. @default 10 */
  defaultMinutes?: number;
  /** Put a player who joins after the split in the smallest group. @default true */
  autoPlace?: boolean;
  /** Your clock, which sets the timer. For a host that is `useRoom`'s `now`. @default Date.now */
  now?: () => number;
  /** @default Math.random */
  random?: Random;
  labels?: BreakoutHostLabels;
};

const PEOPLE = (n: number) => (n === 1 ? '1 person' : `${n} people`);

function BreakoutHost({
  room,
  send,
  defaultGroups = 3,
  defaultMinutes = 10,
  autoPlace = true,
  now = Date.now,
  random,
  labels,
  className,
  ...props
}: BreakoutHostProps) {
  const L = labels ?? {};
  const state = readBreakouts(room);
  const [groups, setGroups] = React.useState(() => Math.min(MAX_GROUPS, Math.max(1, defaultGroups)));
  const [minutes, setMinutes] = React.useState(defaultMinutes);
  const [draft, setDraft] = React.useState('');
  const [announce, setAnnounce] = React.useState('');
  const ids = { groups: React.useId(), time: React.useId(), message: React.useId(), hint: React.useId() };
  const latest = React.useRef({ send, now, random });
  latest.current = { send, now, random };

  const write = React.useCallback((next: BreakoutsState | null) => latest.current.send(breakoutsEvent(next)), []);

  // Someone who joined after the split, or came back to it, goes to the smallest group. Players who are away wait.
  React.useEffect(() => {
    if (!autoPlace || !state) return;
    const next = placeNewcomers(state, connectedPlayers(room));
    if (next !== state) write(next);
  }, [autoPlace, state, room.players, write]);

  const open = () => {
    const next = openBreakouts(connectedPlayers(room), {
      groups,
      seconds: minutes === 0 ? null : minutes * 60,
      now: latest.current.now(),
      random: latest.current.random,
    });
    if (next) write(next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state) return;
    const next = broadcast(state, draft, latest.current.now());
    if (next === state) return;
    write(next);
    setDraft('');
    setAnnounce((L.sent ?? ((n: number) => `Message sent to ${n} groups`))(state.groups.length));
  };

  const left = MAX_MESSAGE - Array.from(draft).length;

  return (
    <section
      aria-label={L.name ?? 'Breakouts'}
      data-slot="breakout-host"
      data-state={state ? state.status : 'none'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container flex flex-col gap-5', className)}
      {...props}
    >
      {state ? null : (
        <div data-slot="breakout-host-setup" className="flex flex-wrap items-end gap-3">
          <p className="text-muted-foreground basis-full text-sm">
            {L.empty ?? 'Split the room into groups. People move to their group on their phone.'}
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.groups} className="text-sm font-medium">
              {L.groups ?? 'Number of groups'}
            </label>
            <select
              id={ids.groups}
              data-slot="breakout-host-groups"
              className={SELECT}
              value={groups}
              onChange={(e) => setGroups(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.time} className="text-sm font-medium">
              {L.time ?? 'Time for each group'}
            </label>
            <select
              id={ids.time}
              data-slot="breakout-host-minutes"
              className={SELECT}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {(L.minutes ?? ((n: number) => (n === 0 ? 'No timer' : `${n} minutes`)))(m)}
                </option>
              ))}
            </select>
          </div>
          <Button data-slot="breakout-host-open" type="button" onClick={open} disabled={!connectedPlayers(room).length}>
            {L.open ?? 'Open breakouts'}
          </Button>
        </div>
      )}

      {state?.status === 'open' ? (
        <>
          <div data-slot="breakout-host-bar" className="flex flex-wrap items-center gap-3">
            <RoomClock endsAt={state.endsAt} now={now} labels={L.clock} />
            <Button
              data-slot="breakout-host-extend"
              type="button"
              variant="outline"
              onClick={() => write(extendBreakouts(state, 120, latest.current.now()))}
            >
              {L.extend ?? 'Add 2 minutes'}
            </Button>
            <Button
              data-slot="breakout-host-recall"
              type="button"
              onClick={() => write(recallBreakouts(state, latest.current.now()))}
            >
              {L.recall ?? 'Bring everyone back'}
            </Button>
          </div>
          <form data-slot="breakout-host-message" onSubmit={submit} className="flex flex-col gap-2">
            <label htmlFor={ids.message} className="text-sm font-medium">
              {L.message ?? 'Message to every group'}
            </label>
            <Textarea
              id={ids.message}
              value={draft}
              size="sm"
              maxLength={MAX_MESSAGE}
              aria-describedby={ids.hint}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span id={ids.hint} className="text-muted-foreground text-xs tabular-nums">
                {(L.remaining ?? ((n: number) => `${n} characters left`))(left)}
              </span>
              <Button data-slot="breakout-host-send" type="submit" variant="outline" disabled={!draft.trim()}>
                {L.send ?? 'Send to all groups'}
              </Button>
            </div>
            {state.message ? (
              <p data-slot="breakout-host-last" className="text-muted-foreground text-sm break-words">
                {(L.last ?? ((m: string) => `Last message: ${m}`))(state.message.text)}
              </p>
            ) : null}
          </form>
        </>
      ) : null}

      {state?.status === 'recalled' ? (
        <div data-slot="breakout-host-bar" className="flex flex-wrap items-center gap-3">
          <p className="font-medium">{L.recalled ?? 'Everyone is back in the main room.'}</p>
          <Button
            data-slot="breakout-host-again"
            type="button"
            onClick={() => write(reopenBreakouts(state, latest.current.now(), minutes === 0 ? null : minutes * 60))}
          >
            {L.again ?? 'Send them out again'}
          </Button>
          <Button data-slot="breakout-host-close" type="button" variant="ghost" onClick={() => write(null)}>
            {L.close ?? 'Close breakouts'}
          </Button>
        </div>
      ) : null}

      {state ? (
        <ul data-slot="breakout-host-groups-list" className="grid list-none gap-4 p-0 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {state.groups.map((group) => {
            const people = groupMembers(state, group.id, room.players);
            return (
              <li
                key={group.id}
                data-slot="breakout-host-group"
                data-group-id={group.id}
                className="bg-card text-card-foreground border-border flex min-w-0 flex-col gap-2 rounded-xl border p-4"
              >
                <h3 className="truncate font-semibold">{group.name}</h3>
                <p className="text-muted-foreground text-xs tabular-nums">{(L.size ?? PEOPLE)(people.length)}</p>
                <ul className="flex list-none flex-col gap-1.5 p-0">
                  {people.map((p) => (
                    <GroupMember
                      key={p.id}
                      player={p}
                      state={state}
                      labels={L}
                      onMove={(to) => write(moveToGroup(state, p.id, to))}
                    />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : null}

      <span data-slot="breakout-host-announce" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </section>
  );
}
BreakoutHost.displayName = 'BreakoutHost';

function GroupMember({
  player,
  state,
  labels,
  onMove,
}: {
  player: RoomPlayer;
  state: BreakoutsState;
  labels: BreakoutHostLabels;
  onMove: (groupId: string) => void;
}) {
  return (
    <li data-slot="breakout-host-member" data-player-id={player.id} className="flex min-w-0 items-center justify-between gap-2">
      <span className={cn('min-w-0 truncate text-sm', !player.connected && 'text-muted-foreground')}>
        {player.name}
        {player.connected ? null : <span className="ms-1.5 text-xs">{labels.away ?? 'away'}</span>}
      </span>
      <select
        data-slot="breakout-host-move"
        aria-label={(labels.move ?? ((n: string) => `Move ${n} to`))(player.name)}
        className={SELECT}
        value={groupOf(state, player.id)?.id ?? ''}
        onChange={(e) => onMove(e.target.value)}
      >
        {state.groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </li>
  );
}

// --- BreakoutCard ---------------------------------------------------------------

export interface BreakoutCardLabels {
  /** @default (group) => `You are in ${group}` */
  in?: (group: string) => string;
  /** Before the host has placed this player. @default 'Finding your group…' */
  waiting?: string;
  /** @default 'In your group' */
  members?: string;
  /** On the viewer's own name. @default 'You' */
  you?: string;
  /** @default 'away' */
  away?: string;
  /** Heads the host's message. @default 'Message from the host' */
  message?: string;
  /** Said in place of the time at 0. @default 'Time is up. Wait for the host.' */
  timeUp?: string;
  /** @default 'Back in the main room' */
  recalled?: string;
  /** @default 'The host has called everyone back. Look at the main screen.' */
  recalledHelp?: string;
  clock?: RoomClockLabels;
}

type BreakoutCardProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  room: Pick<RoomState, 'shared' | 'players'> | null;
  /** The viewer's player id. */
  selfId: string;
  /** Your clock, corrected to the host's (`useRoom`'s `now`). @default Date.now */
  now?: () => number;
  labels?: BreakoutCardLabels;
};

/**
 * The newest message this phone has seen in this session of breakouts. A state that carries an
 * older message (late) or none (a state from before it) does not replace it; a new session or a
 * recall does.
 */
function useNewestMessage(state: BreakoutsState | null): BreakoutMessage | null {
  const [held, setHeld] = React.useState<{ session: number | null; message: BreakoutMessage | null }>({
    session: null,
    message: null,
  });
  const session = state?.startedAt ?? null;
  let next = held;
  if (state?.status !== 'open' || held.session !== session) next = { session, message: null };
  const incoming = state?.message ?? null;
  if (state?.status === 'open' && incoming && incoming.n > (next.message?.n ?? 0)) next = { session, message: incoming };
  if (next.session !== held.session || next.message !== held.message) setHeld(next);
  return next.message;
}

function BreakoutCard({ room, selfId, now = Date.now, labels, className, ...props }: BreakoutCardProps) {
  const L = labels ?? {};
  const reduced = useReducedMotion();
  const state = readBreakouts(room);
  const message = useNewestMessage(state);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const seen = React.useRef<number | null>(null);

  // One small pulse when a newer message arrives, never on the first look.
  const n = message?.n ?? 0;
  React.useEffect(() => {
    const before = seen.current;
    seen.current = n;
    if (before === null || n <= before || reduced) return;
    const el = boxRef.current;
    if (el && typeof el.animate === 'function') el.animate([{ transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 240, easing: EASE });
  }, [n, reduced]);

  if (!state) return null;
  const mine = groupOf(state, selfId);
  const people = mine ? groupMembers(state, mine.id, room?.players ?? []) : [];
  const phase = state.status === 'recalled' ? 'recalled' : mine ? 'open' : 'waiting';

  return (
    <section
      aria-label={mine ? mine.name : (L.waiting ?? 'Finding your group…')}
      data-slot="breakout-card"
      data-state={phase}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('bg-card text-card-foreground border-border flex flex-col gap-4 rounded-2xl border p-5', className)}
      {...props}
    >
      {phase === 'recalled' ? (
        <div role="status" aria-live="assertive" data-slot="breakout-card-recalled" className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">{L.recalled ?? 'Back in the main room'}</h2>
          <p className="text-muted-foreground">{L.recalledHelp ?? 'The host has called everyone back. Look at the main screen.'}</p>
        </div>
      ) : null}

      {phase === 'waiting' ? (
        <p data-slot="breakout-card-waiting" role="status" className="text-muted-foreground">
          {L.waiting ?? 'Finding your group…'}
        </p>
      ) : null}

      {phase === 'open' && mine ? (
        <>
          <h2 data-slot="breakout-card-group" className="text-xl font-semibold break-words">
            {(L.in ?? ((g: string) => `You are in ${g}`))(mine.name)}
          </h2>
          <div className="flex items-center gap-3">
            <RoomClock endsAt={state.endsAt} now={now} labels={{ done: L.timeUp ?? 'Time is up. Wait for the host.', ...L.clock }} />
          </div>
          <div ref={boxRef} role="status" data-slot="breakout-card-message" data-empty={message ? undefined : ''} className={cn(message && 'bg-muted text-foreground rounded-xl p-4')}>
            {message ? (
              <>
                <p className="text-muted-foreground mb-1 text-xs font-semibold">{L.message ?? 'Message from the host'}</p>
                <p className="text-lg break-words whitespace-pre-line">{message.text}</p>
              </>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-sm font-semibold">{L.members ?? 'In your group'}</h3>
            <ul data-slot="breakout-card-members" className="flex list-none flex-wrap gap-2 p-0">
              {people.map((p) => (
                <li
                  key={p.id}
                  data-self={p.id === selfId ? '' : undefined}
                  data-away={p.connected ? undefined : ''}
                  className={cn(
                    'bg-background inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-sm',
                    p.id === selfId ? 'border-primary font-semibold' : 'border-border',
                    !p.connected && 'text-muted-foreground border-dashed',
                  )}
                >
                  <span className="truncate">{p.name}</span>
                  {p.id === selfId ? <span className="text-primary text-xs">{L.you ?? 'You'}</span> : null}
                  {p.connected ? null : <span className="text-xs">{L.away ?? 'away'}</span>}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </section>
  );
}
BreakoutCard.displayName = 'BreakoutCard';

export { BreakoutCard, BreakoutHost };
export type { BreakoutCardProps, BreakoutHostProps };
