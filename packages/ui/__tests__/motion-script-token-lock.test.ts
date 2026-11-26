/**
 * Motion started from script follows the brand's tokens.
 *
 * `motion-token-lock` holds the classes. A Web Animations call takes plain
 * strings instead, so a curve typed into `el.animate(..., { easing })` stays the
 * same when a brand retunes `--ease-enter`. Script motion reads the token
 * through `lib/motion-token.ts`; this lock finds any curve written by hand.
 *
 * Charts are listed by file while the data components work owns them. The list
 * may only shrink.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { motionDuration, motionEase } from '../src/lib/motion-token.js';

const SRC = resolve(__dirname, '../src');
const HOME = 'lib/motion-token.ts';

/** Every entry carries its reason. */
const ALLOWED: Record<string, string> = {
  'charts/dot-plot.tsx': 'charts belong to the data components work',
  'charts/seat-chart.tsx': 'charts belong to the data components work',
  'charts/share-chart.tsx': 'charts belong to the data components work',
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.(stories|test)\./.test(name) ? [path] : [];
  });

const FILES = walk(SRC);
const key = (file: string) => relative(SRC, file).split(sep).join('/');

/** Curves written by hand, with comments removed so prose may name them. */
const curves = (source: string): string[] => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return code.match(/cubic-bezier\(/g) ?? [];
};

describe('script motion reads the motion tokens', () => {
  it('reads real files', () => {
    expect(FILES.length).toBeGreaterThan(150);
  });

  it('no component writes a curve by hand', () => {
    const bad = FILES.map(key).filter(
      (file) => file !== HOME && !(file in ALLOWED) && curves(readFileSync(join(SRC, file), 'utf8')).length > 0,
    );
    expect(bad).toEqual([]);
  });

  it('every allowed file still needs its place', () => {
    const stale = Object.keys(ALLOWED).filter((file) => curves(readFileSync(join(SRC, file), 'utf8')).length === 0);
    expect(stale).toEqual([]);
  });

  it('catches what it exists for', () => {
    expect(curves("el.animate(k, { easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })")).toHaveLength(1);
    expect(curves("const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';")).toHaveLength(1);
    expect(curves('// cubic-bezier(0.16, 1, 0.3, 1) in a comment is fine')).toHaveLength(0);
    expect(curves("el.animate(k, { easing: motionEase(el, 'enter') })")).toHaveLength(0);
  });

  it('reads the brand value from the element, and falls back to the defaults', () => {
    const el = document.createElement('div');
    document.body.append(el);
    expect(motionEase(el, 'enter')).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
    expect(motionDuration(el, 'slow')).toBe(400);

    el.style.setProperty('--ease-enter', 'linear');
    el.style.setProperty('--duration-slow', '0.6s');
    el.style.setProperty('--duration-medium', '.3s');
    el.style.setProperty('--duration-base', '180ms');
    el.style.setProperty('--duration-fast', 'soon');
    expect(motionEase(el, 'enter')).toBe('linear');
    expect(motionDuration(el, 'slow')).toBe(600);
    expect(motionDuration(el, 'medium')).toBe(300);
    expect(motionDuration(el, 'base')).toBe(180);
    expect(motionDuration(el, 'fast')).toBe(100);
    el.remove();
  });
});
