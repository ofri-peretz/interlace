/*
 * Every registry-item URL is built by `itemUrl`, never by a template literal.
 *
 * `itemUrl` strips the `@interlace/` alias — the alias the whole CLI premise
 * rests on. `add` routed through it; `info` built its URL inline, so
 * `interlace-ui info @interlace/button` requested
 * `/r/@interlace/button.json` and 404'd. One rule with two implementations,
 * and only one of them knew about the alias.
 *
 * `itemUrl`'s own behaviour is covered in plan.test.ts. This is the other
 * half: that the code actually calls it.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src',
);
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf-8');

describe('registry-item URLs have exactly one construction site', () => {
  it('info resolves through itemUrl', () => {
    expect(read('index.ts')).toMatch(/itemUrl\(\s*plan\.registry,\s*plan\.name/);
  });

  it('no source builds an item URL with a template literal', () => {
    // The exact shape of the bug: `/r/` + an interpolation + `.json`, which
    // silently keeps whatever prefix the caller typed.
    const offenders = ['index.ts', 'plan.ts']
      .map((f) => [f, read(f)] as const)
      .filter(([, src]) =>
        // `itemUrl`'s own body is the one legal place to write it.
        src
          .replace(/export const itemUrl[\s\S]*?\n\};/, '')
          .match(/\/r\/\$\{[^}]+\}\.json/),
      )
      .map(([f]) => f);

    expect(offenders).toEqual([]);
  });
});
