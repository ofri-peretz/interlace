/**
 * account-menu-model: names, initials, the sign-in address, the return-path check and the
 * reducer under `useAccount`.
 *
 * The `safeReturnPath` tables start from the 22 cases of the `safeNext` the WhyLikeDIs site
 * shipped (apps/site/lib/supabase/safe-next.test.ts), then add what a prefix check lets through.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  accountDisplayName,
  accountInitials,
  reduceAccount,
  safeReturnPath,
  signInHref,
  UNKNOWN,
  type Account,
  type AccountState,
} from '../src/patterns/account-menu-model.js';

const dana: Account = { id: 'a1', firstName: 'Dana', lastName: 'Levi', email: 'dana@example.com' };

describe('accountDisplayName', () => {
  it('is the first name', () => {
    expect(accountDisplayName({ firstName: 'Dana', email: 'x@y.z' })).toBe('Dana');
  });
  it('trims the first name and keeps what is inside it', () => {
    expect(accountDisplayName({ firstName: '  Mary Ann ' })).toBe('Mary Ann');
  });
  it('falls to the start of the email when the first name is blank', () => {
    expect(accountDisplayName({ firstName: '   ', email: 'dana@example.com' })).toBe('dana');
    expect(accountDisplayName({ firstName: null, email: ' dana@example.com ' })).toBe('dana');
  });
  it('uses a whole email that has no @', () => {
    expect(accountDisplayName({ email: 'dana' })).toBe('dana');
  });
  it('falls to the fallback when there is no name and no usable email', () => {
    expect(accountDisplayName(null)).toBe('Your account');
    expect(accountDisplayName({})).toBe('Your account');
    expect(accountDisplayName({ email: '@example.com' })).toBe('Your account');
    expect(accountDisplayName({ email: '  ' }, 'Guest')).toBe('Guest');
  });
});

describe('accountInitials', () => {
  it('is the first letter of each name, upper-cased', () => {
    expect(accountInitials({ firstName: 'dana', lastName: 'levi' })).toBe('DL');
  });
  it('works with one name', () => {
    expect(accountInitials({ firstName: 'Dana' })).toBe('D');
    expect(accountInitials({ lastName: 'Levi' })).toBe('L');
  });
  it('leaves scripts with no case unchanged', () => {
    expect(accountInitials({ firstName: 'דנה', lastName: 'לוי' })).toBe('דל');
    expect(accountInitials({ firstName: 'سارة', lastName: 'علي' })).toBe('سع');
    expect(accountInitials({ firstName: '田中', lastName: '太郎' })).toBe('田太');
  });
  it('keeps a letter with a mark, and an emoji, whole', () => {
    expect(accountInitials({ firstName: 'Åsa' })).toBe('Å');
    expect(accountInitials({ firstName: 'e\u0301lise' })).toBe('E\u0301');
    expect(accountInitials({ firstName: '😀 Sam', lastName: 'Lee' })).toBe('😀L');
  });
  it('falls to the first letter of the email, upper-cased', () => {
    expect(accountInitials({ email: 'dana@example.com' })).toBe('D');
    expect(accountInitials({ firstName: ' ', lastName: '', email: 'x@y.z' })).toBe('X');
  });
  it('is ? when there is nothing', () => {
    expect(accountInitials(null)).toBe('?');
    expect(accountInitials({ firstName: ' ', lastName: ' ', email: ' ' })).toBe('?');
  });
  it('trims before it takes a letter', () => {
    expect(accountInitials({ firstName: '  dana', lastName: '\tlevi' })).toBe('DL');
  });

  describe('without Intl.Segmenter', () => {
    const original = Intl.Segmenter;
    afterEach(() => {
      Object.defineProperty(Intl, 'Segmenter', { value: original, configurable: true, writable: true });
    });
    it('falls back to code points: still not half a surrogate pair', () => {
      Object.defineProperty(Intl, 'Segmenter', { value: undefined, configurable: true, writable: true });
      expect(accountInitials({ firstName: '😀 Sam', lastName: 'lee' })).toBe('😀L');
      expect(accountInitials({ firstName: 'dana' })).toBe('D');
    });
  });
});

describe('signInHref', () => {
  it('is unchanged without a page', () => {
    expect(signInHref('/sign-in')).toBe('/sign-in');
    expect(signInHref('/sign-in', '')).toBe('/sign-in');
    expect(signInHref('/sign-in', null)).toBe('/sign-in');
  });
  it('is unchanged on the sign-in page, with or without a trailing slash', () => {
    expect(signInHref('/sign-in', '/sign-in')).toBe('/sign-in');
    expect(signInHref('/sign-in', '/sign-in/')).toBe('/sign-in');
    expect(signInHref('/sign-in/', '/sign-in')).toBe('/sign-in/');
    expect(signInHref('/sign-in', '/sign-in?next=%2Fa')).toBe('/sign-in');
    expect(signInHref('/', '/')).toBe('/');
    expect(signInHref('/a/b', '/a/b///')).toBe('/a/b');
    expect(signInHref('/a/b///', '/a/b')).toBe('/a/b///');
    expect(signInHref('/a/b', '/a/b/c/')).toBe('/a/b?next=%2Fa%2Fb%2Fc%2F');
    expect(signInHref('/sign-in', '/sign-in#top')).toBe('/sign-in');
  });
  it('carries the page, encoded, with its query and hash', () => {
    expect(signInHref('/sign-in', '/a/b?x=1&y=2#top')).toBe('/sign-in?next=%2Fa%2Fb%3Fx%3D1%26y%3D2%23top');
  });
  it('uses & when the sign-in address already has a query', () => {
    expect(signInHref('/sign-in?lang=he', '/a')).toBe('/sign-in?lang=he&next=%2Fa');
  });
  it('leaves a hostile page out instead of encoding it', () => {
    expect(signInHref('/sign-in', '//evil.com')).toBe('/sign-in');
    expect(signInHref('/sign-in', '/\t/evil.com')).toBe('/sign-in');
    expect(signInHref('/sign-in', 'https://evil.com')).toBe('/sign-in');
  });
});

// Every one of these must land on the fallback, not on another site. The first 17 are the
// WhyLikeDIs table, name for name.
const hostile: [string, unknown][] = [
  ['protocol-relative', '//evil.com'],
  ['tab between slashes', '/\t/evil.com'],
  ['newline between slashes', '/\n/evil.com'],
  ['carriage return between slashes', '/\r/evil.com'],
  ['slash then backslash', '/\\evil.com'],
  ['backslash then slash', '\\/evil.com'],
  ['two backslashes', '\\\\evil.com'],
  ['backslash later in the path', '/ok\\evil.com'],
  ['absolute url', 'https://evil.com'],
  ['javascript url', 'javascript:alert(1)'],
  ['leading space', '  /x'],
  ['trailing space', '/x '],
  ['control character', '/x\u0001y'],
  ['no leading slash', 'evil.com'],
  ['empty', ''],
  ['null', null],
  ['undefined', undefined],
  // Added here: what a prefix check, or a check on the first two characters, lets through.
  ['NUL between slashes', '/\u0000/evil.com'],
  ['vertical tab between slashes', '/\u000b/evil.com'],
  ['form feed between slashes', '/\u000c/evil.com'],
  ['DEL between slashes', '/\u007f/evil.com'],
  ['line separator between slashes', `/${String.fromCodePoint(0x2028)}/evil.com`],
  ['paragraph separator between slashes', `/${String.fromCodePoint(0x2029)}/evil.com`],
  ['no-break space', `/${String.fromCodePoint(0xa0)}/evil.com`],
  ['byte order mark', `/${String.fromCodePoint(0xfeff)}/evil.com`],
  ['ideographic space', `/${String.fromCodePoint(0x3000)}/evil.com`],
  ['space between slashes', '/ /evil.com'],
  ['tab in the middle of a path', '/a\tb'],
  ['newline at the end', '/a\n'],
  ['leading tab then slash', '\t/a'],
  ['two slashes and a path', '//a/b'],
  ['only two slashes', '//'],
  ['slash backslash only', '/\\'],
  ['data url', 'data:text/html,x'],
  ['mailto', 'mailto:a@b.c'],
  ['a number', 123],
  ['an object', {}],
  ['a string that is too long', `/${'a'.repeat(2048)}`],
];

const allowed = [
  '/',
  '/ok/path?x=1#y',
  '/account/',
  '/sign-in/?next=/account/',
  '/a/b',
  '/a?x=1#y',
  '/caf%C3%A9',
  `/${'a'.repeat(2047)}`,
  '/%09/a',
  '/a//b',
  '/a/../b',
  '/?next=//evil.com',
  '/#//evil.com',
  '/a@evil.com',
  '/:evil.com',
];

describe('safeReturnPath', () => {
  it.each(hostile)('refuses: %s', (_name, input) => {
    expect(safeReturnPath(input as string)).toBe('/');
    expect(safeReturnPath(input as string, '/home')).toBe('/home');
  });

  it.each(allowed)('keeps %s', (input) => {
    expect(safeReturnPath(input)).toBe(input);
  });

  it('has at least thirty hostile rows', () => {
    expect(hostile.length).toBeGreaterThanOrEqual(30);
  });

  // An encoded slash is still a path on this site: a browser does not decode it before it
  // resolves the address, so it can never become "//". Kept as given, on purpose.
  it('keeps an encoded double slash as a path on this site', () => {
    expect(safeReturnPath('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com');
    expect(safeReturnPath('/%2f%2fevil.com')).toBe('/%2f%2fevil.com');
    expect(safeReturnPath('/%5Cevil.com')).toBe('/%5Cevil.com');
    expect(new URL('/%2F%2Fevil.com', 'http://site.invalid').host).toBe('site.invalid');
  });

  it('does not check the fallback: it is the app’s own constant', () => {
    expect(safeReturnPath('//evil.com', '//app-constant')).toBe('//app-constant');
  });

  it('the default fallback is /', () => {
    expect(safeReturnPath(undefined)).toBe('/');
  });

  it('never throws and never leaves the site, for random strings', () => {
    const alphabet = ['/', '\\', '\t', '\n', '%', '2', 'F', '5', 'c', '.', 'a', 'Z', ' ', '@', ':', '?', '#', '\u00a0'];
    let seed = 20261127;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 5000; i += 1) {
      const length = 1 + Math.floor(next() * 8);
      let candidate = '';
      for (let j = 0; j < length; j += 1) candidate += alphabet[Math.floor(next() * alphabet.length)];
      const result = safeReturnPath(candidate, '/fallback');
      if (result !== '/fallback') {
        expect(new URL(result, 'http://return.invalid').origin, JSON.stringify(candidate)).toBe('http://return.invalid');
      }
    }
  });
});

describe('reduceAccount', () => {
  const signedOut: AccountState = { status: 'signed-out' };
  const signedIn: AccountState = { status: 'signed-in', account: dana };

  it('unknown + read(null) is signed-out', () => {
    expect(reduceAccount(UNKNOWN, { type: 'read', account: null })).toEqual(signedOut);
  });
  it('unknown + read(account) is signed-in', () => {
    expect(reduceAccount(UNKNOWN, { type: 'read', account: dana })).toEqual(signedIn);
  });
  it('change(null) is signed-out from any state', () => {
    for (const from of [UNKNOWN, signedOut, signedIn]) {
      expect(reduceAccount(from, { type: 'change', account: null })).toEqual(signedOut);
    }
  });
  it('change(account) is signed-in from any state', () => {
    for (const from of [UNKNOWN, signedOut, signedIn]) {
      expect(reduceAccount(from, { type: 'change', account: dana })).toEqual(signedIn);
    }
  });
  it('a later read never overwrites a newer change', () => {
    expect(reduceAccount(signedIn, { type: 'read', account: null })).toBe(signedIn);
    expect(reduceAccount(signedOut, { type: 'read', account: dana })).toBe(signedOut);
  });
  it('an equal account is the same object, so nothing re-renders', () => {
    expect(reduceAccount(signedIn, { type: 'change', account: { ...dana } })).toBe(signedIn);
    expect(reduceAccount(signedOut, { type: 'change', account: null })).toBe(signedOut);
  });
  it('a better profile for the same person replaces the account', () => {
    for (const patch of [
      { id: 'a2' },
      { firstName: 'Dan' },
      { lastName: 'Cohen' },
      { email: 'd@example.com' },
      { imageUrl: 'https://img.example/d.png' },
    ]) {
      const next = reduceAccount(signedIn, { type: 'change', account: { ...dana, ...patch } });
      expect(next).not.toBe(signedIn);
      expect(next).toEqual({ status: 'signed-in', account: { ...dana, ...patch } });
    }
  });
  it('reset goes back to unknown', () => {
    expect(reduceAccount(signedIn, { type: 'reset' })).toBe(UNKNOWN);
  });
});
