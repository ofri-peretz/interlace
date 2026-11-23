/**
 * Breakpoints lock.
 *
 * WHY THIS LOCK EXISTS
 * --------------------
 * Interlace 2.0 keeps Tailwind v4's own ladder (640/768/1024/1280/1536)
 * untouched — overriding it changed every consumer app's `sm:` and
 * deleted their `2xl:`. Interlace ADDS one handheld tier below it,
 * `xs` = 30rem (480px), in `packages/ui/styles/structure/layout.css`.
 * The contract only holds if:
 *
 *   1. structure/layout.css declares `xs` and redeclares none of Tailwind's
 *      own tiers.
 *   2. No primitive / pattern / template source file declares an
 *      ad-hoc `@media (...)` query — every responsive surface must
 *      go through the `xs:` / `sm:` / `md:` / `lg:` / `xl:` Tailwind variants
 *      so the ladder stays auditable.
 *   3. No source file declares its own `--breakpoint-*` token (a
 *      consumer-app override is fine; the DS itself must not
 *      shadow its own contract).
 *
 * If any of these slip, the breakpoint contract is meaningless. The
 * lock surfaces the regression at PR time, not in a future debugging
 * session three months later.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const FOUNDATION_PATH = resolve(
  __dirname,
  '../styles/structure/layout.css',
);

const SCAN_ROOTS = [
  resolve(__dirname, '../src/primitives'),
  resolve(__dirname, '../src/patterns'),
  resolve(__dirname, '../src/templates'),
];

const EXPECTED_BREAKPOINTS: Record<string, string> = {
  '--breakpoint-xs': '30rem',
};

/** Tailwind's own tiers — an Interlace redeclaration would rewrite the consumer's. */
const TAILWIND_TIERS = ['sm', 'md', 'lg', 'xl', '2xl'];

function walkSync(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkSync(full, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('Breakpoints lock', () => {
  const foundation = readFileSync(FOUNDATION_PATH, 'utf-8');

  it.each(Object.entries(EXPECTED_BREAKPOINTS))(
    'structure/type.css declares %s = %s',
    (token, value) => {
      // Match `<token>: <value>;` with flexible whitespace + a trailing
      // comment.
      const re = new RegExp(
        `${token}\\s*:\\s*${value.replace('.', '\\.')}\\b`,
      );
      expect(foundation).toMatch(re);
    },
  );

  it.each(TAILWIND_TIERS)('structure/type.css does NOT redeclare Tailwind\'s %s tier', (tier) => {
    expect(foundation).not.toMatch(new RegExp(`--breakpoint-${tier}\\s*:`));
  });

  it('no primitive / pattern / template source declares a raw @media query', () => {
    // Allowed exception: @media (prefers-reduced-motion) and
    // @media (forced-colors) are NOT layout breakpoints — they're
    // user-preference queries and are the standard mechanism for
    // those contracts. The lock only catches width / min-width /
    // max-width queries.
    const widthMediaRe =
      /@media\s*\([^)]*\b(min-width|max-width)\b[^)]*\)/g;

    const failures: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of walkSync(root)) {
        const source = readFileSync(file, 'utf-8');
        const matches = source.match(widthMediaRe);
        if (matches) {
          failures.push(
            `${file.replace(resolve(__dirname, '../..') + '/', '')}: ${matches.length} raw @media (min/max-width) query/queries`,
          );
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('no primitive / pattern / template source declares a custom --breakpoint-* token', () => {
    const breakpointTokenRe = /--breakpoint-[a-z0-9-]+\s*:/g;

    const failures: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of walkSync(root)) {
        const source = readFileSync(file, 'utf-8');
        const matches = source.match(breakpointTokenRe);
        if (matches) {
          failures.push(
            `${file.replace(resolve(__dirname, '../..') + '/', '')}: declares custom breakpoint tokens (${matches.join(', ')})`,
          );
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
