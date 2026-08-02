/**
 * Templates ⇄ SectionBoundary + page-skeleton lock.
 *
 * WHY THIS LOCK EXISTS
 * --------------------
 * A template that renders all-or-nothing is a regression — per
 * DESIGN_SYSTEM_LAYERS.md, every template MUST compose at least one
 * `<SectionBoundary>` so the page streams section-by-section instead of
 * blocking on the slowest data source. This lock asserts that
 * structural contract.
 *
 * The second half of the contract (templates/README.md #4): a template
 * ships its OWN page-level loading state — `<XTemplate.Skeleton />`
 * paints the full-page silhouette, not a single rect. Without it a
 * consumer's `loading.tsx` has nothing shaped like the page to render,
 * and the first paint costs a full-page layout shift (R23).
 *
 * The check is intentionally lightweight: walk
 * `packages/ui/src/templates/*.tsx`, read each file's source, and assert
 * it imports + uses `<SectionBoundary` at least once AND assigns a
 * `<Component>.Skeleton` static. A template that renders direct children
 * without boundaries — or has no page skeleton — fails the PR.
 *
 * When the templates/ folder is empty (pre-Phase-4 state) the lock is a
 * no-op — there are no templates to enforce against.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, join } from 'path';

const TEMPLATES_DIR = resolve(__dirname, '../src/templates');

function listTemplateFiles(): string[] {
  let entries: string[];
  try {
    entries = readdirSync(TEMPLATES_DIR);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => join(TEMPLATES_DIR, name))
    .filter((full) => {
      try {
        return statSync(full).isFile();
      } catch {
        return false;
      }
    });
}

const SECTION_BOUNDARY_IMPORT_RE =
  /from\s+['"]\.\.\/primitives\/section-boundary(\.js)?['"]|from\s+['"]@interlace\/ui\/section-boundary['"]/;

const SECTION_BOUNDARY_USAGE_RE = /<SectionBoundary[\s>]/;

/** `<Component>.Skeleton = <Component>Skeleton;` — the page-level loading state. */
const PAGE_SKELETON_RE = /^(\w+)\.Skeleton\s*=\s*\w+;/m;

describe('Templates ⇄ SectionBoundary lock', () => {
  const templates = listTemplateFiles();

  it('every template under packages/ui/src/templates composes a SectionBoundary', () => {
    if (templates.length === 0) {
      // No-op before Phase 4 ships templates. The directory exists with
      // a README explaining the contract; once .tsx files land here, the
      // assertion below activates.
      return;
    }

    const failures: string[] = [];
    for (const file of templates) {
      const source = readFileSync(file, 'utf-8');
      const hasImport = SECTION_BOUNDARY_IMPORT_RE.test(source);
      const hasUsage = SECTION_BOUNDARY_USAGE_RE.test(source);
      if (!hasImport || !hasUsage) {
        failures.push(
          `${file.replace(resolve(__dirname, '../..') + '/', '')}: ` +
            `${hasImport ? '' : 'missing SectionBoundary import. '}` +
            `${hasUsage ? '' : 'no <SectionBoundary> usage found in source. '}`,
        );
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('every template ships a page-level `<X.Skeleton>` static', () => {
    if (templates.length === 0) return;

    const failures: string[] = [];
    for (const file of templates) {
      const source = readFileSync(file, 'utf-8');
      const match = source.match(PAGE_SKELETON_RE);
      if (!match) {
        failures.push(
          `${file.replace(resolve(__dirname, '../..') + '/', '')}: no ` +
            `\`<Component>.Skeleton = …\` assignment. Add a page-level ` +
            `skeleton (templates/README.md contract #4) — the full-page ` +
            `silhouette, not a single rect.`,
        );
        continue;
      }
      // The skeleton must hang off the template itself, not some helper.
      const [, owner] = match;
      if (!new RegExp(`^export\\s*{\\s*${owner}\\b`, 'm').test(source)) {
        failures.push(
          `${file.replace(resolve(__dirname, '../..') + '/', '')}: ` +
            `\`${owner}.Skeleton\` is assigned but \`${owner}\` is not the ` +
            `exported template.`,
        );
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });
});
