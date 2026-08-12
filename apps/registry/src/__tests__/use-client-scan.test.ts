import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Plain .mjs build script — `allowJs` in tsconfig.json covers `scripts/**`, so
// the signature is inferred from the source rather than declared.
import { hasUseClient } from '../../scripts/build-registry.mjs';

const REGISTRY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const REPO_ROOT = path.resolve(REGISTRY_ROOT, '../..');

/**
 * `hasUseClient` decides the `client` flag published in each registry item's
 * `meta` — the RSC boundary a consumer can't infer without parsing the source.
 *
 * It replaced a regex whose nested quantifiers backtracked exponentially on
 * `*//*` repetitions (CodeQL js/redos). The regex also carried `/m`, so it
 * matched `'use client'` on ANY line — including after an import, where the
 * directive is inert and ignored by bundlers. The scan requires it to be the
 * first statement, so the two disagree on that one input; that difference is
 * locked below deliberately.
 */
describe('hasUseClient', () => {
  it.each([
    ["'use client';\nexport const X = 1;", 'bare directive'],
    ['"use client";\n', 'double quotes'],
    ["\n\n  'use client';", 'leading whitespace'],
    ["/* banner */\n'use client';", 'after a block comment'],
    ["// note\n'use client';", 'after a line comment'],
    ["/* a */ // b\n'use client';", 'after mixed comments'],
    ["/* multi\n * line\n */\n'use client';", 'after a multi-line comment'],
  ])('detects the directive %#: %s', (source) => {
    expect(hasUseClient(source)).toBe(true);
  });

  it.each([
    ['export const X = 1;', 'no directive'],
    ['/* only a comment */', 'comment only'],
    ['/* unterminated', 'unterminated block comment'],
    ["'use strict';\n", 'a different directive'],
  ])('rejects %#: %s', (source) => {
    expect(hasUseClient(source)).toBe(false);
  });

  it('rejects a directive that is not the first statement', () => {
    // The old /m regex returned true here. Bundlers ignore the directive in
    // this position, so `client: true` would have been wrong.
    expect(hasUseClient("import x from 'y';\n'use client';")).toBe(false);
  });

  it('does not backtrack on pathological comment input', () => {
    // Exponential for the old regex; linear for the scan.
    const evil = `/*${'*//*'.repeat(40)}\nexport const X = 1;`;
    const started = Date.now();
    expect(hasUseClient(evil)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

/**
 * The tests above prove `hasUseClient` reads a directive correctly. They say
 * nothing about whether any particular file SHOULD have one — so a `'use
 * client'` added to a server-safe primitive produced a `meta.client: true`
 * that was faithfully derived, correctly published, and wrong.
 *
 * That is not hypothetical. `badge.tsx` carried a directive justified in its
 * own header as "Required — `useRender` is a hook". It was not required:
 * `@base-ui/react/use-render` ships no directive of its own and takes a
 * no-hook path when `document` is undefined, which is why the four siblings
 * below call the same thing without one. A server component rendering
 * `<Badge>` (default, `render={<a/>}`, and `loading`) prerenders under
 * `next build` with exit 0 and emits `data-slot="badge"` in the HTML.
 *
 * So this list is the per-file rule nothing else encodes. Adding `'use
 * client'` to one of these files fails here rather than silently costing
 * every server tree that renders one a client boundary.
 *
 * To add a file: prove it first the way badge was proved — a server component
 * in an App Router page, `next build`, markup in the emitted HTML. A file
 * that genuinely needs client state does not belong on this list; drop it
 * instead and let `meta.client: true` be the honest answer.
 */
const RSC_SAFE = [
  'badge',
  'stack',
  'container',
  'box',
  'typography',
  'skeleton',
];

describe('RSC-safe primitives stay server components', () => {
  it.each(RSC_SAFE)('%s declares no `use client`', (name) => {
    const source = readFileSync(
      path.join(REPO_ROOT, 'packages/ui/src/primitives', `${name}.tsx`),
      'utf8',
    );
    expect(hasUseClient(source)).toBe(false);
  });

  it.each(RSC_SAFE)('%s is published with `meta.client: false`', (name) => {
    const item = JSON.parse(
      readFileSync(path.join(REGISTRY_ROOT, 'public/r', `${name}.json`), 'utf8'),
    );
    expect(item.meta.client).toBe(false);
  });
});
