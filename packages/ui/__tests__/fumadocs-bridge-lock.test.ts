/**
 * Fumadocs coexistence lock — the bridge layer is the ONLY seam.
 *
 * WHY THIS LOCK EXISTS
 * --------------------
 * The DS ships into two kinds of app: plain React/Next sites, and
 * fumadocs docs sites. Both get the same components. The way that works
 * is `packages/ui/styles/theme.css` (`@layer interlace.bridge`), which
 * aliases fumadocs' `--color-fd-*` family onto the bare shadcn token
 * names our components are styled against. See FUMADOCS_BRIDGE.md.
 *
 * Two regressions kill that contract, and neither shows up at runtime in
 * a docs app — the only place they surface is a NON-fumadocs consumer,
 * i.e. after someone has already adopted the DS:
 *
 *  1. **A DS component imports `fumadocs-ui`.** The component now drags
 *     a docs-framework dependency (and its CSS assumptions) into every
 *     consumer. `fumadocs-ui` is a UI layer that competes with ours;
 *     importing it inverts the relationship — fumadocs pages consume DS
 *     components, never the reverse.
 *
 *  2. **A DS component styles itself with `*-fd-*` utility classes**
 *     (`bg-fd-card`, `text-fd-muted-foreground`). Those resolve only
 *     when fumadocs' CSS is loaded; outside a docs app they render
 *     unstyled/transparent. The bridge exists precisely so components
 *     can use the plain token (`bg-card`) and still get fumadocs' value
 *     inside a docs app.
 *
 * ALLOWED SURFACE — `packages/ui/src/fumadocs/`
 * ---------------------------------------------
 * The adapter directory is the one place that may import from the
 * fumadocs npm namespace, and only from the headless `fumadocs-core/*`
 * entrypoints (TOC anchors, page-tree types) — never `fumadocs-ui`.
 * These are behavior/data APIs with no styling opinion, which is what
 * makes them safe: the adapter borrows fumadocs' logic, never its chrome.
 * Adding a new entrypoint is a deliberate act — extend
 * `ALLOWED_FUMADOCS_IMPORTS` below in the same PR that needs it, and say
 * why in FUMADOCS_BRIDGE.md.
 *
 * Static source-parse (fs + regex) is intentional: this is a structural
 * lock, not a render test.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative } from 'path';

const SRC_DIR = resolve(__dirname, '../src');
const ADAPTER_DIR = resolve(SRC_DIR, 'fumadocs');
const PKG_ROOT = resolve(__dirname, '..');

/**
 * The complete set of fumadocs module specifiers `src/fumadocs/*` may
 * import. Headless only — anything under `fumadocs-ui` is banned
 * everywhere, adapter included.
 */
const ALLOWED_FUMADOCS_IMPORTS = new Set(['fumadocs-core/toc']);

/** `import … from 'x'` / `export … from 'x'` / `import('x')`. */
const MODULE_SPECIFIER_RE =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

/** `bg-fd-card`, `text-fd-muted-foreground/40`, `hover:border-fd-border`. */
const FD_UTILITY_CLASS_RE = /\b[a-z][a-z-]*-fd-[a-z][a-z0-9-]*/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const rel = (file: string) => relative(PKG_ROOT, file);

/**
 * Strip comments before scanning. A JSDoc that names the banned shape
 * ("migrated from `bg-fd-card` to `bg-card`") is documentation, not a
 * violation — and every rule below is about what the code DOES.
 * Doc-comments explaining the bridge are exactly what we want authors to
 * write, so they must not fail the lock.
 */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const sourceFiles = walk(SRC_DIR);

describe('fumadocs coexistence — bridge is the only seam', () => {
  it('has source files to check (guards against a silently empty walk)', () => {
    expect(sourceFiles.length).toBeGreaterThan(50);
  });

  it('no file under packages/ui/src imports fumadocs-ui', () => {
    const failures: string[] = [];
    for (const file of sourceFiles) {
      const source = stripComments(readFileSync(file, 'utf-8'));
      for (const [, specifier] of source.matchAll(MODULE_SPECIFIER_RE)) {
        if (/^fumadocs-ui(\/|$)/.test(specifier)) {
          failures.push(`${rel(file)} imports '${specifier}'`);
        }
      }
    }

    expect(
      failures,
      `DS components must never import fumadocs-ui — fumadocs pages consume ` +
        `DS components, not the reverse. See FUMADOCS_BRIDGE.md.\n` +
        failures.join('\n'),
    ).toEqual([]);
  });

  it('only src/fumadocs/ imports the fumadocs namespace, and only allowed entrypoints', () => {
    const failures: string[] = [];
    for (const file of sourceFiles) {
      const inAdapter = file.startsWith(ADAPTER_DIR + '/');
      const source = stripComments(readFileSync(file, 'utf-8'));
      for (const [, specifier] of source.matchAll(MODULE_SPECIFIER_RE)) {
        if (!/^fumadocs/.test(specifier)) continue;
        if (!inAdapter) {
          failures.push(
            `${rel(file)} imports '${specifier}' — only src/fumadocs/ may ` +
              `talk to fumadocs directly.`,
          );
        } else if (!ALLOWED_FUMADOCS_IMPORTS.has(specifier)) {
          failures.push(
            `${rel(file)} imports '${specifier}' — not in the adapter's ` +
              `allowed surface (${[...ALLOWED_FUMADOCS_IMPORTS].join(', ')}). ` +
              `Extend ALLOWED_FUMADOCS_IMPORTS + FUMADOCS_BRIDGE.md deliberately.`,
          );
        }
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('no component styles itself with `*-fd-*` utility classes', () => {
    const failures: string[] = [];
    for (const file of sourceFiles) {
      const source = stripComments(readFileSync(file, 'utf-8'));
      const hits = [...new Set(source.match(FD_UTILITY_CLASS_RE) ?? [])];
      if (hits.length) {
        failures.push(`${rel(file)}: ${hits.join(', ')}`);
      }
    }

    expect(
      failures,
      `Use the bare DS token (bg-card, text-muted-foreground). The bridge ` +
        `layer maps it to the fumadocs value inside a docs app; the fd-\n` +
        `prefixed class renders unstyled everywhere else.\n` +
        failures.join('\n'),
    ).toEqual([]);
  });
});

describe('fumadocs coexistence — the bridge file itself', () => {
  const themeCss = readFileSync(resolve(PKG_ROOT, 'styles/theme.css'), 'utf-8');

  it('theme.css wraps the token aliases in `@layer interlace.bridge`', () => {
    expect(themeCss).toMatch(/@layer\s+interlace\.bridge\s*\{/);
  });

  it('theme.css maps the shadcn surface tokens onto `--color-fd-*`', () => {
    // The load-bearing subset: if any of these stops being bridged, DS
    // components render unstyled inside a fumadocs app.
    for (const token of [
      'background',
      'foreground',
      'card',
      'popover',
      'muted',
      'muted-foreground',
      'accent',
      'border',
      'ring',
    ]) {
      expect(themeCss, `--${token} is not bridged in theme.css`).toContain(
        `--${token}: var(--color-fd-${token});`,
      );
    }
  });

  it('theme.css is the only stylesheet that reads `--color-fd-*` values', () => {
    // interlace-theme.css may WRITE --color-fd-* (pushing brand values
    // into fumadocs' own surface); reading them is the bridge's job.
    const offenders: string[] = [];
    for (const name of readdirSync(resolve(PKG_ROOT, 'styles'))) {
      if (!name.endsWith('.css') || name === 'theme.css') continue;
      // Comments explain the bridge all over these files — strip them so
      // documentation can't trip the lock.
      const css = readFileSync(
        resolve(PKG_ROOT, 'styles', name),
        'utf-8',
      ).replace(/\/\*[\s\S]*?\*\//g, '');
      if (/var\(\s*--color-fd-/.test(css)) offenders.push(`styles/${name}`);
    }

    expect(
      offenders,
      `Only styles/theme.css may read fumadocs tokens — it IS the bridge.\n` +
        offenders.join('\n'),
    ).toEqual([]);
  });
});
