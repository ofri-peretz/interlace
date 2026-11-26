/**
 * @interlace/ui — reactions-model
 *
 * Two small room states a host owns: live reactions (taps that float up on a
 * shared screen) and raised hands (a fair queue of who wants to speak).
 * Pure, so the host and a server agree on who was first and on what got
 * through.
 *
 * ## Reactions
 *
 * A tap is cheap to send and a crowd taps fast, so every person gets a
 * budget: `perWindow` reactions in any `windowMs` (default 6 in 3 seconds).
 * `allowReaction` says yes or no and returns the new budget state; a screen
 * shows only what was allowed. `tallyReactions` counts by kind, for a
 * recap or for the reduced-motion view.
 *
 * ## Raised hands
 *
 * First raised, first called. Lowering a hand and raising it again goes to
 * the back of the line. `call` takes the first hand (or a named one) off the
 * queue and remembers it as `speaking`.
 */

// --- Reactions --------------------------------------------------------------------

export interface ReactionLimitOptions {
  /** Reactions one person may send in a window. @default 6 */
  perWindow?: number;
  /** The window, in ms. @default 3000 */
  windowMs?: number;
}

/** Recent reaction times per person. */
export type ReactionBudget = Readonly<Record<string, readonly number[]>>;

export function allowReaction(
  budget: ReactionBudget,
  by: string,
  at: number,
  options: ReactionLimitOptions = {},
): { ok: boolean; budget: ReactionBudget } {
  const { perWindow = 6, windowMs = 3000 } = options;
  const recent = (budget[by] ?? []).filter((t) => at - t < windowMs);
  if (recent.length >= perWindow) return { ok: false, budget: { ...budget, [by]: recent } };
  return { ok: true, budget: { ...budget, [by]: [...recent, at] } };
}

/** Counts per kind, in the order the kinds are listed. */
export function tallyReactions(
  kinds: readonly string[],
  reactions: readonly { kind: string }[],
): { kind: string; count: number }[] {
  const counts = new Map(kinds.map((k) => [k, 0]));
  for (const r of reactions) if (counts.has(r.kind)) counts.set(r.kind, (counts.get(r.kind) as number) + 1);
  return kinds.map((kind) => ({ kind, count: counts.get(kind) as number }));
}

// --- Raised hands -----------------------------------------------------------------

export interface RaisedHand {
  by: string;
  /** The name to show the host. */
  name: string;
  /** When it went up, in ms (host clock). */
  at: number;
}

export interface HandState {
  /** First raised first. */
  hands: RaisedHand[];
  /** The last person called on, until the next call or `done`. */
  speaking: RaisedHand | null;
}

export type HandEvent =
  | { type: 'raise'; by: string; name: string; at: number }
  | { type: 'lower'; by: string }
  /**
   * Calls on `by`, or the first in line when left out. Resolve the first in
   * line on the host and send `by` over the wire, so a call delivered twice
   * calls one person, not two.
   */
  | { type: 'call'; by?: string }
  /** The speaker is finished. */
  | { type: 'done' }
  | { type: 'clear' };

export function createHands(): HandState {
  return { hands: [], speaking: null };
}

/** Applies one event. Events that change nothing return the same state. */
export function applyHandEvent(state: HandState, event: HandEvent): HandState {
  switch (event.type) {
    case 'raise':
      if (state.hands.some((h) => h.by === event.by)) return state;
      return { ...state, hands: [...state.hands, { by: event.by, name: event.name, at: event.at }] };
    case 'lower':
      if (!state.hands.some((h) => h.by === event.by)) return state;
      return { ...state, hands: state.hands.filter((h) => h.by !== event.by) };
    case 'call': {
      const hand = event.by === undefined ? state.hands[0] : state.hands.find((h) => h.by === event.by);
      if (!hand) return state;
      return { hands: state.hands.filter((h) => h !== hand), speaking: hand };
    }
    case 'done':
      return state.speaking ? { ...state, speaking: null } : state;
    case 'clear':
      return createHands();
  }
}

/** 1 for first in line, or null when this person's hand is down. */
export function placeInLine(state: HandState, by: string): number | null {
  const i = state.hands.findIndex((h) => h.by === by);
  return i === -1 ? null : i + 1;
}
