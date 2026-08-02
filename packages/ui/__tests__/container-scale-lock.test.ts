/**
 * Container Scale Lock
 *
 * LAYOUT_PHILOSOPHY §2 / DESIGN_PRINCIPLES §5: container widths come from
 * FOUR sizes only — `max-w-prose` (65ch) · `max-w-content` (64rem) ·
 * `max-w-wide` (80rem) · full (no utility). Ad-hoc Tailwind containers
 * (`max-w-3xl`, `max-w-6xl`, …) are forbidden in DS + consumer code.
 *
 * `max-w-float` (--container-float, 420px) is a FIFTH token but NOT part of
 * that ladder: it sizes detached chrome that docks to a viewport edge (the
 * toast stack), never a page section. Kept as a token rather than
 * `max-w-[420px]` at the call site so every edge-docked surface agrees on
 * one number — see foundation.css.
 *
 * This is not just style policing — the named subset is BROKEN here:
 * `foundation.css` defines `--spacing-xs…2xl` in `@theme`, and Tailwind v4
 * resolves named sizing values against the spacing namespace before the
 * container scale. So `max-w-sm` emits `max-width: var(--spacing-sm)` =
 * **16px**, `max-w-2xl` = **96px**, etc. This shipped real bugs: 96px hero
 * paragraphs on ds.interlace.tools, 40px dialogs, 16px sheets (fixed
 * 2026-07-31). Numeric widths (`max-w-96` = 24rem) stay allowed — the
 * numeric spacing scale is untouched by the named keys.
 *
 * Scope: packages/ui + apps/registry + apps/storybook (everything that
 * imports the DS styles). apps/landing joins when it adopts `@interlace/ui`
 * (DESIGN-SYSTEM-PLAN Phase 3.2) — today it runs stock Tailwind containers
 * where these utilities still work.
 *
 * Static source-parse on className-bearing lines only, so prose mentions
 * of the forbidden utilities (docs, comments, story descriptions) don't
 * false-positive.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative } from 'path';

const REPO_ROOT = resolve(__dirname, '../../..');

const SCAN_ROOTS = [
  resolve(__dirname, '../src'),
  join(REPO_ROOT, 'apps/registry/src'),
  join(REPO_ROOT, 'apps/storybook/src'),
];

// Named scale keys that must never appear on sizing utilities. `xs…2xl`
// are spacing-shadowed (broken); `3xl…7xl` work but violate the
// four-size contract.
const FORBIDDEN_RE =
  /\b(?:max-w|min-w)-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\b/;

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
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe('container scale lock', () => {
  it('no ad-hoc max-w-* / min-w-* named scale in DS or consumer code', () => {
    const violations: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of walkSync(root)) {
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          // Only className-bearing lines — doc comments and story
          // descriptions may legitimately NAME the forbidden utilities.
          if (!/className/.test(line)) return;
          const m = line.match(FORBIDDEN_RE);
          if (m) {
            violations.push(
              `${relative(REPO_ROOT, file)}:${i + 1} → ${m[0]}`,
            );
          }
        });
      }
    }
    expect(
      violations,
      `Ad-hoc container utilities found. Use the DS scale instead:\n` +
        `  reading column → max-w-prose (65ch)\n` +
        `  section        → max-w-content (64rem)\n` +
        `  card grid      → max-w-wide (80rem)\n` +
        `  component cap  → numeric (max-w-96 = 24rem) or max-w-(--container-prose)\n` +
        `NOTE: max-w-xs…2xl silently resolve to --spacing-* (8–96px!) here — ` +
        `see the header of this file.\n\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
