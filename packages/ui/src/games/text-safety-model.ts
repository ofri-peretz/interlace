/**
 * @interlace/ui — text-safety-model
 *
 * The checks a short piece of typed text passes before a room shows it on a
 * shared screen: a word for a word cloud, a question for a Q&A board, a line
 * for an open wall. Pure, so the phone that sends it and the server that
 * receives it run the same rules and agree on the reason.
 *
 * ## What it checks, in order
 *
 *   1. empty            nothing left after trimming
 *   2. too-long         more than `maxLength` characters (counted as the reader sees them)
 *   3. contact          an email address or a phone number
 *   4. link             a URL or a bare domain
 *   5. blocked          a word on the consumer's `blocklist`
 *   6. too-many-words   more than `maxWords` words
 *
 * `blocked` comes before the word count, so "b a d" is refused for what it
 * says, not for having three words.
 *
 * Interlace ships no word list of its own: what is unwelcome depends on the
 * room, its language and its audience, so the consumer passes one. Matching
 * runs on `foldText`, which lowercases, strips accents and marks, folds the
 * common letter swaps (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s) and joins
 * letters spelled out with spaces or dots ("b a d" → "bad"), so the usual
 * dodges do not get through. Whole words only: a blocked word inside a
 * longer, innocent word is not a match.
 *
 * A filter is one layer, never the only one. Rooms that show typed text to
 * a crowd should also hold it for review (see `question-board-model`).
 */

export type TextRefusal = 'empty' | 'too-long' | 'too-many-words' | 'link' | 'contact' | 'blocked';

export interface TextRules {
  /** The most characters, as the reader counts them. @default 200 */
  maxLength?: number;
  /** The most words. @default Infinity */
  maxWords?: number;
  /** Words the room refuses. Matched whole, after `foldText`. */
  blocklist?: readonly string[];
  /** Let links through. @default false */
  allowLinks?: boolean;
  /** Let email addresses and phone numbers through. @default false */
  allowContact?: boolean;
}

export type TextCheck = { ok: true; text: string } | { ok: false; reason: TextRefusal };

const SWAPS: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

/** Trims, collapses runs of white space and applies Unicode NFC, so the same word typed twice is the same string. */
export function tidyText(input: string): string {
  return input.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

/** How many characters a reader sees (grapheme clusters, so an emoji or a letter with marks counts once). */
export function visibleLength(text: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    let n = 0;
    for (const _ of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) n++;
    return n;
  }
  return Array.from(text).length;
}

/** Splits into words on white space. */
export function wordsOf(text: string): string[] {
  const t = tidyText(text);
  return t ? t.split(' ') : [];
}

/**
 * The form used for matching, never for showing: lowercase, no accents or
 * combining marks (Latin accents, Hebrew points, Arabic short vowels), the
 * common letter swaps folded, and spelled-out letters joined.
 */
export function foldText(input: string): string {
  const base = input
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[013457@$]/g, (c) => SWAPS[c] as string);
  // "b a d", "b.a.d", "b-a-d" → "bad": three or more single letters in a row.
  const joined = base.replace(
    /(?<![\p{L}\p{N}])\p{L}(?:[\s.\-_*]+\p{L})(?:[\s.\-_*]+\p{L})+(?![\p{L}\p{N}])/gu,
    (run) => run.replace(/[\s.\-_*]+/g, ''),
  );
  return joined
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

const LINK =
  /(?:https?:\/\/|www\.)\S+|\b[\p{L}\p{N}-]+\.(?:com|net|org|io|co|me|ly|gg|app|dev|info|xyz|tv|link|site|online)\b/iu;
// Matched per word and anchored, with classes that cannot overlap, so a long
// run of one character costs linear time, not quadratic.
const EMAIL_WORD = /^[^@]+@[^@.]+(?:\.[^@.]+)+$/u;
const hasEmail = (text: string) => text.split(' ').some((word) => EMAIL_WORD.test(word));
// Seven or more digits, allowing the usual separators between them.
const PHONE = /(?:\+?\d[\s().-]*){7,}/u;

/** Runs every rule and says the first one the text breaks. */
export function checkText(input: string, rules: TextRules = {}): TextCheck {
  const {
    maxLength = 200,
    maxWords = Number.POSITIVE_INFINITY,
    blocklist,
    allowLinks = false,
    allowContact = false,
  } = rules;
  const text = tidyText(input);
  if (!text) return { ok: false, reason: 'empty' };
  if (visibleLength(text) > maxLength) return { ok: false, reason: 'too-long' };
  if (!allowContact && (hasEmail(text) || PHONE.test(text))) return { ok: false, reason: 'contact' };
  if (!allowLinks && LINK.test(text)) return { ok: false, reason: 'link' };
  if (blocklist && blocklist.length > 0 && isBlocked(text, blocklist)) return { ok: false, reason: 'blocked' };
  if (wordsOf(text).length > maxWords) return { ok: false, reason: 'too-many-words' };
  return { ok: true, text };
}

/** True when any whole word, or run of words, of `text` is on the list. */
export function isBlocked(text: string, blocklist: readonly string[]): boolean {
  const hay = ` ${foldText(text)} `;
  const squeezed = ` ${hay.replace(/\s+/g, '')} `;
  for (const raw of blocklist) {
    const needle = foldText(raw);
    if (!needle) continue;
    if (hay.includes(` ${needle} `)) return true;
    // The whole text is the word with its spaces taken out ("ba d").
    if (!needle.includes(' ') && squeezed === ` ${needle} `) return true;
  }
  return false;
}
