/**
 * Motion token lock: primitives and patterns time their transitions with
 * the motion tokens (`duration-(--duration-base)`, `ease-enter`), never a
 * literal (`duration-150`, `duration-[180ms]`, `ease-out`).
 *
 * A brand retunes motion by setting `--duration-*` and `--ease-*` once. A
 * literal ignores that: one menu stays at 150ms while the rest of the app
 * slows down, and nothing looks wrong in a screenshot. This lock is the only
 * thing that notices.
 *
 * `duration-0` stays allowed: it switches a transition off while a drawer
 * is being dragged, which is not a timing a brand tunes. Effects are out of
 * scope; their ambient loops run on keyframe lengths of their own.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../src');
const DIRS = ['primitives', 'patterns'].map((dir) => join(SRC, dir));

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.stories\./.test(name) ? [path] : [];
  });

const FILES = DIRS.flatMap(walk);

/** Literal on purpose, by file. Every entry carries its reason. */
const ALLOWED: Record<string, { hits: string[]; why: string }> = {
  'patterns/thread-steps.tsx': {
    hits: ['ease-out'],
    why: 'a Web Animations `easing` keyword, not a class: the strand draw matches the `--animate-strand-draw` keyframe',
  },
};

/** Literal timings in class strings, with comments removed so prose may name them. */
const literal = (source: string): string[] => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const prefix = String.raw`(?<![\w-])(?:[\w:[\]&_>=*.()/-]*:)?`;
  // An arbitrary value built from a token (`duration-[calc(2*var(--duration-medium))]`) is fine.
  const duration = String.raw`duration-(?:[1-9]\d*|\[(?![^\]]*--duration-)[^\]]+\])(?![\w-])`;
  const ease = String.raw`ease-(?:in|out|in-out|linear|\[[^\]]+\])(?![\w-])`;
  return code.match(new RegExp(`${prefix}(?:${duration}|${ease})`, 'g')) ?? [];
};

describe('motion uses tokens', () => {
  it('reads real files', () => {
    expect(FILES.length).toBeGreaterThan(80);
  });

  it('no primitive or pattern hard-codes a duration or an easing', () => {
    const bad = FILES.flatMap((file) => {
      const key = relative(SRC, file).split(sep).join('/');
      const allowed = ALLOWED[key]?.hits ?? [];
      return literal(readFileSync(file, 'utf8'))
        .filter((hit) => !allowed.includes(hit))
        .map((hit) => `${key}: ${hit}`);
    });
    expect(bad).toEqual([]);
  });

  it('catches the classes it exists for', () => {
    expect(literal("cn('transition duration-150 ease-out')")).toHaveLength(2);
    expect(literal("'duration-[180ms] motion-safe:duration-300 motion-reduce:ease-in-out'")).toHaveLength(3);
    expect(literal("'motion-safe:ease-[cubic-bezier(0.2,0,0,1)]'")).toHaveLength(1);
    expect(literal("'duration-(--duration-base) ease-enter ease-exit ease-move'")).toHaveLength(0);
    expect(literal("'data-[swiping]:duration-0'")).toHaveLength(0);
    expect(literal("'duration-[calc(var(--k,1)*var(--duration-medium))]'")).toHaveLength(0);
    expect(literal('// duration-150 in a comment is fine')).toHaveLength(0);
  });
});
