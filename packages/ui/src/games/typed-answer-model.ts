/**
 * @interlace/ui — typed-answer-model
 *
 * A quiz round where people type the answer instead of picking it. The
 * hard part is fairness: "Tel-Aviv", "tel aviv" and "Tel Aviv." are the
 * same answer, and a slip of one letter in a long word should still count,
 * while a different number never does ("1948" is not "1949").
 *
 * `normalizeAnswer` folds case, accents and punctuation and collapses
 * spaces. `matchAnswer` compares against every accepted answer: an exact
 * match after folding, or one within a small number of edits that grows
 * with the answer's length (none up to 4 letters, 1 up to 8, then 2).
 * Answers with digits must match exactly. `scoreTyped` scores with the same
 * clock rules as a multiple-choice question (`scoreAnswer`), so the two
 * kinds of round can share a leaderboard. `groupTyped` counts what the room
 * typed, folded together, for the reveal.
 */

import { scoreAnswer, type QuizResult, type QuizScoreOptions } from './quiz-model.js';

export type TypedOutcome = 'exact' | 'close' | 'wrong' | 'empty';

export interface TypedMatch {
  outcome: TypedOutcome;
  /** The accepted answer it matched, as written, or null. */
  matched: string | null;
  /** Edits from the nearest accepted answer, after folding. */
  distance: number;
}

export interface TypedRules {
  /** 'exact' turns typo tolerance off. @default 'close' */
  tolerance?: 'exact' | 'close';
  /** Words to ignore anywhere, e.g. ['the', 'a'] for English. @default [] */
  ignore?: readonly string[];
}

/** Folds case, accents and punctuation; keeps letters, digits, and a point or comma between digits. */
export function normalizeAnswer(text: string, ignore: readonly string[] = []): string {
  const folded = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/(?<=\d)[.,](?=\d)/g, '\uE000')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\uE000/g, '.');
  const skip = new Set(ignore.map((w) => normalizeAnswer(w)));
  return folded
    .split(/\s+/)
    .filter((w) => w && !skip.has(w))
    .join(' ');
}

/** Edits (insert, delete, change, swap two neighbours) between two strings, stopping past `max`. */
export function editDistance(a: string, b: string, max = Infinity): number {
  const s = [...a];
  const t = [...b];
  if (Math.abs(s.length - t.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let d = Math.min((prev[j] as number) + 1, (row[j - 1] as number) + 1, (prev[j - 1] as number) + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        d = Math.min(d, (prev2[j - 2] as number) + 1);
      }
      row[j] = d;
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[t.length] as number;
}

/** Edits allowed for an accepted answer of this folded length. */
export function allowedEdits(folded: string): number {
  if (/\d/.test(folded)) return 0;
  const n = [...folded.replace(/\s/g, '')].length;
  return n <= 4 ? 0 : n <= 8 ? 1 : 2;
}

export function matchAnswer(text: string, accepted: readonly string[], rules: TypedRules = {}): TypedMatch {
  const { tolerance = 'close', ignore = [] } = rules;
  const typed = normalizeAnswer(text, ignore);
  if (!typed) return { outcome: 'empty', matched: null, distance: Infinity };
  let best: TypedMatch = { outcome: 'wrong', matched: null, distance: Infinity };
  for (const answer of accepted) {
    const target = normalizeAnswer(answer, ignore);
    if (!target) continue;
    const limit = tolerance === 'exact' ? 0 : allowedEdits(target);
    const d = editDistance(typed, target, Math.max(limit, 2));
    if (d === 0) return { outcome: 'exact', matched: answer, distance: 0 };
    if (d <= limit && d < best.distance) best = { outcome: 'close', matched: answer, distance: d };
    else if (best.outcome === 'wrong' && d < best.distance) best = { ...best, distance: d };
  }
  return best;
}

export interface TypedResult extends QuizResult {
  /** What was typed; null when time ran out first. */
  text: string | null;
  match: TypedMatch;
}

/** Scores a typed answer with the quiz clock rules. An empty answer counts as no answer. */
export function scoreTyped(
  input: { text: string | null; elapsedMs?: number; limitMs?: number },
  accepted: readonly string[],
  options: QuizScoreOptions & TypedRules = {},
): TypedResult {
  const match: TypedMatch =
    input.text === null
      ? { outcome: 'empty', matched: null, distance: Infinity }
      : matchAnswer(input.text, accepted, options);
  const choice = match.outcome === 'empty' ? null : match.outcome === 'wrong' ? 'wrong' : 'right';
  const scored = scoreAnswer({ choice, elapsedMs: input.elapsedMs, limitMs: input.limitMs }, 'right', options);
  return { ...scored, text: input.text, match };
}

export interface TypedGroup {
  /** The first way it was written. */
  text: string;
  count: number;
  correct: boolean;
}

/** What the room typed, folded together, most common first; right answers fold into one row. */
export function groupTyped(
  texts: readonly string[],
  accepted: readonly string[],
  rules: TypedRules = {},
): TypedGroup[] {
  const groups = new Map<string, TypedGroup & { first: number }>();
  texts.forEach((text, i) => {
    if (typeof text !== 'string') return;
    const m = matchAnswer(text, accepted, rules);
    if (m.outcome === 'empty') return;
    const right = m.outcome !== 'wrong';
    // A right answer matched something, so there is a first accepted answer to name the row.
    const main = accepted[0] as string;
    const key = right ? `\uE000${main}` : normalizeAnswer(text, rules.ignore);
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { text: right ? main : text.trim(), count: 1, correct: right, first: i });
  });
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .map(({ text, count, correct }) => ({ text, count, correct }));
}
