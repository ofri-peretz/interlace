/**
 * @interlace/ui — games/share-model
 *
 * The text a player shares after a daily game: how they did, without the
 * answers. One mark per round (a band, not a number), the score, the streak
 * and a link. Pure, so the same text can be built on a server for an
 * Open Graph card.
 *
 *   Sample game No. 42
 *   🟩🟨🎯 240/300
 *   🔥 6
 *   https://example.com/play
 *
 * `note` adds one line of news ("7-day streak") after the marks; a share
 * with no rounds (a milestone) keeps an empty marks line, so the news
 * stands apart from the title.
 *
 * ## Marks
 *
 * `symbols` maps each result key to the character that stands for it. The
 * defaults cover the Closer bands (`exact`, `close`, `near`, `far`) and
 * plain `right` / `wrong`; a game with its own keys passes its own map. An
 * unknown key falls back to `fallback` (a white square), so a typo never
 * prints the word.
 */

export const DEFAULT_SYMBOLS: Readonly<Record<string, string>> = {
  exact: '🎯',
  close: '🟩',
  near: '🟨',
  far: '⬜',
  right: '🟩',
  wrong: '⬜',
};

export interface ShareTextInput {
  /** The game's name. */
  title: string;
  /** Today's puzzle number. */
  number?: number;
  /** One key per round, in order (`'close'`, `'right'`, …). */
  results: readonly string[];
  /** Points scored, and out of how many. */
  score?: number;
  maxScore?: number;
  /** One line of news after the marks, for a milestone ("7-day streak", "Level 5"). */
  note?: string;
  /** Current streak; left out when 0 or missing. */
  streak?: number;
  url?: string;
  symbols?: Readonly<Record<string, string>>;
  /** For an unknown key. @default '⬜' */
  fallback?: string;
  /** @default n => `No. ${n}` */
  numberLabel?: (n: number) => string;
  /** @default '🔥' */
  streakSymbol?: string;
}

/** The marks for a run of results, one character per round. */
export function shareMarks(
  results: readonly string[],
  symbols: Readonly<Record<string, string>> = DEFAULT_SYMBOLS,
  fallback = '⬜',
): string {
  return results.map((r) => symbols[r] ?? fallback).join('');
}

/** The full share text, one fact per line. */
export function shareText(input: ShareTextInput): string {
  const head =
    input.number === undefined
      ? input.title
      : `${input.title} ${(input.numberLabel ?? ((n: number) => `No. ${n}`))(input.number)}`;
  const marks = shareMarks(input.results, input.symbols, input.fallback);
  const score =
    input.score === undefined ? '' : input.maxScore === undefined ? ` ${input.score}` : ` ${input.score}/${input.maxScore}`;
  const lines = [head, `${marks}${score}`.trimStart()];
  if (input.note) lines.push(input.note);
  if (input.streak) lines.push(`${input.streakSymbol ?? '🔥'} ${input.streak}`);
  if (input.url) lines.push(input.url);
  return lines.join('\n');
}
