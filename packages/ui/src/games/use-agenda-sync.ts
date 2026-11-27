'use client';

/**
 * @interlace/ui — useAgendaSync
 *
 * Keeps one agenda right across a presenter's windows and a refresh, for `Agenda` and `AgendaNow`
 * (the rules and the messages are `games/agenda-sync-model`). One window controls: it holds the
 * agenda, applies events with its own clock, and tells every other window after each change. Any
 * number of second screens show it, and their buttons send intents the controlling window applies
 * once. Nothing here reaches the audience: the notes travel only between the presenter's own
 * windows (`createBroadcastRoomTransport<AgendaMessage>('agenda')` for two windows on one device).
 *
 * ```tsx
 * const sync = useAgendaSync({ transport, initial: { items, state: createAgenda() } });
 * <Agenda items={sync.items} state={sync.state} onEvent={sync.send} now={sync.now} />
 * ```
 *
 * A second screen passes no `initial`; `state` is null until the controlling window answers.
 * Without a transport a presenter alone on one screen still works.
 */

import * as React from 'react';

import { applyAgendaEvent, type AgendaEvent, type AgendaItem, type AgendaState } from './agenda-model.js';
import {
  acceptIntent,
  isAgendaEvent,
  readSnapshot,
  stampEvent,
  type AgendaMessage,
  type AgendaSnapshot,
} from './agenda-sync-model.js';
import { clockOffset, type RoomTransport } from './room-model.js';

export interface UseAgendaSyncOptions {
  /** How the windows talk. null while connecting, or for one window alone. */
  transport: RoomTransport<AgendaMessage> | null;
  /** The agenda to control from. Present: this window controls. Absent: it shows what the controlling window sends. */
  initial?: { items: readonly AgendaItem[]; state: AgendaState; seq?: number };
  /** This window's clock. The controlling window's clock times everything. @default Date.now */
  now?: () => number;
  /** The controlling window's agenda changed: keep it (see `createAgendaStore`). */
  onChange?: (agenda: AgendaSnapshot) => void;
}

export interface UseAgendaSyncResult {
  /** The items, as this window knows them. Empty on a second screen until the controlling window answers. */
  items: readonly AgendaItem[];
  /** The state, as this window knows it. null on a second screen until the controlling window answers. */
  state: AgendaState | null;
  /** True in the controlling window. */
  controls: boolean;
  /** Apply (controlling window) or ask the controlling window to apply (second screen). Pass it as `onEvent`. */
  send: (event: AgendaEvent) => void;
  /** This window's clock, corrected to the controlling window's: pass it as `now`. */
  now: () => number;
}

const OFFSET_WINDOW_MS = 60_000;
const REMEMBER_INTENTS = 200;
let counter = 0;
/** A unique id for a window's run or a tap: a UUID where the browser has one, else the time and a count. */
const uid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${(counter++).toString(36)}`;

const NONE: readonly AgendaItem[] = [];

export function useAgendaSync({ transport, initial, now = Date.now, onChange }: UseAgendaSyncOptions): UseAgendaSyncResult {
  const controls = initial !== undefined;
  const start: AgendaSnapshot | null = initial
    ? { items: [...initial.items], state: initial.state, seq: initial.seq ?? 0 }
    : null;
  const [held, setHeld] = React.useState<AgendaSnapshot | null>(start);
  const ref = React.useRef<AgendaSnapshot | null>(start);
  const latest = React.useRef({ now, onChange });
  latest.current = { now, onChange };
  const session = React.useRef(uid());
  const heldSession = React.useRef<string | null>(null);
  const applied = React.useRef<Set<string>>(new Set());
  const samples = React.useRef<{ at: number; local: number }[]>([]);
  const offset = React.useRef(0);

  const tell = React.useCallback(() => {
    const current = ref.current;
    if (!current || !transport) return;
    transport.send({
      kind: 'agenda-state',
      items: current.items,
      state: current.state,
      seq: current.seq,
      at: latest.current.now(),
      session: session.current,
    });
  }, [transport]);

  const apply = React.useCallback(
    (event: AgendaEvent) => {
      const current = ref.current;
      if (!current) return;
      const state = applyAgendaEvent(current.items, current.state, stampEvent(event, latest.current.now()));
      if (state === current.state) return;
      const next = { ...current, state, seq: current.seq + 1 };
      ref.current = next;
      setHeld(next);
      latest.current.onChange?.(next);
      tell();
    },
    [tell],
  );

  React.useEffect(() => {
    if (!transport) return;
    const off = transport.subscribe((message) => {
      if (controls) {
        if (message.kind === 'agenda-hello') tell();
        else if (message.kind === 'agenda-intent') {
          const current = ref.current;
          if (!current || typeof message.id !== 'string' || !isAgendaEvent(message.event)) return;
          if (acceptIntent(current.seq, message, applied.current)) {
            applied.current.add(message.id);
            if (applied.current.size > REMEMBER_INTENTS) applied.current.delete(applied.current.values().next().value as string);
            apply(message.event);
          } else if (!applied.current.has(message.id)) tell(); // made against an older screen: bring it up to date
        }
        return;
      }
      if (message.kind !== 'agenda-state') return;
      const snapshot = readSnapshot(message);
      if (!snapshot) return;
      const local = Date.now();
      samples.current = [...samples.current.filter((s) => local - s.local < OFFSET_WINDOW_MS), { at: message.at, local }];
      offset.current = clockOffset(samples.current);
      const current = ref.current;
      // A new run of the controlling window is followed whatever its seq; within one run only a newer state counts.
      if (current && heldSession.current === message.session && snapshot.seq <= current.seq) return;
      heldSession.current = message.session;
      ref.current = snapshot;
      setHeld(snapshot);
    });
    if (controls) tell();
    else transport.send({ kind: 'agenda-hello' });
    return off;
  }, [transport, controls, apply, tell]);

  const send = React.useCallback(
    (event: AgendaEvent) => {
      if (controls) return apply(event);
      const current = ref.current;
      if (current && transport) transport.send({ kind: 'agenda-intent', id: uid(), seq: current.seq, event });
    },
    [controls, apply, transport],
  );

  const corrected = React.useCallback(() => (controls ? latest.current.now() : Date.now() + offset.current), [controls]);
  return { items: held?.items ?? NONE, state: held?.state ?? null, controls, send, now: corrected };
}
