/**
 * Registry CSS-variable contract lock.
 *
 * THE DEFECT THIS EXISTS FOR
 * --------------------------
 * `primitives/meteors.tsx` read `var(--color-meteor-glow)` in a
 * `shadow-[…]` utility, while `primitives/meteors.meta.json` declared the
 * token under `cssVars.light` / `cssVars.dark` as `meteor-glow`.
 *
 * Those are two different namespaces and nothing bridges them. `cssVars.light`
 * / `cssVars.dark` make the shadcn CLI write a plain `--meteor-glow` custom
 * property into `:root` / `.dark`. `--color-*` is the Tailwind v4 `@theme`
 * COLOR namespace, and only `@theme` — `cssVars.theme`, or an `@theme` block in
 * a stylesheet — puts a name in it. So on a stock install the shadow colour
 * substituted to nothing, the whole `box-shadow` was invalid at computed-value
 * time, and the meteor glow never painted.
 *
 * WHY NOTHING CAUGHT IT
 * ---------------------
 * Every symptom is an ABSENCE, and every gate we have looks for a presence:
 *
 *   - It type-checks. The name lives inside a string.
 *   - It builds. Tailwind emits `shadow-[0_0_2px_1px_var(--color-meteor-glow)]`
 *     happily; an undefined custom property is legal to reference.
 *   - It installs. `e2e-install.mjs` proves the item lands and compiles, not
 *     that its declared tokens are the ones it reads.
 *   - It renders. jsdom has no cascade, and a browser paints the element with
 *     one declaration silently dropped — there is no error and no missing box,
 *     only a rim that isn't there.
 *   - It looked right in-house. `apps/landing/.interlace/css/brand.css`
 *     hand-declares `--color-meteor-glow` itself, so the only broken path was
 *     the one a registry consumer takes.
 *
 * So the check has to be a source-level one, and it has to be general: the
 * failure is a NAMING rule ("a `--color-*` read must be theme-declared"), and a
 * rule that is only asserted about the one file that broke it is a bug report,
 * not a lock.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';

const SRC = resolve(__dirname, '../src');
const STYLES = resolve(__dirname, '../styles');

/**
 * Drop block and line comments before scanning.
 *
 * Load-bearing, and the reason is the same one `decorative-contract-lock`
 * records: these headers document the defects they fixed, so `meteors.tsx`
 * NAMES `--color-meteor-glow` twice while explaining why it no longer reads it.
 * A scanner that cannot tell a token from a sentence about a token fails on the
 * documentation of its own fix — the exact false "still broken" that a
 * `String.replace` harness produces.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function walk(dir: string, test: (f: string) => boolean, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, test, out);
    else if (test(name)) out.push(full);
  }
  return out;
}

const COMPONENTS = walk(SRC, (f) => /\.tsx$/.test(f) && !f.endsWith('.stories.tsx'));

/** Every `--name` this file DECLARES inline on an element it renders. */
function inlineDeclarations(code: string): Set<string> {
  const out = new Set<string>();
  // `"--color-from": colorFrom`, `'--trail': …`, `["--cloud-scale"]: …`,
  // `['--meteor-angle' as string]: …` — every shape used in this package.
  for (const m of code.matchAll(/["'](--[a-zA-Z0-9_-]+)["']/g)) out.add(m[1]);
  return out;
}

/**
 * Every `var(--name)` read with NO fallback. A `var(--x, y)` is optional by
 * construction — the author has already said what happens when it is absent —
 * so it is not this lock's business.
 */
function unguardedReads(code: string): Set<string> {
  const out = new Set<string>();
  for (const m of code.matchAll(/var\((--[a-zA-Z0-9_-]+)\s*\)/g)) out.add(m[1]);
  return out;
}

/** Names registered into Tailwind's `@theme` namespaces by our stylesheets. */
function themeDeclaredNames(): Set<string> {
  const out = new Set<string>();
  for (const file of readdirSync(STYLES).filter((f) => f.endsWith('.css'))) {
    const css = readFileSync(join(STYLES, file), 'utf8');
    for (const m of css.matchAll(/^\s*(--[a-zA-Z0-9_-]+)\s*:/gm)) out.add(m[1]);
  }
  return out;
}

/**
 * What a sibling `<name>.meta.json` actually puts on the page, expressed as the
 * custom-property names a consumer ends up with.
 *
 *   cssVars.theme  → `@theme` → `--<key>`   (so `--color-*` keys land here)
 *   cssVars.light  → `:root`  → `--<key>`
 *   cssVars.dark   → `.dark`  → `--<key>`
 *
 * The mapping is flat in every block: NOTHING re-prefixes a `light`/`dark` key
 * into the `--color-*` namespace. That is the whole defect in one sentence.
 */
function metaDeclaredNames(componentPath: string): Set<string> | null {
  const meta = join(
    dirname(componentPath),
    `${basename(componentPath, '.tsx')}.meta.json`,
  );
  let raw: string;
  try {
    raw = readFileSync(meta, 'utf8');
  } catch {
    return null;
  }
  const parsed = JSON.parse(raw) as {
    cssVars?: Record<string, Record<string, string>>;
  };
  const out = new Set<string>();
  for (const block of Object.values(parsed.cssVars ?? {})) {
    for (const key of Object.keys(block)) out.add(`--${key}`);
  }
  return out;
}

const rel = (p: string) => p.slice(SRC.length + 1);

describe('a `--color-*` read must be a name something registers in @theme', () => {
  const themeNames = themeDeclaredNames();

  it('parses the stylesheets it is about to check against', () => {
    // Every assertion below is a set lookup, and an empty set makes the
    // headline test fail LOUDLY rather than vacuously — but a set that parsed
    // only half the files would make it fail for the wrong reason. Pin that
    // the real palette is in hand.
    expect(themeNames.size).toBeGreaterThan(100);
    for (const known of ['--color-background', '--color-foreground', '--scrim-foreground']) {
      expect(themeNames.has(known), `stylesheets no longer declare ${known}`).toBe(true);
    }
  });

  it('finds the components it is about to scan', () => {
    expect(COMPONENTS.length).toBeGreaterThan(50);
  });

  it('has no component reading an unregistered --color-* name', () => {
    const offenders: string[] = [];

    for (const file of COMPONENTS) {
      const code = stripComments(readFileSync(file, 'utf8'));
      const inline = inlineDeclarations(code);
      const meta = metaDeclaredNames(file) ?? new Set<string>();

      for (const name of unguardedReads(code)) {
        if (!name.startsWith('--color-')) continue;
        // Three legitimate sources, in the order they are cheapest to verify:
        // the component sets it itself on the element (border-beam's
        // `--color-from`), a stylesheet registers it, or the item's own
        // `cssVars.theme` ships it.
        if (inline.has(name) || themeNames.has(name) || meta.has(name)) continue;
        offenders.push(
          `${rel(file)} reads ${name}, which nothing registers in @theme. ` +
            `A --color-* name comes from @theme / cssVars.theme ONLY; ` +
            `cssVars.light/dark write the BARE name. Read the bare name, or ` +
            `move the token to cssVars.theme.`,
        );
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});

describe('a component ships with a meta.json declaring the names it reads', () => {
  const withMeta = COMPONENTS.filter((f) => metaDeclaredNames(f) !== null);
  const themeNames = themeDeclaredNames();

  it('finds at least one component/meta pair', () => {
    // `meteors.meta.json` is currently the only one in the package. If it is
    // ever removed or renamed this suite would otherwise pass over an empty
    // list and report green while checking nothing.
    expect(withMeta.map(rel)).toContain('primitives/meteors.tsx');
  });

  it.each(withMeta.map((f) => [rel(f), f] as const))(
    '%s reads only names its meta or the stylesheets declare',
    (_name, file) => {
      const code = stripComments(readFileSync(file, 'utf8'));
      const inline = inlineDeclarations(code);
      const meta = metaDeclaredNames(file)!;

      const unresolved = [...unguardedReads(code)].filter(
        (n) => !inline.has(n) && !meta.has(n) && !themeNames.has(n),
      );

      expect(
        unresolved,
        `${rel(file)} reads ${unresolved.join(', ')} with no fallback, and ` +
          `neither the component, the stylesheets, nor its meta.json ` +
          `(${[...meta].join(', ') || 'nothing'}) declares it. On a stock ` +
          `install the declaration using it is dropped silently.`,
      ).toEqual([]);
    },
  );
});
