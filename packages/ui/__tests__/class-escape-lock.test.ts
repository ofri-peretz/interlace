/**
 * Class Escape Lock
 *
 * Tailwind v4 scans source files as RAW TEXT, not evaluated JavaScript.
 * Writing an arbitrary-variant attribute selector with escaped quotes —
 * `'…[&_svg:not([class*=\'size-\'])]:size-4'` inside a single-quoted JS
 * string — puts literal backslashes into the scanned candidate, and the
 * emitted selector (`[class*=\\'size-\\']`) is invalid CSS. Turbopack
 * hard-fails the whole build: "Parsing CSS source code failed".
 *
 * This shipped: tabs.tsx used the escaped form and broke `next dev` for
 * the registry app (fixed 2026-07-31 by switching the outer string to
 * double quotes). The registry build also JSON-encodes component source
 * into `apps/registry/public/r/*.json` — which Tailwind ALSO scans — so
 * the fix must always be regenerated into the registry JSON. This lock
 * catches both surfaces at CI time instead of at dev-server-crash time.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative } from 'path';

const REPO_ROOT = resolve(__dirname, '../../..');

const SCAN_ROOTS = [
  resolve(__dirname, '../src'),
  join(REPO_ROOT, 'apps/registry/src'),
  join(REPO_ROOT, 'apps/registry/public/r'),
  join(REPO_ROOT, 'apps/storybook/src'),
  join(REPO_ROOT, 'apps/landing/src'),
];

// `class*=` (or any attribute selector) followed by a literal backslash —
// the escaped-quote form that emits invalid CSS. The correct forms are
// unquoted (`[class*=size-]`) or plainly-quoted inside a double-quoted
// JS string (`[class*='size-']`).
const ESCAPED_ATTR_RE = /class\*=\\+'/;

function walkSync(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) walkSync(full, out);
    else if (/\.(tsx?|json)$/.test(name)) out.push(full);
  }
  return out;
}

describe('class escape lock', () => {
  it('no escaped quotes inside arbitrary-variant attribute selectors', () => {
    const violations: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of walkSync(root)) {
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          if (ESCAPED_ATTR_RE.test(line)) {
            violations.push(`${relative(REPO_ROOT, file)}:${i + 1}`);
          }
        });
      }
    }
    expect(
      violations,
      `Escaped-quote attribute selectors found — these emit invalid CSS ` +
        `and hard-fail the Turbopack build. Use a double-quoted JS string ` +
        `so the selector reads [class*='size-'] with no backslashes. If ` +
        `the hit is in apps/registry/public/r/*.json, fix the SOURCE ` +
        `component and re-run scripts/build-registry.mjs.\n\n` +
        violations.join('\n'),
    ).toEqual([]);
  });
});
