import { describe, expect, it } from 'vitest';

// Plain .mjs build script — `allowJs` in tsconfig.json covers `scripts/**`, so
// the signature is inferred from the source rather than declared.
import { hasUseClient } from '../../scripts/build-registry.mjs';

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
