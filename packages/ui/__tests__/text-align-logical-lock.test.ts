/**
 * Text alignment lock: components align text with `text-start` and
 * `text-end`, never `text-left` and `text-right`.
 *
 * Physical alignment is correct in a left-to-right page and backwards in
 * Hebrew or Arabic: a table's label column ends up on the far side of its
 * numbers, and a caption sits against the wrong edge. Logical alignment
 * follows `dir`, so one class is right in both. Nothing renders an error
 * when this slips, which is why it is a lock.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../src');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });

const FILES = walk(SRC);

/** Class-string matches, with comments removed so prose may name the old classes. */
const physical = (source: string) => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return code.match(/(?<![\w-])(?:[\w:[\]&_>-]*:)?text-(?:left|right)(?![\w-])/g) ?? [];
};

describe('text alignment is logical', () => {
  it('reads real files', () => {
    expect(FILES.length).toBeGreaterThan(100);
  });

  it('no component uses text-left or text-right', () => {
    const bad = FILES.flatMap((file) =>
      physical(readFileSync(file, 'utf8')).map((hit) => `${relative(SRC, file)}: ${hit}`),
    );
    expect(bad).toEqual([]);
  });

  it('catches the classes it exists for', () => {
    expect(physical("cn('px-3 text-left', 'xs:text-right')")).toHaveLength(2);
    expect(physical("'[&_th]:text-left'")).toHaveLength(1);
    expect(physical('// text-left in a comment is fine')).toHaveLength(0);
    expect(physical("'text-start text-end'")).toHaveLength(0);
  });
});
