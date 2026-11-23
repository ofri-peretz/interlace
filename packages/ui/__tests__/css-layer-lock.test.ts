/**
 * CSS layer lock.
 *
 * WHY THIS LOCK EXISTS
 * --------------------
 * `packages/ui/styles/` is four directories, and each may read only the one
 * before it:
 *
 *   brand/       raw `--interlace-*` values           @layer interlace.brand
 *   semantics    semantic names bound to brand values  @layer interlace.semantics
 *   structure/   type, layout, radius, motion          @theme + Tailwind layers
 *   page/        opt-in page styling                   Tailwind `base` + bridge
 *
 * A tree only stays a tree if something says no. Each rule below is a way
 * the layers used to leak:
 *
 *   - brand files carried semantic bindings, so re-branding meant editing
 *     the alias graph;
 *   - structure files carried colour, so Harbor and Interlace drifted apart
 *     on "invariant" scales;
 *   - preflight sat in a custom layer ranked ABOVE Tailwind's utilities, so
 *     `img { height: auto }` beat a call-site `h-10`.
 *
 * The last one is the cascade rule: Tailwind declares `theme, base,
 * components, utilities` first, so any custom layer declared after it
 * outranks every utility. Interlace's three named layers are safe there only
 * because they hold custom properties and nothing else. A rule that styles
 * an element belongs in `base` or `components`, where a utility wins.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, relative, resolve } from 'path';

import postcss, { type AtRule, type ChildNode, type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const STYLES = resolve(__dirname, '../styles');

const read = (rel: string) => readFileSync(join(STYLES, rel), 'utf8');
const list = (dir: string) =>
  readdirSync(join(STYLES, dir))
    .filter((f) => f.endsWith('.css'))
    .map((f) => `${dir}/${f}`);

const BRAND = list('brand');
const STRUCTURE = list('structure');
const PAGE = list('page');

/** The custom layers Interlace declares. Each ranks above utilities. */
const NAMED_LAYERS = ['interlace.bridge', 'interlace.brand', 'interlace.semantics'];
/** Tailwind's own layers: a rule here loses to any utility. */
const TAILWIND_LAYERS = new Set(['base', 'components']);

/** The chain of `@layer` names a node sits inside, innermost last. */
const layersOf = (node: ChildNode) => {
  const out: string[] = [];
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent as typeof p) {
    if (p.type === 'atrule' && (p as AtRule).name === 'layer') out.unshift((p as AtRule).params);
  }
  return out;
};

const insideAtRule = (node: ChildNode, name: RegExp) => {
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent as typeof p) {
    if (p.type === 'atrule' && name.test((p as AtRule).name)) return true;
  }
  return false;
};

/** Every declaration in a file, with where it sits. */
const decls = (rel: string) => {
  const out: Array<{ decl: Declaration; layers: string[]; inTheme: boolean }> = [];
  postcss.parse(read(rel)).walkDecls((decl) => {
    out.push({ decl, layers: layersOf(decl), inTheme: insideAtRule(decl, /^theme$/) });
  });
  return out;
};

/** Every style rule (not a keyframe step) in a file. */
const rules = (rel: string) => {
  const out: Rule[] = [];
  postcss.parse(read(rel)).walkRules((rule) => {
    if (insideAtRule(rule, /keyframes$/)) return;
    out.push(rule);
  });
  return out;
};

/**
 * Files allowed to put rules in Tailwind's `utilities` layer, named so the
 * list cannot grow quietly. page/fumadocs.css overrides fumadocs' own
 * utility classes (TOC rail, `prose` inside remote markdown); it needs to
 * tie with them on layer and win on specificity. It is opt-in page styling,
 * never shipped with a component.
 */
const UTILITIES_ON_PURPOSE = new Set(['page/fumadocs.css']);

const COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/i;

describe('styles/ is four layers', () => {
  it('has exactly the four directories and two barrels', () => {
    const top = readdirSync(STYLES).sort();
    expect(top).toEqual(['base.css', 'brand', 'index.css', 'page', 'semantics.css', 'structure']);
  });

  it('declares the same named layers, in order, in both barrels', () => {
    const statement = `@layer ${NAMED_LAYERS.join(', ')};`;
    expect(read('base.css')).toContain(statement);
    expect(read('index.css')).toContain(statement);
  });

  it('base.css imports brand, then semantics, then structure, and never page', () => {
    const imports = [...read('base.css').matchAll(/@import\s+"\.\/([^"]+)"/g)].map((m) => m[1]);
    const rank = (f: string) =>
      f.startsWith('brand/') ? 1 : f === 'semantics.css' ? 2 : f.startsWith('structure/') ? 3 : 4;
    expect(imports.map(rank)).toEqual([...imports.map(rank)].sort());
    expect(imports.filter((f) => rank(f) === 4)).toEqual([]);
    expect(new Set(imports)).toEqual(new Set([...BRAND, 'semantics.css', ...STRUCTURE]));
  });

  it('index.css is base plus every page file', () => {
    const imports = [...read('index.css').matchAll(/@import\s+"\.\/([^"]+)"/g)].map((m) => m[1]);
    expect(imports[0]).toBe('base.css');
    expect(new Set(imports.slice(1))).toEqual(new Set(PAGE));
  });
});

describe('brand/', () => {
  it.each(BRAND)('%s declares only --interlace-* tokens, inside interlace.brand', (file) => {
    const bad = decls(file)
      .filter(({ decl, layers }) => !decl.prop.startsWith('--interlace-') || layers.join() !== 'interlace.brand')
      .map(({ decl, layers }) => `${decl.prop} in [${layers.join(' > ')}]`);
    expect(bad).toEqual([]);
  });
});

describe('semantics.css', () => {
  const all = decls('semantics.css');

  it('binds every layered name to a brand token or another binding, never a literal', () => {
    const bad = all
      .filter(({ inTheme }) => !inTheme)
      .filter(({ decl, layers }) => layers.join() !== 'interlace.semantics' || COLOUR.test(decl.value))
      .map(({ decl }) => `${decl.prop}: ${decl.value}`);
    expect(bad).toEqual([]);
  });

  it('declares no --interlace-* value of its own', () => {
    expect(all.filter(({ decl }) => decl.prop.startsWith('--interlace-')).map(({ decl }) => decl.prop)).toEqual([]);
  });

  it('registers Tailwind colours only as var() aliases', () => {
    const bad = all
      .filter(({ inTheme }) => inTheme)
      .filter(({ decl }) => !/^var\(--[\w-]+\)$/.test(decl.value.trim()))
      .map(({ decl }) => `${decl.prop}: ${decl.value}`);
    expect(bad).toEqual([]);
  });
});

describe('structure/', () => {
  it.each(STRUCTURE)('%s mentions no colour and no brand token', (file) => {
    const bad = decls(file)
      .filter(({ decl }) => decl.prop.startsWith('--interlace-') || /--interlace-/.test(decl.value) || COLOUR.test(decl.value))
      .map(({ decl }) => `${decl.prop}: ${decl.value}`);
    expect(bad).toEqual([]);
  });

  it.each(STRUCTURE)('%s styles no bare element', (file) => {
    // Structure ships with every component, so it may style its own
    // classes and attributes, never the host's elements.
    const bad = rules(file)
      .flatMap((r) => r.selector.split(',').map((s) => s.trim()))
      .filter((s) => !/^[.[]/.test(s) && !/^:root$|^&/.test(s));
    expect(bad).toEqual([]);
  });
});

describe('the cascade: a utility always beats an Interlace rule', () => {
  const files = [...BRAND, 'semantics.css', ...STRUCTURE, ...PAGE];

  it.each(files)('%s puts every non-custom-property rule in a Tailwind layer', (file) => {
    // `--x` custom properties may live in the named layers: they only set
    // values that utilities read. Anything else in a named layer, or
    // unlayered, would outrank the call site.
    const bad = decls(file)
      .filter(({ decl, inTheme }) => !decl.prop.startsWith('--') && !inTheme)
      .filter(({ decl }) => !insideAtRule(decl, /keyframes$/))
      .filter(({ layers }) => !layers.some((l) => TAILWIND_LAYERS.has(l) || (UTILITIES_ON_PURPOSE.has(file) && l === 'utilities')))
      .map(({ decl, layers }) => `${(decl.parent as Rule).selector ?? '?'} { ${decl.prop} } in [${layers.join(' > ') || 'unlayered'}]`);
    expect(bad).toEqual([]);
  });
});

// Guard the guard: a refactor that empties the tree would pass every test.
describe('the lock reads real files', () => {
  it('finds tokens in every layer', () => {
    expect(BRAND.length).toBeGreaterThan(0);
    expect(STRUCTURE.length).toBeGreaterThan(0);
    expect(PAGE.length).toBeGreaterThan(0);
    expect(decls('brand/interlace.css').length).toBeGreaterThan(50);
    expect(decls('semantics.css').length).toBeGreaterThan(50);
    expect(relative(STYLES, join(STYLES, 'semantics.css'))).toBe('semantics.css');
  });
});
