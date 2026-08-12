import type { Metadata } from 'next';
import Link from 'next/link';

import { THEMES, THEME_TOKENS } from '@interlace/ui/theme-tokens';

import { SiteNav } from '@/components/site-nav';
import { TokenNamespaceReference } from '@/components/token-namespace';

export const metadata: Metadata = {
  title: 'Theme Authoring',
  description:
    'How to add a theme to the Interlace DS: the two-axis selector matrix, the token manifest every theme must satisfy, the contract lock that refuses an incomplete one, and how contrast is measured rather than eyeballed.',
  openGraph: {
    title: 'Theme Authoring — Interlace DS',
    description:
      'Fork the brand by overriding @layer interlace.brand, or register a real theme on the [data-theme] axis. Machine-checked either way.',
    url: 'https://ds.interlace.tools/theme-authoring',
  },
};

/** The default theme — `:root`, and the one with no `[data-theme]` selector. */
const DEFAULT = THEMES.find((theme) => theme.default)!;
const REGISTERED = THEMES.filter((theme) => !theme.default);

/**
 * The manifest, grouped for reading only.
 *
 * The GROUPS are presentational; the LIST is `THEME_TOKENS` itself, and the
 * last bucket catches anything a future token adds so a new prefix shows up
 * on this page instead of quietly vanishing from it. The count below is
 * `THEME_TOKENS.length` for the same reason — a hand-typed "55" is a number
 * that goes stale on the first token added and lies convincingly.
 */
const GROUPS: ReadonlyArray<{ title: string; note: string; match: RegExp }> = [
  {
    title: 'Brand',
    note: 'the identity pair and its states',
    match: /^(primary|brand-mark)/,
  },
  {
    title: 'Surfaces & text',
    note: 'every plane a component can paint on, and what is legible on it',
    match: /^(background|foreground|card|popover|muted|border|input|ring|accent|secondary)/,
  },
  {
    title: 'Status',
    note: 'the semantic tones — each with the foreground that sits on it',
    match: /^(destructive|success|warning|info|caution)/,
  },
  { title: 'Overlay', note: 'copy over imagery', match: /^scrim/ },
  { title: 'Hero', note: 'the cosmic hero surface', match: /^hero-/ },
  {
    title: 'Window chrome',
    note: 'the traffic-light dots in code/window ornaments',
    match: /^window-control-/,
  },
  {
    title: 'Data visualisation',
    note: 'series colours plus the grid, axis and edge strokes',
    match: /^(chart-|viz-)/,
  },
  {
    title: 'Radius',
    note: 'structural, but a theme may restate it',
    match: /^radius-/,
  },
];

function grouped(): Array<{ title: string; note: string; tokens: string[] }> {
  const seen = new Set<string>();
  const out = GROUPS.map((group) => {
    const tokens = THEME_TOKENS.filter((token) => group.match.test(token));
    for (const token of tokens) seen.add(token);
    return { title: group.title, note: group.note, tokens: [...tokens] };
  });
  const rest = THEME_TOKENS.filter((token) => !seen.has(token));
  if (rest.length > 0) {
    out.push({
      title: 'Ungrouped',
      note: 'added to the manifest since this page last learned a prefix',
      tokens: [...rest],
    });
  }
  return out;
}

export default function ThemeAuthoringPage() {
  const groups = grouped();

  return (
    <div className="bg-background text-foreground min-h-screen">
      <SiteNav />

      <main className="mx-auto max-w-prose px-6 py-16">
        <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
          <Link href="/" className="hover:text-foreground transition-colors">
            ← All components
          </Link>
        </nav>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance">
          Theme Authoring
        </h1>
        <p className="text-muted-foreground mt-3 max-w-prose text-lg">
          Fork the Interlace brand without forking the DS. Everything below is
          checked by a test rather than by review — a theme that is
          incomplete, misspelled or unreadable fails{' '}
          <code className="font-mono">theme-contract-lock</code> before it
          reaches a page.
        </p>
        <p className="text-muted-foreground mt-3 text-sm">
          The switcher in this page&apos;s header is the DS&apos;s own{' '}
          <Link
            href="/c/theme-switcher"
            className="text-primary underline-offset-4 hover:underline"
          >
            ThemeSwitcher
          </Link>
          , driving the two axes described here. Try it: everything on this
          site, including the live component previews, repaints.
        </p>

        {/* ─── The two paths ──────────────────────────────────────── */}
        <Section title="Two ways to re-brand, and they are not the same">
          <p className="text-muted-foreground">
            Both are supported and they answer different questions. Pick the
            first if your app has ONE brand; pick the second if a reader has to
            be able to switch.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-border border-b">
                  <th className="py-2 pr-4 font-semibold">&nbsp;</th>
                  <th className="py-2 pr-4 font-semibold">Override the layer</th>
                  <th className="py-2 font-semibold">Register a theme</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <Row
                  label="Lives in"
                  a="your app's global.css"
                  b="packages/ui/styles/themes/<name>.css"
                />
                <Row label="Selector" a=":root / .dark" b="[data-theme='<name>']" />
                <Row label="Switchable at runtime" a="no — it IS your brand" b="yes" />
                <Row label="Checked by the lock" a="no" b="yes — every token, every scheme" />
                <Row label="Ships to other consumers" a="no" b="yes, via the registry" />
              </tbody>
            </table>
          </div>
        </Section>

        {/* ─── Path A ─────────────────────────────────────────────── */}
        <Step n={1} title="Path A — override @layer interlace.brand">
          <p className="text-muted-foreground">
            Import the DS baseline, then declare the brand layer after it.
            Source order does not matter — the layer wins by cascade rule, not
            by specificity or position.
          </p>
          <Snippet>{`/* consumer's global.css */
@import "tailwindcss";
@import "@interlace/ui/styles/index.css";

@layer interlace.brand {
  :root {
    --interlace-primary: oklch(0.55 0.22 264);          /* your blue */
    --interlace-primary-foreground: #ffffff;
    --interlace-background: #ffffff;
    --interlace-foreground: #0a0a0f;
    --interlace-muted-foreground: #4a4458;              /* ≥4.5:1 on background */
    /* … the rest of the manifest */
  }

  .dark {
    --interlace-primary: oklch(0.78 0.18 264);
    --interlace-background: #0a0a0f;
    --interlace-foreground: #ededf2;
    --interlace-muted-foreground: #c4c0d4;
    /* … */
  }
}`}</Snippet>
          <p className="text-muted-foreground mt-3 text-sm">
            The Interlace defaults were Tailwind violet until July 2026 and
            were repointed to burnt orange + green entirely inside this layer,
            with zero component edits. That is the whole claim, and it is why
            the layer — not the components — is the override surface. Full
            layer model:{' '}
            <Link
              href="/css-contract"
              className="text-primary underline-offset-4 hover:underline"
            >
              CSS contract
            </Link>
            .
          </p>
        </Step>

        {/* ─── The axes ───────────────────────────────────────────── */}
        <Step n={2} title="Path B — first, the two axes">
          <p className="text-muted-foreground">
            A colour SCHEME and a THEME are different questions and must not
            share a selector. Until Phase 8 they did:{' '}
            <code className="font-mono">[data-theme=&apos;dark&apos;]</code>{' '}
            meant dark mode, which spent the one obvious attribute for
            &ldquo;which brand&rdquo; on &ldquo;which scheme&rdquo; and left a
            second brand nowhere to go but a fork of the file.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-border border-b">
                  <th className="py-2 pr-4 font-semibold">Selector</th>
                  <th className="py-2 font-semibold">Means</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <Row2 a=":root" b={`${DEFAULT.label} · light — the default`} />
                <Row2
                  a=".dark, [data-scheme='dark']"
                  b={`${DEFAULT.label} · dark`}
                />
                <Row2 a="[data-theme='X']" b="theme X · light" />
                <Row2 a="[data-theme='X'].dark" b="theme X · dark" />
                <Row2
                  a="[data-theme='X'] .dark"
                  b="theme X · dark, on a SUBTREE"
                />
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            <code className="font-mono">.dark</code> stays load-bearing on
            purpose: it is the shadcn / next-themes convention that every
            consumer and the Storybook decorator already write. The theme axis
            is purely additive.
          </p>
          <Callout title="Do not skip the last row">
            <p>
              The bare <code className="font-mono">.dark</code> block in{' '}
              <code className="font-mono">interlace-theme.css</code> is
              unscoped, so what it really means is &ldquo;{DEFAULT.label}{' '}
              dark&rdquo; — it re-declares every{' '}
              <code className="font-mono">--interlace-*</code> literal on
              whatever element carries it. And{' '}
              <code className="font-mono">
                [data-theme=&apos;X&apos;].dark
              </code>{' '}
              needs both on the SAME element. So a{' '}
              <code className="font-mono">
                &lt;div class=&quot;dark&quot;&gt;
              </code>{' '}
              anywhere inside your themed page silently repaints that subtree
              in the DEFAULT brand. It reads as &ldquo;the theme did not
              apply&rdquo;. Declare the descendant forms too; the lock checks
              that you did.
            </p>
          </Callout>
        </Step>

        {/* ─── The manifest ───────────────────────────────────────── */}
        <Step
          n={3}
          title={`Define all ${THEME_TOKENS.length} tokens — twice`}
        >
          <p className="text-muted-foreground">
            A theme is a data file, not a pile of CSS: it supplies{' '}
            <code className="font-mono">--interlace-*</code> literals and
            nothing else. The semantic aliases (
            <code className="font-mono">--background</code>,{' '}
            <code className="font-mono">--primary</code>, the{' '}
            <code className="font-mono">@theme inline</code> registration) are
            owned by the DS and never change — that is the entire point of the
            cascade.
          </p>
          <p className="text-muted-foreground mt-3">
            Every token below must appear in BOTH the light block and the dark
            block. Not because it is tidy: a missing token does not throw and
            does not warn. It resolves from whatever rule of lower specificity
            last matched — the previous theme, or this theme&apos;s other
            scheme — so the page renders {THEME_TOKENS.length - 1} surfaces in
            your brand and one in someone else&apos;s, and nobody files a bug
            because nobody can name what is wrong.
          </p>
          <p className="text-muted-foreground mt-3 text-sm">
            The list is not maintained by hand: it is derived from the{' '}
            <code className="font-mono">:root</code> block of{' '}
            <code className="font-mono">interlace-theme.css</code>, and the
            lock re-derives it on every run and fails if the two disagree.
          </p>

          {groups.map((group) => (
            <div key={group.title} className="mt-6">
              <h3 className="text-sm font-semibold">
                {group.title}{' '}
                <span className="text-muted-foreground font-normal">
                  — {group.note} ({group.tokens.length})
                </span>
              </h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {group.tokens.map((token) => (
                  <li
                    key={token}
                    className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs"
                  >
                    --interlace-{token}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Step>

        {/* ─── Wiring ─────────────────────────────────────────────── */}
        <Step n={4} title="Wire it up — three edits, all of them checked">
          <Snippet>{`/* 1. packages/ui/styles/themes/<name>.css */
@layer interlace.brand {
  [data-theme='<name>'] { /* … every token, light … */ }

  [data-theme='<name>'].dark,
  [data-theme='<name>'][data-scheme='dark'],
  [data-theme='<name>'] .dark,
  [data-theme='<name>'] [data-scheme='dark'] { /* … every token, dark … */ }
}`}</Snippet>
          <Snippet>{`/* 2. packages/ui/styles/index.css — AFTER interlace-theme.css.
      Order is load-bearing: [data-theme='X'] and .dark are BOTH (0,1,0),
      so the tie is broken by source order. */
@import "./interlace-theme.css";
@import "./themes/<name>.css";`}</Snippet>
          <Snippet>{`// 3. packages/ui/src/lib/theme-tokens.ts
export const THEMES = [
  /* … */
  { name: '<name>', label: '<Label>', description: '…', default: false },
] as const;`}</Snippet>
          <p className="text-muted-foreground mt-3 text-sm">
            The registry is what the switcher renders and what the no-flash
            bootstrap validates against, so this third edit is not
            bookkeeping: without it, the theme exists in CSS and is
            unreachable — and with only it, the switcher offers a theme no
            stylesheet defines. The lock asserts the two lists agree.
          </p>
          <p className="text-muted-foreground mt-3 text-sm">
            Currently registered:{' '}
            {[DEFAULT, ...REGISTERED].map((theme, index) => (
              <span key={theme.name}>
                {index > 0 ? ', ' : ''}
                <code className="font-mono">{theme.name}</code>
                {theme.default ? ' (default)' : ''}
              </span>
            ))}
            .
          </p>
        </Step>

        {/* ─── The lock ───────────────────────────────────────────── */}
        <Step n={5} title="Run the lock — what it refuses">
          <Snippet>{`cd packages/ui && npx vitest run __tests__/theme-contract-lock.test.ts`}</Snippet>
          <p className="text-muted-foreground mt-3">
            Six ways it goes red, each of them a defect that is otherwise
            completely silent:
          </p>
          <ol className="text-muted-foreground mt-3 ml-md list-decimal space-y-2 text-sm">
            <li>
              <strong className="text-foreground">A missing token.</strong> It
              inherits the previous theme&apos;s value and ships a two-brand
              page.
            </li>
            <li>
              <strong className="text-foreground">An extra token.</strong> A
              typo is silent for exactly the same reason —{' '}
              <code className="font-mono">--interlace-muted-forground</code> is
              a perfectly valid custom property that nothing reads, and the
              real token keeps its inherited value.
            </li>
            <li>
              <strong className="text-foreground">
                A value it cannot parse.
              </strong>{' '}
              Hex, <code className="font-mono">oklch()</code>, a{' '}
              <code className="font-mono">var()</code> alias to another brand
              token, or a <code className="font-mono">rem</code> length. A
              token that is present but unreadable passes a completeness check
              and fails the user.
            </li>
            <li>
              <strong className="text-foreground">
                Text below 4.5:1, on any surface it actually paints.
              </strong>{' '}
              Over 20 pairs per theme × scheme — body copy, copy in a card, in
              a popover, on muted, every filled status chip, and{' '}
              <code className="font-mono">text-primary</code> on{' '}
              <code className="font-mono">bg-primary/10</code>, which is where
              a primary colour usually breaks.
            </li>
            <li>
              <strong className="text-foreground">
                Non-text UI below 3:1.
              </strong>{' '}
              The focus ring (SC 2.4.13) and control borders and chart axes
              (SC 1.4.11), measured on the page AND on a card.
            </li>
            <li>
              <strong className="text-foreground">
                A selector that moved.
              </strong>{' '}
              The lock matches the stylesheet&apos;s selectors exactly,
              including the subtree forms. If the matrix changes and the table
              in the test does not, it fails — rather than parsing an empty
              block and making every assertion above vacuous.
            </li>
          </ol>
        </Step>

        {/* ─── Contrast ───────────────────────────────────────────── */}
        <Step n={6} title="Measure the contrast — do not look at it">
          <p className="text-muted-foreground">
            &ldquo;It looks fine on my screen&rdquo; is how{' '}
            <code className="font-mono">#eae7e2</code> shipped as a form-control
            border at 1.23:1. Three layers measure instead, and they overlap on
            purpose:
          </p>
          <ul className="text-muted-foreground mt-3 ml-md list-disc space-y-2 text-sm">
            <li>
              <strong className="text-foreground">The palette.</strong>{' '}
              <code className="font-mono">theme-contract-lock</code> recomputes
              every pair from the hex in your theme file on every run. The
              ratios written in a theme&apos;s header comment are a
              reader&apos;s convenience; the test is the authority, and it
              fails if the comments become fiction.
            </li>
            <li>
              <strong className="text-foreground">The composites.</strong>{' '}
              <code className="font-mono">composite-contrast-lock</code> walks
              component source for tinted pairs (
              <code className="font-mono">bg-primary/10</code> +{' '}
              <code className="font-mono">text-primary</code>) that no palette
              check can see.
            </li>
            <li>
              <strong className="text-foreground">The rendered page.</strong>{' '}
              The <code className="font-mono">storybook (a11y)</code> CI gate
              runs axe over every story — and then re-runs the colour rules
              once per registered theme, at the scheme the story is in. The
              theme list there is discovered from the stylesheet that loaded,
              so your theme is swept the moment it is imported, with no edit to
              the gate.
            </li>
          </ul>
          <Callout title="Axe alone is not a contrast gate">
            <p>
              It scores TEXT against its background and never a control&apos;s
              BORDER against the surface behind it. Three WCAG 2.2 failures —{' '}
              <code className="font-mono">--input</code> at 1.23:1, the focus
              ring at 2.57:1, the slider rail at 1.07:1 — sat behind a green
              axe run in both schemes. SC 1.4.11 and SC 2.4.13 are held by
              token maths, which is why the lock exists and why it is not
              satisfied by a passing browser scan.
            </p>
          </Callout>
          <p className="text-muted-foreground mt-3 text-sm">
            To see resolved values rather than compute them, the{' '}
            <Link
              href="/semantics-catalog"
              className="text-primary underline-offset-4 hover:underline"
            >
              semantics catalogue
            </Link>{' '}
            lists every semantic token with its light and dark value.
          </p>
        </Step>

        {/* ─── Ship it ────────────────────────────────────────────── */}
        <Step n={7} title="Ship it in the UI — and mind the flash">
          <p className="text-muted-foreground">
            A theme applied after hydration is a repaint on every page load:
            the document paints the default, React mounts, an effect reads{' '}
            <code className="font-mono">localStorage</code>, and only then does
            the page become what the user chose. On a slow connection that is
            half a second of the wrong brand. No amount of correctness in the
            hook fixes it — by the time any React code runs, the wrong paint
            has already happened.
          </p>
          <Snippet>{`// app/layout.tsx — server component, no 'use client'
import { THEME_SCRIPT } from '@interlace/ui/theme-script';

<html lang="en" suppressHydrationWarning>
  <head>
    <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
  </head>`}</Snippet>
          <Snippet>{`// anywhere in your chrome
import { ThemeSwitcher } from '@interlace/ui/theme-switcher';

<ThemeSwitcher size="sm" align="end" />`}</Snippet>
          <p className="text-muted-foreground mt-3 text-sm">
            <code className="font-mono">suppressHydrationWarning</code> on{' '}
            <code className="font-mono">&lt;html&gt;</code> is required — the
            script deliberately mutates the element React is about to hydrate,
            which is the same thing next-themes asks for. The script is derived
            from the registry, so a theme added in step 4 needs no edit here.
          </p>
          <p className="text-muted-foreground mt-3 text-sm">
            Embedding previews in an iframe? The frame is a separate document:
            nothing about the page&apos;s palette crosses into it. Pass the
            theme explicitly — this site does it with Storybook&apos;s{' '}
            <code className="font-mono">?globals=interlaceTheme:&lt;name&gt;</code>{' '}
            — or your previews will keep showing the default brand under a
            re-themed page.
          </p>
        </Step>

        {/* ─── The sharp edge ─────────────────────────────────────── */}
        <Section title={`The one asymmetry: ${DEFAULT.label} has no [data-theme]`}>
          <p className="text-muted-foreground">
            <code className="font-mono">{DEFAULT.name}</code> is not a theme
            file. It IS <code className="font-mono">:root</code>, and it is
            written as the ABSENCE of the attribute — there is no{' '}
            <code className="font-mono">
              [data-theme=&apos;{DEFAULT.name}&apos;]
            </code>{' '}
            selector anywhere. Choosing it removes the attribute rather than
            setting it, which keeps &ldquo;no preference&rdquo; and &ldquo;chose
            the default&rdquo; from becoming indistinguishable in the DOM.
          </p>
          <p className="text-muted-foreground mt-3">
            The visible consequence is in the switcher: the obvious flourish —
            a dot per theme painted in that theme&apos;s own primary — cannot
            be done honestly. The dot would need{' '}
            <code className="font-mono">[data-theme=&apos;X&apos;]</code> on
            itself, and for the default there is no such selector, so its swatch
            would paint in whatever theme is currently active. A dot that lies
            about which brand it represents is worse than no dot, so{' '}
            <Link
              href="/c/theme-switcher"
              className="text-primary underline-offset-4 hover:underline"
            >
              ThemeSwitcher
            </Link>{' '}
            ships check marks and the check carries the state.
          </p>
          <p className="text-muted-foreground mt-3">
            Adding{' '}
            <code className="font-mono">
              [data-theme=&apos;{DEFAULT.name}&apos;]
            </code>{' '}
            as a <code className="font-mono">:root</code> alias would fix it. It
            is a CONTRACT change, not a component change: the selector matrix,
            the manifest&apos;s provenance rule (the manifest is derived from
            the <code className="font-mono">:root</code> block), the lock&apos;s
            selector table and the stylesheet header all move together, or the
            lock goes red — by design.
          </p>
        </Section>

        <Section title="What you cannot safely override">
          <ul className="text-muted-foreground mt-3 ml-md list-disc space-y-2 text-sm">
            <li>
              <code className="font-mono">@layer interlace.preflight</code> —
              the focus-ring + min-viewport baseline. Overriding it costs WCAG
              2.2 SC 2.4.13.
            </li>
            <li>
              <code className="font-mono">@layer interlace.bridge</code> —
              fumadocs ↔ shadcn translation. Overriding it breaks
              cross-framework primitive resolution.
            </li>
            <li>
              <code className="font-mono">@layer interlace.foundation</code> —
              type scale + spacing scale + radius + container widths. These are
              structural; if you really need a different spacing scale
              you&apos;re forking the DS, not theming it.
            </li>
            <li>
              <code className="font-mono">@layer interlace.semantics</code> — a
              theme file that declares{' '}
              <code className="font-mono">--background</code> directly has
              bypassed the alias graph, and the next token added to the graph
              will not reach it. The lock refuses this outright.
            </li>
          </ul>
        </Section>

        {/* The collision surface. Lives here rather than on /css-contract
            because this is the page someone opens the moment they decide to
            override a token — which is the moment the `@theme inline` rule
            (override `--accent`, never `--color-accent`) starts costing them
            time. Linked from /getting-started and from the `theme` item's
            post-install output. */}
        <TokenNamespaceReference />
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold tracking-tight">
        <span className="text-primary">{n}.</span> {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Snippet({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-muted text-foreground mt-4 overflow-x-auto rounded-md p-md font-mono text-sm">
      <code>{children}</code>
    </pre>
  );
}

function Callout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card/40 text-muted-foreground mt-4 rounded-md border p-md text-sm">
      <p className="text-foreground font-semibold">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr className="border-border/60 border-b">
      <th scope="row" className="text-foreground py-2 pr-4 font-medium">
        {label}
      </th>
      <td className="py-2 pr-4">{a}</td>
      <td className="py-2">{b}</td>
    </tr>
  );
}

function Row2({ a, b }: { a: string; b: string }) {
  return (
    <tr className="border-border/60 border-b">
      <td className="py-2 pr-4 font-mono text-xs">{a}</td>
      <td className="py-2">{b}</td>
    </tr>
  );
}
