/**
 * cn() type-scale lock.
 *
 * Tailwind v4 emits a `text-<name>` utility for every `--text-<name>` theme key,
 * and those are indistinguishable from `text-<color>` by name alone. Unconfigured,
 * tailwind-merge files them under `text-color` and **deletes the size** whenever a
 * colour utility is present in the same `cn()` call.
 *
 * That shipped in the DOM in eight places before it was caught, and it is
 * invisible in review: the class list looks right in the source and is wrong in
 * the browser. So two things are locked here — the behaviour, and the fact that
 * `DS_FONT_SIZES` still matches the stylesheet it mirrors. A token added to
 * `foundation.css` and forgotten in `cn.ts` does not throw; it silently loses its
 * size at the first colour collision.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, expect, it } from 'vitest';

import { DS_FONT_SIZES, cn } from '../src/lib/cn.js';

const FOUNDATION = resolve(__dirname, '../styles/foundation.css');

/** `--text-ui-sm: 0.8125rem;` → `ui-sm`. Ignores the `--line-height` companions. */
function declaredFontSizes(): string[] {
  const css = readFileSync(FOUNDATION, 'utf8');
  const found = new Set<string>();
  for (const [, name] of css.matchAll(/^\s*--text-([a-z0-9-]+)\s*:/gim)) {
    if (!name.endsWith('--line-height')) found.add(name);
  }
  return [...found].sort();
}

describe('cn() knows the DS type scale', () => {
  it('registers every --text-* token declared in foundation.css', () => {
    const declared = declaredFontSizes();
    const registered = [...DS_FONT_SIZES].sort();
    expect(
      declared.filter((t) => !registered.includes(t)),
      'These font-size tokens exist in foundation.css but are missing from DS_FONT_SIZES in cn.ts. ' +
        'Until they are listed, tailwind-merge treats them as COLOUR utilities and silently deletes ' +
        'them whenever a component sets a text colour on the same element.',
    ).toEqual([]);
  });

  it('registers nothing that foundation.css does not declare', () => {
    const declared = declaredFontSizes();
    expect([...DS_FONT_SIZES].filter((t) => !declared.includes(t))).toEqual([]);
  });
});

describe('cn() merge behaviour', () => {
  it('keeps a DS size token alongside a colour token', () => {
    // The regression itself: this used to return 'font-medium text-foreground'.
    expect(cn('text-ui-sm font-medium text-foreground')).toBe(
      'text-ui-sm font-medium text-foreground',
    );
  });

  it('keeps text-code on an element that also sets a colour', () => {
    expect(cn('text-code', 'text-foreground')).toBe('text-code text-foreground');
  });

  it('still treats two DS sizes as mutually exclusive', () => {
    expect(cn('text-ui', 'text-body')).toBe('text-body');
  });

  it('still treats two colours as mutually exclusive', () => {
    expect(cn('text-foreground', 'text-muted-foreground')).toBe('text-muted-foreground');
  });

  it('does not disturb Tailwind\'s own size scale', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });

  it('lets a DS size override a Tailwind size and vice versa', () => {
    expect(cn('text-sm', 'text-ui')).toBe('text-ui');
    expect(cn('text-ui', 'text-sm')).toBe('text-sm');
  });

  it('still merges everything else the way callers rely on', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('flex', false && 'hidden', undefined, ['gap-2'])).toBe('flex gap-2');
  });
});
