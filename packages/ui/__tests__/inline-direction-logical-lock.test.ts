/**
 * Inline direction lock: components place things with logical sides
 * (`ps-*`, `me-*`, `border-s`, `start-*`, `end-*`), never physical ones
 * (`pl-*`, `mr-*`, `border-l`, `left-*`, `right-*`).
 *
 * A physical side is right in English and backwards in Hebrew or Arabic:
 * a callout's accent bar lands on the far edge, a menu's check mark sits
 * after its label, a blockquote's rule is on the wrong side of the quote.
 * Logical sides follow `dir`, so one class is right in both. Nothing renders
 * an error when this slips, which is why it is a lock. Its sibling for text
 * alignment is `text-align-logical-lock.test.ts`.
 *
 * Physical classes stay only where the side is the point, and each one is
 * listed below with its reason.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../src');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.stories\./.test(name) ? [path] : [];
  });

/**
 * Charts plot on an x axis that runs left to right in every script, as
 * published charts in Hebrew and Arabic do, so their padding follows the
 * axis, not the reading direction.
 */
const AXIS_DIRS = [`charts${sep}`];

/** Physical on purpose, by file. Every entry carries its reason. */
const ALLOWED: Record<string, { classes: string[]; why: string }> = {
  'primitives/sheet.tsx': {
    classes: ['right-0', 'left-0', 'border-l', 'border-r'],
    why: '`side="left" | "right"` names a screen edge; the border faces the page',
  },
  'primitives/drawer.tsx': {
    classes: ['border-l', 'border-r', 'after:left-full', 'after:right-full'],
    why: '`direction="left" | "right"` names a screen edge and a swipe direction',
  },
  'patterns/topbar-nav.tsx': {
    classes: ['left-0'],
    why: 'the hover pill moves by a measured `getBoundingClientRect().left` offset',
  },
  'patterns/timeline-map.tsx': {
    classes: ['left-0', 'pr-3', 'left-40'],
    why: 'the time axis runs left to right, and its label column is pinned to it',
  },
  'effects/sheen.tsx': {
    classes: ['left-0'],
    why: 'a decorative sweep that starts off-screen with `-translate-x-full`',
  },
};

/** `left-1/2` with `-translate-x-1/2` centres, which is the same in both directions. */
const CENTRING = /(?:^|:)left-(?:1\/2|\[50%\])$/;

/** Class-string matches, with comments removed so prose may name the old classes. */
const physical = (source: string): string[] => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const prefix = String.raw`(?<![\w-])(?:[\w:[\]&_>=*.()-]*:)?-?`;
  const spacing = String.raw`(?:scroll-)?[pm][lr]-[^\s'"\`]+`;
  const border = String.raw`border-[lr](?:-[^\s'"\`]+)?(?![\w-])`;
  const corner = String.raw`rounded-(?:[lr]|tl|tr|bl|br)(?:-[^\s'"\`]+)?(?![\w-])`;
  const inset = String.raw`(?:left|right)-[^\s'"\`]+`;
  const re = new RegExp(`${prefix}(?:${spacing}|${border}|${corner}|${inset})`, 'g');
  return (code.match(re) ?? []).filter((hit) => !CENTRING.test(hit));
};

const FILES = walk(SRC).filter((file) => !AXIS_DIRS.some((dir) => relative(SRC, file).startsWith(dir)));

describe('inline direction is logical', () => {
  it('reads real files', () => {
    expect(FILES.length).toBeGreaterThan(100);
  });

  it('no component uses a physical side it does not need', () => {
    const bad = FILES.flatMap((file) => {
      const key = relative(SRC, file).split(sep).join('/');
      const allowed = ALLOWED[key]?.classes ?? [];
      return physical(readFileSync(file, 'utf8'))
        .filter((hit) => !allowed.includes(hit))
        .map((hit) => `${key}: ${hit}`);
    });
    expect(bad).toEqual([]);
  });

  it('every allowance is still needed', () => {
    const stale = Object.entries(ALLOWED).flatMap(([key, { classes }]) => {
      const hits = new Set(physical(readFileSync(join(SRC, key), 'utf8')));
      return classes.filter((c) => !hits.has(c)).map((c) => `${key}: ${c}`);
    });
    expect(stale).toEqual([]);
  });

  it('catches the classes it exists for', () => {
    expect(physical("cn('pl-8 pr-2', 'md:ml-auto', '-mr-1')")).toHaveLength(4);
    expect(physical("'border-l-4 border-l-primary border-r'")).toHaveLength(3);
    expect(physical("'absolute right-2 top-3 data-[inset]:left-8'")).toHaveLength(2);
    expect(physical("'[&_blockquote]:pl-6 rounded-l-lg rounded-tr-md'")).toHaveLength(3);
    expect(physical("'rounded-lg left-1/2 -translate-x-1/2 after:left-1/2'")).toHaveLength(0);
    expect(physical("'ps-8 pe-2 ms-auto border-s-4 start-2 end-4 px-3 inset-x-0'")).toHaveLength(0);
    expect(physical('// pl-8 in a comment is fine')).toHaveLength(0);
  });
});
