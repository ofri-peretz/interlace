/**
 * Collections answer to their container; chrome answers to the viewport.
 *
 * `container-collections.test.tsx` renders the grids that take `cols`. This
 * scans every component for a track count keyed to the viewport
 * (`md:grid-cols-2`), which puts two cards side by side in a 300px sidebar
 * because the window is wide. A collection uses a container variant
 * (`@md:grid-cols-2`) or intrinsic tracks (`repeat(auto-fit, …)`).
 *
 * Page chrome is listed by file, with its reason. Charts belong to the data
 * components work. The list may only shrink.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../src');

/** Every entry carries its reason. */
const ALLOWED: Record<string, string> = {
  'patterns/footer.tsx': 'site chrome: the footer spans the page, so the page width is its width',
  'patterns/hero.tsx': 'page chrome: the hero splits copy and media across the page',
  'charts/network-graph.tsx': 'charts belong to the data components work',
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.(stories|test)\./.test(name) ? [path] : [];
  });

const FILES = walk(SRC).map((file) => relative(SRC, file).split(sep).join('/'));

/** Viewport-keyed track counts, with comments removed so prose may name them. */
const viewportTracks = (source: string): string[] => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return code.match(/(?<![\w@-])(?:xs|sm|md|lg|xl|2xl):grid-cols-[^\s"'`]+/g) ?? [];
};

const read = (file: string) => readFileSync(join(SRC, file), 'utf8');

describe('collections size to their container', () => {
  it('reads real files', () => {
    expect(FILES.length).toBeGreaterThan(150);
  });

  it('no component keys a track count to the viewport', () => {
    const bad = FILES.filter((file) => !(file in ALLOWED)).flatMap((file) =>
      viewportTracks(read(file)).map((hit) => `${file}: ${hit}`),
    );
    expect(bad).toEqual([]);
  });

  it('every allowed file still needs its place', () => {
    const stale = Object.keys(ALLOWED).filter((file) => viewportTracks(read(file)).length === 0);
    expect(stale).toEqual([]);
  });

  it('catches what it exists for', () => {
    expect(viewportTracks("'grid grid-cols-1 md:grid-cols-2'")).toHaveLength(1);
    expect(viewportTracks('"xs:grid-cols-2 grid gap-2"')).toHaveLength(1);
    expect(viewportTracks("'md:grid-cols-[1fr_1fr]'")).toHaveLength(1);
    expect(viewportTracks("'grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-3'")).toHaveLength(0);
    expect(viewportTracks("'grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))]'")).toHaveLength(0);
    expect(viewportTracks('// md:grid-cols-2 in a comment is fine')).toHaveLength(0);
  });
});
