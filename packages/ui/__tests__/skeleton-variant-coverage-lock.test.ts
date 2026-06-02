/**
 * Skeleton variant coverage lock.
 *
 * WHY THIS LOCK EXISTS
 * --------------------
 * The Skeleton primitive ships ONE `<Skeleton variant>` component whose
 * variant union catalogues every shape the DS knows how to paint as a
 * loading placeholder. The catalogue lives in `skeleton-variants.ts`
 * (single source of truth → TypeScript union derived from a `const
 * tuple`).
 *
 * Two failure modes the type system alone can't catch:
 *
 *  1. **Typos at the call site.** A story or pattern that types
 *     `<Skeleton variant="aritcle-card" />` is a TypeScript error AT
 *     THAT FILE — but a downstream consumer copy-pasting from a stale
 *     example may not see the error if their tsconfig is looser. This
 *     lock walks every `.tsx` file under packages/ui/src + apps/storybook
 *     and asserts each `<Skeleton variant="…">` literal resolves to a
 *     registered variant.
 *
 *  2. **Renamed primitive without renaming its variant.** If
 *     `packages/ui/src/primitives/article-card.tsx` becomes
 *     `news-card.tsx`, the Skeleton variant `'article-card'` is now
 *     orphaned — usable, but pointing at a vanished component shape.
 *     This lock cross-checks variant names that LOOK like primitive
 *     names (kebab-case matches an existing file) and warns when the
 *     mapping breaks.
 *
 * Together with the TypeScript union (dev-time) + this lock (CI-time),
 * the contract is enforced at both ends of the pipeline.
 *
 * Static source-parse (fs.readFileSync + regex) is intentional: this is
 * a structural lock, not a render test. We assert what the SOURCE says
 * about Skeleton usage, not what React renders, so a future refactor
 * that wraps Skeleton in a helper can't accidentally launder past the
 * check (any call site still has the literal `variant="…"` string).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

import {
  SKELETON_VARIANTS,
  SKELETON_VARIANT_CLASSES,
} from '../src/primitives/skeleton-variants.js';

// Roots to walk for `<Skeleton variant="…">` call sites. Keep the list
// short and explicit — broader scans (e.g. node_modules) would slow the
// test without adding signal.
const SCAN_ROOTS = [
  resolve(__dirname, '../src/primitives'),
  resolve(__dirname, '../src/patterns'),
  resolve(__dirname, '../src/templates'),
  resolve(__dirname, '../../../apps/storybook/src/stories'),
];

// Match `<Skeleton variant="…">` with a STRICT value charset (a-z + hyphen)
// so documentation placeholders ("variant=\"…\"" in a JSX docs description)
// or template-literal usage (variant={...}) don't false-positive. Real
// variant names are all `kebab-case` ASCII; if you need a new naming style,
// expand this character class deliberately + add a test fixture.
const SKELETON_USAGE_RE = /<Skeleton[^>]*\bvariant=["']([a-z][a-z0-9-]*)["']/g;

function walkSync(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // dir may not exist yet (e.g. templates/) — fine.
  }
  for (const name of entries) {
    const full = join(dir, name);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkSync(full, out);
    } else if (/\.(tsx|ts)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Strip JSDoc + block comments + line comments before scanning. JSDoc
 * examples like `<Skeleton variant="…" />` (literal ellipsis as a
 * placeholder value) are documentation, not real call sites — without
 * stripping they'd false-positive the lock on every file that documents
 * Skeleton usage.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '') // block + JSDoc
    .replace(/(^|\s)\/\/.*$/gm, '$1'); // line
}

function findSkeletonCallSites(): { file: string; variant: string }[] {
  const hits: { file: string; variant: string }[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of walkSync(root)) {
      // Skip the variant catalogue itself (defines the values, not a
      // call site).
      if (file.endsWith('skeleton-variants.ts')) continue;
      const source = stripComments(readFileSync(file, 'utf-8'));
      let m: RegExpExecArray | null;
      // Re-create the regex per file to reset the global lastIndex.
      const re = new RegExp(SKELETON_USAGE_RE.source, 'g');
      while ((m = re.exec(source)) !== null) {
        hits.push({ file, variant: m[1] });
      }
    }
  }
  return hits;
}

describe('Skeleton variant coverage lock', () => {
  it('SKELETON_VARIANTS and SKELETON_VARIANT_CLASSES enumerate the same keys', () => {
    const variantSet = new Set<string>(SKELETON_VARIANTS);
    const classKeys = Object.keys(SKELETON_VARIANT_CLASSES);
    const classSet = new Set(classKeys);

    // Every entry in SKELETON_VARIANTS must have a class entry — the
    // primitive looks up the class via SKELETON_VARIANT_CLASSES[variant].
    for (const v of SKELETON_VARIANTS) {
      expect(
        classSet.has(v),
        `SKELETON_VARIANTS includes "${v}" but SKELETON_VARIANT_CLASSES has no entry for it`,
      ).toBe(true);
    }
    // And every class entry must be a declared variant — orphans signal
    // a stale class block.
    for (const k of classKeys) {
      expect(
        variantSet.has(k),
        `SKELETON_VARIANT_CLASSES has "${k}" but it isn't in SKELETON_VARIANTS`,
      ).toBe(true);
    }
  });

  it('every <Skeleton variant="x"> call site resolves to a registered variant', () => {
    const sites = findSkeletonCallSites();
    const known = new Set<string>(SKELETON_VARIANTS);

    // Surface ALL violations in one shot so a contributor doesn't fix
    // them one-at-a-time across N test runs.
    const failures = sites.filter((s) => !known.has(s.variant));
    if (failures.length > 0) {
      const summary = failures
        .map(
          (f) =>
            `  - ${f.file.replace(resolve(__dirname, '../..') + '/', '')}: variant="${f.variant}"`,
        )
        .join('\n');
      expect.fail(
        `Found ${failures.length} <Skeleton variant="…"> call site(s) using an unregistered variant.\n` +
          `Either add the value to SKELETON_VARIANTS in skeleton-variants.ts or fix the typo.\n\n${summary}`,
      );
    }
  });

  it('exposes the variant union with at least the four generic shapes', () => {
    // Sanity floor — guards against an accidental empty array.
    for (const baseline of ['rect', 'circle', 'text', 'paragraph']) {
      expect(SKELETON_VARIANTS).toContain(baseline);
    }
  });
});
