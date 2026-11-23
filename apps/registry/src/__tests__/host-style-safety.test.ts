import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { compile } from '@tailwindcss/node';
import postcss, { type AtRule, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

/**
 * Installing a component must not restyle the app it is installed into.
 *
 * Every component depends on `interlace-base`, so whatever that item ships
 * lands in every adopter's app the moment they add their first button. This
 * test compiles a stock shadcn `globals.css` with Tailwind twice, once as the
 * app ships it and once with `base.css` imported, and asserts the app's own
 * utilities and element styles come out the same.
 *
 * What it does NOT cover, by design: `theme` (opt-in cssVars — it is meant to
 * change colours) and `interlace-foundation` (opt-in fonts + preflight — it is
 * meant to change the page). Those are choices an adopter makes by name.
 */

const STYLES_DIR = path.resolve(__dirname, '../../../../packages/ui/styles');

/**
 * `npx shadcn init` output for Tailwind v4, trimmed to what matters here: the
 * `@theme inline` registration, the radius derivation, and unlayered `:root` /
 * `.dark` values. Unlayered is the point — real apps write it that way.
 */
const SHADCN_GLOBALS = `
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`;

/**
 * Utilities a shadcn app already uses. Every one of these must compile to the
 * same rule, resolving the same theme variables, with Interlace installed.
 * Each family here has shipped a real collision at some point: named spacing
 * shadowed `max-w-*`, a replaced breakpoint ladder dropped `2xl:`, a radius
 * scale moved `rounded-*`, and `--font-sans` swapped the app's typeface.
 */
const HOST_UTILITIES = [
  // sizing that named spacing used to shadow
  'max-w-xs', 'max-w-sm', 'max-w-md', 'max-w-lg', 'max-w-xl', 'max-w-2xl', 'max-w-4xl',
  'w-sm', 'size-md', 'gap-4', 'p-6', 'space-y-8',
  // breakpoints
  'sm:flex', 'md:grid', 'lg:hidden', 'xl:block', '2xl:p-4', 'max-sm:hidden',
  // radius
  'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full',
  // type
  'font-sans', 'font-mono', 'font-serif', 'text-sm', 'text-base', 'text-lg', 'text-2xl',
  'leading-tight', 'tracking-tight', 'font-semibold',
  // colour
  'bg-background', 'text-foreground', 'bg-primary', 'text-primary-foreground',
  'bg-accent', 'border-border', 'ring-ring', 'bg-chart-1',
  // motion
  'animate-spin', 'animate-pulse', 'animate-accordion-down', 'ease-in-out', 'duration-200',
  // containers
  'container', '@container', '@md:flex',
];

/**
 * The one difference base is allowed to make, spelled out so it cannot grow.
 *
 * Tailwind builds `container` from every `--breakpoint-*` key, so adding the
 * `xs` rung (30rem) adds a 30rem max-width step to the host's `container`
 * between 480 and 640px. Expressing `xs:` as a custom variant instead would
 * keep `container` untouched, but Tailwind sorts custom variants AFTER the
 * built-in ladder, so `xs:p-4 sm:p-6` would let `xs` win above 640px: a real
 * ordering bug traded for a cosmetic one. The trade is documented on the
 * site's token-namespace section.
 */
const KNOWN_DIFFERENCES: Record<string, (before: string, after: string) => boolean> = {
  container: (before, after) =>
    after.replace(/\s*@media \(width >= 30rem\) \{\s*max-width: 30rem;\s*\}/, '') === before,
};

const compileApp = async (extraImport?: string) => {
  const css = extraImport
    ? SHADCN_GLOBALS.replace(
        '@custom-variant',
        `@import "${extraImport}";\n\n@custom-variant`,
      )
    : SHADCN_GLOBALS;
  const compiler = await compile(css, { base: STYLES_DIR, onDependency: () => {} });
  return compiler;
};

/** Every `--x: value` Tailwind emitted into its theme layer. */
const themeVars = (css: string) => {
  const vars = new Map<string, string>();
  postcss.parse(css).walkAtRules('layer', (layer) => {
    if (layer.params !== 'theme') return;
    layer.walkDecls(/^--/, (d) => void vars.set(d.prop, d.value));
  });
  return vars;
};

/** The rule a single utility compiled to, plus the theme vars it resolves. */
const resolveUtility = (css: string, vars: Map<string, string>) => {
  const root = postcss.parse(css);
  const rules: string[] = [];
  root.walkAtRules('layer', (layer) => {
    if (layer.params === 'utilities') rules.push(layer.toString());
  });
  const body = rules.join('\n');
  const used = new Map<string, string | undefined>();
  const seen = new Set<string>();
  const visit = (text: string) => {
    for (const [, name] of text.matchAll(/var\((--[\w-]+)/g)) {
      if (seen.has(name)) continue;
      seen.add(name);
      used.set(name, vars.get(name));
      const v = vars.get(name);
      if (v) visit(v);
    }
  };
  visit(body);
  return { body, used: Object.fromEntries([...used].sort()) };
};

const isInsideLayer = (node: Rule | AtRule) => {
  for (let p: { type: string; parent?: unknown } | undefined = node.parent; p; ) {
    if (p.type === 'atrule' && (p as AtRule).name === 'layer') return true;
    p = p.parent as typeof p;
  }
  return false;
};

/** Every declaration the app's OWN stylesheet sets, keyed by selector. */
const hostRules = (css: string) => {
  const out = new Set<string>();
  postcss.parse(css).walkRules((rule) => {
    // `0%` / `to` inside @keyframes are not selectors.
    if (rule.parent?.type === 'atrule' && /keyframes$/.test((rule.parent as AtRule).name)) return;
    rule.walkDecls((d) => void out.add(`${rule.selector}{${d.prop}}`));
  });
  return out;
};

describe('interlace-base leaves the host app alone', () => {
  it.each(HOST_UTILITIES)('`%s` compiles the same with interlace-base installed', async (utility) => {
    const [host, withBase] = await Promise.all([compileApp(), compileApp('./base.css')]);
    const a = host.build([utility]);
    const b = withBase.build([utility]);
    const before = resolveUtility(a, themeVars(a));
    const after = resolveUtility(b, themeVars(b));
    const allowed = KNOWN_DIFFERENCES[utility];
    if (allowed) {
      expect(after.used).toEqual(before.used);
      expect(allowed(before.body, after.body)).toBe(true);
      return;
    }
    expect(after).toEqual(before);
  });

  it('adds no element-level or global rule', async () => {
    const [host, withBase] = await Promise.all([compileApp(), compileApp('./base.css')]);
    const before = hostRules(host.build([]));
    const added = [...hostRules(withBase.build([]))].filter((r) => !before.has(r));

    // What base may add: custom properties (theme vars, brand + semantic
    // tokens) and rules scoped to its own class or attribute names. A bare
    // element selector, `*`, `:focus-visible` or `::selection` would restyle
    // the host, so none is allowed.
    const styling = added.filter((r) => !/\{--[\w-]+\}$/.test(r));
    const global = styling.filter((r) => {
      const selector = r.slice(0, r.indexOf('{'));
      return selector
        .split(',')
        .map((s) => s.trim())
        .some((s) => !/^[.[]/.test(s) && !/^:root$|^:host$/.test(s));
    });
    expect(global).toEqual([]);
  });

  it('never outranks a value the host declares', async () => {
    const withBase = (await compileApp('./base.css')).build([]);
    const hostDeclared = new Set<string>();
    postcss.parse(SHADCN_GLOBALS).walkRules((rule) => {
      if (isInsideLayer(rule)) return;
      rule.walkDecls(/^--/, (d) => void hostDeclared.add(`${rule.selector}|${d.prop}`));
    });

    // Base may re-declare a host variable (it binds `--primary` to its own
    // brand token for apps without one), but only inside a cascade layer:
    // the host's unlayered `:root` then wins, as it must.
    const unlayeredOverrides: string[] = [];
    const baseOnly = postcss.parse(withBase);
    baseOnly.walkRules((rule) => {
      if (isInsideLayer(rule)) return;
      for (const sel of rule.selector.split(',').map((s) => s.trim())) {
        rule.walkDecls(/^--/, (d) => {
          if (hostDeclared.has(`${sel}|${d.prop}`)) unlayeredOverrides.push(`${sel} ${d.prop}`);
        });
      }
    });
    // The host's own declarations appear once, unlayered, in its own source
    // order; anything beyond that count is base outranking it.
    const counts = new Map<string, number>();
    for (const k of unlayeredOverrides) counts.set(k, (counts.get(k) ?? 0) + 1);
    expect([...counts].filter(([, n]) => n > 1).map(([k]) => k)).toEqual([]);
  });

  it('lets components follow the host typeface', async () => {
    // `font-body` and `font-heading` are what components read. With base
    // alone, both must end at the host's own `--font-sans`, so a shadcn
    // app's typeface reaches Interlace components without configuration.
    const css = (await compileApp('./base.css')).build(['font-heading', 'font-body', 'font-sans']);
    const vars = themeVars(css);
    expect(vars.get('--font-heading')).toBe('var(--font-body)');
    expect(vars.get('--font-body')).toBe('var(--font-sans)');
    const host = themeVars((await compileApp()).build(['font-sans']));
    expect(vars.get('--font-sans')).toBe(host.get('--font-sans'));
  });

  it('ships a barrel that imports only additive files', async () => {
    const barrel = await readFile(path.join(STYLES_DIR, 'base.css'), 'utf8');
    const imports = [...barrel.matchAll(/@import\s+["']\.\/([^"']+)["']/g)].map((m) => m[1]);
    expect(imports).not.toContain('page/preflight.css');
    expect(imports).not.toContain('page/fonts.css');
    expect(imports).not.toContain('page/fumadocs.css');
  });
});
