/**
 * Forced colours focus lock: a control that hides the browser outline keeps it
 * in forced colours mode (Windows Contrast themes).
 *
 * Interlace draws its focus ring as a box-shadow (`focus-visible:ring-2`) and
 * hides the outline so the two never double up. Forced colours mode removes
 * every box-shadow, so the outline is the only ring left. In Tailwind v4
 * `outline-none` is `outline-style: none` in every mode: the control loses its
 * focus indicator outright (WCAG 2.4.7). `outline-hidden` is the same in a
 * normal page and turns into a 2px outline in forced colours, which the
 * browser paints in a system colour. v3's `outline-none` did that; v4 moved it
 * to `outline-hidden`, so a class copied from v3 code breaks silently and no
 * screenshot shows it.
 *
 * The bare form is written `focus-visible:outline-hidden`, so in forced
 * colours the outline appears on keyboard focus only, not around every
 * control at rest.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../src');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.(stories|test)\./.test(name) ? [path] : [];
  });

const FILES = walk(SRC);

/**
 * Files that still carry `outline-none`, each with the reason. Shrinks only. The
 * wordmark is changed by open PR #283; it moves to `outline-hidden` after that
 * merges, so the two PRs do not collide.
 */
const KNOWN: Record<string, string> = {
  'patterns/wordmark.tsx': 'after #283 merges',
};

/** `outline-none` in class strings, with any variant prefix, comments removed. */
const hidden = (source: string): string[] => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return code.match(/(?<![\w-])(?:[\w[\]&_>=*.():-]*:)?outline-none(?![\w-])/g) ?? [];
};

describe('forced colours keep a focus indicator', () => {
  it('reads real files', () => {
    expect(FILES.length).toBeGreaterThan(100);
  });

  it('no component removes the outline that forced colours mode relies on', () => {
    const bad = FILES.filter((file) => !(relative(SRC, file) in KNOWN)).flatMap((file) =>
      hidden(readFileSync(file, 'utf8')).map((hit) => `${relative(SRC, file)}: ${hit} (use outline-hidden)`),
    );
    expect(bad).toEqual([]);
  });

  it('keeps no stale exception', () => {
    const stale = Object.keys(KNOWN).filter((file) => hidden(readFileSync(join(SRC, file), 'utf8')).length === 0);
    expect(stale).toEqual([]);
  });

  it('catches the classes it exists for', () => {
    expect(hidden("'outline-none focus-visible:ring-2'")).toHaveLength(1);
    expect(hidden("'focus-visible:outline-none focus:outline-none'")).toHaveLength(2);
    expect(hidden("'[&_a:focus-visible]:outline-none'")).toHaveLength(1);
    expect(hidden("'focus-visible:outline-hidden outline-hidden'")).toHaveLength(0);
    expect(hidden('// outline-none in a comment is fine')).toHaveLength(0);
    expect(hidden("'outline-nonexistent'")).toHaveLength(0);
  });
});
