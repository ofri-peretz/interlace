/**
 * Templates ⇄ SectionBoundary lock.
 *
 * WHY THIS LOCK EXISTS
 * --------------------
 * A template that renders all-or-nothing is a regression — per
 * DESIGN_SYSTEM_LAYERS.md, every template MUST compose at least one
 * `<SectionBoundary>` so the page streams section-by-section instead of
 * blocking on the slowest data source. This lock asserts that
 * structural contract.
 *
 * The check is intentionally lightweight: walk
 * `packages/ui/src/templates/*.tsx`, read each file's source, and assert
 * it imports + uses `<SectionBoundary` at least once. A template that
 * renders direct children without boundaries fails the PR.
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
});
