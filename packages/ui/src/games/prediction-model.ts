/**
 * @interlace/ui — prediction-model
 *
 * "Who will win?": everyone calls an outcome before it happens (the next
 * round, a vote, a guess about the room itself), the host settles it, and
 * whoever called it scores. Calling it is about reading the room, so the
 * room's spread is shown only after the outcome.
 *
 * `settlePredictions` takes picks keyed by person, so a message delivered
 * twice, or late, changes nothing. A pick for an option that does not
 * exist is dropped. With `reward: 'bold'` a call few people made pays more
 * than one everybody made: up to twice the points for a call only you
 * made, the base points for one the whole room made.
 */

export type PredictionReward = 'flat' | 'bold';

export interface PredictionOptions {
  /** Points for a right call. @default 500 */
  points?: number;
  /** `bold` pays a rare right call more. @default 'flat' */
  reward?: PredictionReward;
}

export interface PredictionResult {
  /** Picks per option id, every option present. */
  counts: Record<string, number>;
  /** Valid picks. */
  total: number;
  /** The outcome, when it is one of the options; otherwise null and nobody scores. */
  outcome: string | null;
  /** People who called it, sorted. */
  winners: string[];
  /** Share of the room that called it, 0 to 1. */
  share: number;
  /** Points per person who made a valid pick: the points for a right call, 0 otherwise. */
  points: Record<string, number>;
}

/** Points one right call earns, given the share of the room that made it. */
export function predictionPoints(share: number, options: PredictionOptions = {}): number {
  const { points = 500, reward = 'flat' } = options;
  const base = Number.isFinite(points) && points > 0 ? points : 0;
  if (reward === 'flat') return Math.round(base);
  const s = Number.isFinite(share) ? Math.min(1, Math.max(0, share)) : 1;
  return Math.round(base * (2 - s));
}

export function settlePredictions(
  picks: Readonly<Record<string, string>>,
  optionIds: readonly string[],
  outcome: string | null | undefined,
  options: PredictionOptions = {},
): PredictionResult {
  const known = new Set(optionIds);
  const counts: Record<string, number> = Object.fromEntries(optionIds.map((id) => [id, 0]));
  const valid = Object.entries(picks).filter(([, pick]) => known.has(pick));
  for (const [, pick] of valid) counts[pick] = (counts[pick] as number) + 1;
  const total = valid.length;
  const settled = outcome != null && known.has(outcome) ? outcome : null;
  const winners = settled === null ? [] : valid.filter(([, pick]) => pick === settled).map(([by]) => by);
  winners.sort();
  const share = total > 0 ? winners.length / total : 0;
  const award = predictionPoints(share, options);
  const points: Record<string, number> = Object.fromEntries(
    valid.map(([by, pick]) => [by, settled !== null && pick === settled ? award : 0]),
  );
  return { counts, total, outcome: settled, winners, share, points };
}
