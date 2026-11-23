import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteNav } from '@/components/site-nav';

export const metadata: Metadata = {
  title: 'CSS Contract',
  description:
    'The single canonical CSS import for the Interlace DS, the cascade-layer model behind it, and the override surface for forking the brand. If you only read one page, read this.',
  openGraph: {
    title: 'CSS Contract — Interlace DS',
    description:
      'One import. Four layers, one direction. Deterministic override surface. Tailwind v4 native.',
    url: 'https://ds.interlace.tools/css-contract',
  },
};

export default function CSSContractPage() {
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
          CSS Contract
        </h1>
        <p className="text-muted-foreground mt-3 max-w-prose text-lg">
          The single canonical CSS import for the Interlace DS, the
          cascade-layer model behind it, and the override surface for
          forking the brand. If you only read one page in this docs,
          read this.
        </p>

        {/* ─── TL;DR ─────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">TL;DR</h2>
          <p className="text-muted-foreground mt-2">
            Two barrels. <code className="font-mono">base.css</code> is the
            additive baseline every component needs; it leaves the host
            app&apos;s own styles alone. <code className="font-mono">index.css</code>{' '}
            is the full contract: base plus the opt-in fonts, page preflight
            and fumadocs bridge.
          </p>
          <pre className="bg-muted text-foreground mt-4 overflow-x-auto rounded-lg p-6 font-mono text-sm">
            <code>{`@import "tailwindcss";
@import "@interlace/ui/styles/base.css";   /* additive: what components need */

/* or, for the full Interlace page: */
@import "@interlace/ui/styles/index.css";  /* base + fonts + preflight + bridge */`}</code>
          </pre>
          <p className="text-muted-foreground mt-3 text-sm">
            In the registry these are{' '}
            <code className="font-mono">interlace-base</code> (installed with
            every component) and{' '}
            <code className="font-mono">interlace-foundation</code> (opt-in).
            The Interlace palette itself is a third item,{' '}
            <code className="font-mono">theme</code>, which writes shadcn
            cssVars. Read on for the why.
          </p>
        </section>

        {/* ─── The four layers ────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Four layers, one direction
          </h2>
          <p className="text-muted-foreground mt-2">
            The stylesheet tree is the architecture. Each layer reads only the
            one before it, and a test fails the build if one reaches across:
          </p>
          <pre className="bg-muted text-foreground mt-4 overflow-x-auto rounded-lg p-6 font-mono text-sm">
            <code>{`styles/
  brand/interlace.css    1. raw --interlace-* values, light + dark
  brand/harbor.css          (one file per theme)
  semantics.css          2. --primary, --card, … bound to brand values
  structure/type.css     3. type scale, prose
  structure/layout.css      containers, xs breakpoint
  structure/radius.css      radius steps derived from --radius
  structure/motion.css      keyframes, durations, easings
  page/fonts.css         4. opt-in: Inter + JetBrains Mono
  page/preflight.css        opt-in: focus ring, selection, scrollbars
  page/fumadocs.css         opt-in: fumadocs token bridge
  page/shiki.css            opt-in: code highlighting
  base.css               = 1 + 2 + 3   (interlace-base)
  index.css              = base + 4    (interlace-foundation)`}</code>
          </pre>

          <div className="mt-6 overflow-x-auto">
          <table className="border-border w-full border-collapse border">
            <thead className="bg-muted">
              <tr>
                <th className="border-border border p-4 text-left font-semibold">
                  Layer
                </th>
                <th className="border-border border p-4 text-left font-semibold">
                  Owns
                </th>
                <th className="border-border border p-4 text-left font-semibold">
                  May not
                </th>
              </tr>
            </thead>
            <tbody>
              {LAYERS.map((row) => (
                <tr key={row.layer} className="even:bg-muted/40">
                  <td className="border-border border p-4 font-mono text-sm">
                    {row.layer}
                  </td>
                  <td className="border-border border p-4 text-sm">
                    {row.owns}
                  </td>
                  <td className="border-border border p-4 text-sm">
                    {row.mayNot}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>

        {/* ─── Cascade ─────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Your classes always win
          </h2>
          <p className="text-muted-foreground mt-2">
            Tailwind declares{' '}
            <code className="font-mono">theme, base, components, utilities</code>.
            Every Interlace rule that styles an element sits inside one of
            those: preflight in <code className="font-mono">base</code>,
            prose and animation classes in{' '}
            <code className="font-mono">components</code>. So{' '}
            <code className="font-mono">h-10</code> on an image or{' '}
            <code className="font-mono">inline</code> on an svg beats the
            baseline, as it should.
          </p>
          <p className="text-muted-foreground mt-3">
            Three named layers hold custom properties only, and nothing else:
          </p>
          <pre className="bg-muted text-foreground mt-4 overflow-x-auto rounded-lg p-6 font-mono text-sm">
            <code>{`@layer interlace.bridge, interlace.brand, interlace.semantics;`}</code>
          </pre>
          <p className="text-muted-foreground mt-3 text-sm">
            Later wins, so semantics resolves on top of brand. An unlayered{' '}
            <code className="font-mono">:root {'{'} --primary: … {'}'}</code>{' '}
            in your own CSS beats all three.
          </p>
        </section>

        {/* ─── Override surface ───────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Fork the brand
          </h2>
          <p className="text-muted-foreground mt-2">
            The supported override surface is{' '}
            <code className="font-mono">@layer interlace.brand</code>.
            Declare it AFTER importing base.css (or index.css) and your values
            deterministically win — regardless of declaration order or
            specificity. Without cascade layers, brand override is
            source-order roulette.
          </p>
          <pre className="bg-muted text-foreground mt-4 overflow-x-auto rounded-lg p-6 font-mono text-sm">
            <code>{`/* consumer's global.css */
@import "tailwindcss";
@import "@interlace/ui/styles/index.css";

@layer interlace.brand {
  :root {
    --interlace-primary: oklch(0.55 0.22 264);
    --interlace-primary-hover: oklch(0.50 0.22 264);
    --interlace-background: #ffffff;
    /* ... */
  }
  .dark {
    --interlace-primary: oklch(0.78 0.18 264);
    --interlace-background: #0a0a0f;
    /* ... */
  }
}`}</code>
          </pre>
          <p className="text-muted-foreground mt-3 text-sm">
            Walk every brand token →{' '}
            <Link
              href="/theme-authoring"
              className="text-primary underline-offset-4 hover:underline"
            >
              theme authoring guide
            </Link>
            . Browse the resolved semantic-token table →{' '}
            <Link
              href="/semantics-catalog"
              className="text-primary underline-offset-4 hover:underline"
            >
              semantics catalogue
            </Link>
            .
          </p>
        </section>

        {/* ─── Don'ts ─────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            What NOT to override
          </h2>
          <p className="text-muted-foreground mt-2">
            Layers other than{' '}
            <code className="font-mono">interlace.brand</code> are
            internal and may change without notice:
          </p>
          <ul className="mt-3 ml-6 list-disc space-y-2 text-sm">
            <li>
              <code className="font-mono">interlace.semantics</code> — the
              alias graph. Re-binding{' '}
              <code className="font-mono">--background</code> here skips the
              brand layer, and the next token added to the graph will not
              reach your theme. Set brand values instead.
            </li>
            <li>
              <code className="font-mono">interlace.bridge</code> —
              fumadocs ↔ shadcn token bridge. Touching it breaks
              cross-framework primitive resolution.
            </li>
            <li>
              <code className="font-mono">structure/</code> — type scale,
              radius derivation, containers, motion. Structural; the brand
              layer is the authoring seam.
            </li>
          </ul>
        </section>

        {/* ─── References ────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            References
          </h2>
          <ul className="mt-3 ml-6 list-disc space-y-2 text-sm">
            <li>
              <a
                href="https://github.com/ofri-peretz/interlace/blob/main/packages/ui/DESIGN_SYSTEM_LAYERS.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                DESIGN_SYSTEM_LAYERS.md ↗
              </a>{' '}
              — the canonical 5-layer architecture doc.
            </li>
            <li>
              <a
                href="https://developer.mozilla.org/en-US/docs/Web/CSS/@layer"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                MDN @layer ↗
              </a>{' '}
              — CSS Cascade Layers spec reference.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

const LAYERS: Array<{ layer: string; owns: string; mayNot: string }> = [
  {
    layer: '1. brand/',
    owns: 'Raw --interlace-* values per theme, light and dark, in @layer interlace.brand. The override surface.',
    mayNot: 'Declare a semantic name (--primary) or style an element.',
  },
  {
    layer: '2. semantics.css',
    owns: 'shadcn and Interlace semantic names bound to brand values, plus the Tailwind colour registration.',
    mayNot: 'Hold a colour literal; every value is var(--interlace-*).',
  },
  {
    layer: '3. structure/',
    owns: 'Type scale, containers, the xs breakpoint, radius steps, motion. Same for every brand.',
    mayNot: 'Mention a colour or an --interlace-* token, or style a bare element.',
  },
  {
    layer: '4. page/',
    owns: 'Fonts, preflight, fumadocs bridge, code highlighting. Opt-in, in index.css only.',
    mayNot: 'Be needed by a component; base.css never imports it.',
  },
];
