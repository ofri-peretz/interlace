/**
 * @interlace/ui — games/quiz-model
 *
 * Scoring for a multiple-choice question, with an optional clock. Pure, so a
 * server can score the same answer and a share card can show right or wrong
 * without the answer itself.
 *
 * ## Points
 *
 * A right answer is worth `maxPoints`. When the question was timed, part of
 * that (`speedShare`, half by default) depends on speed: answering at once
 * keeps all of it, answering as the clock runs out keeps none of it. A wrong
 * answer, or no answer before time ran out, is worth 0.
 *
 * A question with no time limit is worth the full `maxPoints`. When a timed
 * question's clock was stopped (a player can always stop it; see QuizQuestion)
 * the answer keeps the part that does not depend on speed, so stopping the
 * clock is always available and never pays more than racing it.
 */

export type QuizOutcome = 'correct' | 'wrong' | 'timeout';

export interface QuizScoreOptions {
  /** Points for a right answer given at once. @default 1000 */
  maxPoints?: number;
  /** Share of the points that depends on speed, 0–1. @default 0.5 */
  speedShare?: number;
}

export interface QuizAnswerInput {
  /** The chosen option's id; null when time ran out first. */
  choice: string | null;
  /** Milliseconds from the start to the answer. Leave out when the clock was stopped. */
  elapsedMs?: number;
  /** The question's time limit in milliseconds. Leave out for an untimed question. */
  limitMs?: number;
}

export interface QuizResult {
  choice: string | null;
  correct: string;
  outcome: QuizOutcome;
  points: number;
  /** Whether the answer raced a running clock (the speed share was in play). */
  timed: boolean;
  elapsedMs?: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Score one answer against the right option's id. */
export function scoreAnswer(input: QuizAnswerInput, correct: string, options: QuizScoreOptions = {}): QuizResult {
  const { maxPoints = 1000 } = options;
  const speedShare = clamp01(options.speedShare ?? 0.5);
  const { choice, elapsedMs, limitMs } = input;
  const limited = typeof limitMs === 'number' && limitMs > 0;
  const timed = limited && typeof elapsedMs === 'number' && Number.isFinite(elapsedMs);
  const outcome: QuizOutcome = choice === null ? 'timeout' : choice === correct ? 'correct' : 'wrong';
  let points = 0;
  if (outcome === 'correct') {
    const base = limited ? maxPoints * (1 - speedShare) : maxPoints;
    const speed = timed ? maxPoints * speedShare * (1 - clamp01((elapsedMs as number) / (limitMs as number))) : 0;
    points = Math.round(base + speed);
  }
  return { choice, correct, outcome, points, timed, ...(timed ? { elapsedMs } : {}) };
}
