/**
 * @interlace/ui — patterns/account-menu-model
 *
 * The pure half of `AccountMenu`: what to call a person, what to put in an avatar with no photo,
 * the sign-in address that carries the page they were on, the one check that decides whether an
 * address they come back to is on this site, and the reducer under `useAccount`. No DOM, no
 * `window`, no storage, no network: a server, a test and an agent can all use it.
 *
 * ## `safeReturnPath`
 *
 * A "return to" address (`?next=`) is the classic open redirect: the sign-in page sends the
 * person wherever the link says. Only a path on this site may come back out, for any input,
 * including the ones a browser rewrites. A browser deletes tabs and newlines from an address
 * before it reads it, so `/\t/evil.com` is a path to a prefix check and `//evil.com` to the
 * browser. So the rule refuses what a browser would rewrite, and then asks the parser:
 *
 *   1. It is a string, 1 to 2048 characters.
 *   2. It starts with `/`, and the next character is not `/` or `\`.
 *   3. No whitespace (any Unicode space, line separator or paragraph separator), no control
 *      character (C0 and DEL) and no backslash appears anywhere in it.
 *   4. Parsed with `new URL` against a fixed fake origin, it still has that origin.
 *
 * Anything else is the fallback. The function never throws.
 *
 * **An encoded slash is allowed.** `/%2F%2Fevil.com` is a path on this site: a browser does not
 * decode `%2F` before it resolves an address, so it can never become `//`. It is kept as given.
 * Whoever reads the path out of the address and decodes it again owns that second step, and must
 * run `safeReturnPath` on the decoded value too ("use it on the reading side, not only when you
 * build the link").
 *
 * The same rule as the hand-written `safeNext` a first consumer shipped and tested with 22 cases,
 * with one addition: the 2048 limit.
 * Step 4 cannot fail after steps 1 to 3 (it is defence in depth), so a mutation of it is an
 * equivalent mutant.
 *
 * ## Names
 *
 * `accountDisplayName` is what to greet someone by: first name, else the start of the email, else
 * a plain label. `accountInitials` is up to two letters for an avatar with no photo, counted in
 * grapheme clusters (`Intl.Segmenter` where the runtime has it, `Array.from` otherwise, which
 * can still cut a ZWJ emoji sequence in the middle), so an emoji, a letter with a combining mark
 * or a Hebrew or Han name is not cut in half.
 */

export interface Account {
  /** Opaque to the kit. Used as a React key and as `data-account-id`. */
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  imageUrl?: string | null;
}

export type AccountState =
  | { status: 'unknown' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; account: Account };

export type AccountEvent =
  | { type: 'read'; account: Account | null }
  | { type: 'change'; account: Account | null }
  | { type: 'reset' };

export const DEFAULT_FALLBACK_NAME = 'Your account';

/** The fake origin a path is resolved against. `.invalid` never resolves to a real host. */
const FAKE_ORIGIN = 'http://return.invalid';
const MAX_PATH = 2048;

/** A path: `/`, then not `/` or `\`, then no whitespace, no control character, no backslash. */
const SAFE_PATH = /^\/(?![/\\])[^\s\\\x00-\x1f\x7f]*$/;

/**
 * Only a path on this site comes back out; anything else is `fallback` (the app's own
 * constant, never checked). Never throws.
 */
export function safeReturnPath(next: unknown, fallback = '/'): string {
  return typeof next === 'string' &&
    next.length <= MAX_PATH &&
    SAFE_PATH.test(next) &&
    new URL(next, FAKE_ORIGIN).origin === FAKE_ORIGIN
    ? next
    : fallback;
}

const present = (value: string | null | undefined): string => (value ?? '').trim();

/** First name, else the start of the email, else `fallback`. Never an empty string. */
export function accountDisplayName(
  account: Pick<Account, 'firstName' | 'email'> | null,
  fallback: string = DEFAULT_FALLBACK_NAME,
): string {
  const first = present(account?.firstName);
  if (first) return first;
  const email = present(account?.email);
  const at = email.indexOf('@');
  const local = at < 0 ? email : email.slice(0, at);
  return local.trim() || fallback;
}

function graphemes(text: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

const firstGrapheme = (text: string): string => graphemes(text)[0] ?? '';

/**
 * Up to two letters, upper-cased: the first of the first name and the first of the last name; if
 * there is neither, the first of the email; if there is nothing, `?`. Scripts with no case
 * (Hebrew, Arabic, Han) come out unchanged.
 */
export function accountInitials(
  account: Pick<Account, 'firstName' | 'lastName' | 'email'> | null,
): string {
  const names = [firstGrapheme(present(account?.firstName)), firstGrapheme(present(account?.lastName))].join('');
  const letters = names || firstGrapheme(present(account?.email));
  return letters ? letters.toLocaleUpperCase() : '?';
}

/** The path of an address: no query, no fragment, no trailing slash (the root becomes empty). */
const pagePath = (address: string): string => address.split(/[?#]/, 1)[0]!.replace(/\/+$/, '');

/**
 * The sign-in address with a safe `?next=`. `signIn` comes back unchanged when `here` is absent,
 * empty, the sign-in page itself (`/sign-in` and `/sign-in/` are one page) or not a path on this
 * site (it is left out, never encoded). `signIn` may already have a query; it must have no fragment.
 */
export function signInHref(signIn: string, here?: string | null): string {
  if (!here || pagePath(here) === pagePath(signIn)) return signIn;
  const next = safeReturnPath(here, '');
  if (!next) return signIn;
  return `${signIn}${signIn.includes('?') ? '&' : '?'}next=${encodeURIComponent(next)}`;
}

export const UNKNOWN: AccountState = { status: 'unknown' };
const SIGNED_OUT: AccountState = { status: 'signed-out' };

const sameAccount = (a: Account, b: Account): boolean =>
  a.id === b.id &&
  a.firstName === b.firstName &&
  a.lastName === b.lastName &&
  a.email === b.email &&
  a.imageUrl === b.imageUrl;

const settle = (state: AccountState, account: Account | null): AccountState => {
  if (!account) return state.status === 'signed-out' ? state : SIGNED_OUT;
  if (state.status === 'signed-in' && sameAccount(state.account, account)) return state;
  return { status: 'signed-in', account };
};

/**
 * The state under `useAccount`. `read` is the first answer and counts only while nothing is
 * known: a late `read` never overwrites a newer `change`. `change` always counts. An equal
 * account returns the same object, so nothing re-renders. `reset` goes back to `unknown` (the
 * adapter was swapped for another).
 */
export function reduceAccount(state: AccountState, event: AccountEvent): AccountState {
  if (event.type === 'reset') return UNKNOWN;
  if (event.type === 'read' && state.status !== 'unknown') return state;
  return settle(state, event.account);
}
