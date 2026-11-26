/**
 * Focus ring strength lock: a focus indicator is drawn at full strength,
 * never as a tint (`focus-visible:ring-ring/50`, `ring-destructive/20`).
 *
 * WCAG 1.4.11 asks 3:1 between the indicator and what it sits on. `--ring`
 * clears that at full strength in every Interlace theme (8.4:1 and up), but
 * a tint is a mix with the page: measured on the light themes, `ring/50`
 * lands at 2.5:1 and `destructive/20` at 1.4:1. Nothing looks broken in a
 * screenshot, which is why this is a lock.
 *
 * It also holds the one recipe: a 2px ring (`focus-visible:ring-2`) with a
 * 2px gap in the page colour, the same weight as the preflight outline, so
 * every control focuses alike and the ring never sits on the label.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../src');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.stories\./.test(name) ? [path] : [];
  });

const FILES = walk(SRC);

/** Tinted or heavy focus rings in class strings, with comments removed. */
const weak = (source: string): string[] => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const prefix = String.raw`(?<![\w-])(?:[\w[\]&_>=*.()-]*:)*`;
  const tint = String.raw`focus(?:-visible|-within)?:(?:ring|outline)-[a-z-]+\/\d+(?![\w-])`;
  const heavy = String.raw`focus(?:-visible|-within)?:ring-\[\d+px\]`;
  return code.match(new RegExp(`${prefix}(?:${tint}|${heavy})`, 'g')) ?? [];
};

describe('focus rings are full strength', () => {
  it('reads real files', () => {
    expect(FILES.length).toBeGreaterThan(100);
  });

  it('no component tints its focus ring or thickens it past the recipe', () => {
    const bad = FILES.flatMap((file) =>
      weak(readFileSync(file, 'utf8')).map((hit) => `${relative(SRC, file)}: ${hit}`),
    );
    expect(bad).toEqual([]);
  });

  it('catches the classes it exists for', () => {
    expect(weak("'focus-visible:ring-ring/50 focus-visible:ring-[3px]'")).toHaveLength(2);
    expect(weak("'dark:focus-visible:ring-destructive/40 focus-within:outline-ring/60'")).toHaveLength(2);
    expect(weak("'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'")).toHaveLength(0);
    expect(weak("'aria-invalid:ring-destructive/20 hover:bg-primary/10'")).toHaveLength(0);
    expect(weak('// focus-visible:ring-ring/50 in a comment is fine')).toHaveLength(0);
  });
});
