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
      'One import. Six layers. Deterministic override surface. Tailwind v4 native.',
    url: 'https://ds.interlace.tools/css-contract',
  },
};

export default function CSSContractPage() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <SiteNav />

      <main className="mx-auto max-w-3xl px-6 py-16">
        <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
          <Link href="/" className="hover:text-foreground transition-colors">
            ← All components
          </Link>
        </nav>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance">
          CSS Contract
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
          The single canonical CSS import for the Interlace DS, the
          cascade-layer model behind it, and the override surface for
          forking the brand. If you only read one page in this docs,
          read this.
        </p>

        {/* ─── TL;DR ─────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">TL;DR</h2>
          <p className="text-muted-foreground mt-2">
            One import gives you the entire DS contract:
          </p>
          <pre className="bg-muted text-foreground mt-4 overflow-x-auto rounded-md p-md font-mono text-sm">
            <code>{`@import "tailwindcss";
@import "@interlace/ui/styles/index.css";`}</code>
          </pre>
          <p className="text-muted-foreground mt-3 text-sm">
            That barrel resolves to six CSS files imported in
            cascade-correct order. Read on for the why.
          </p>
        </section>

        {/* ─── The six layers ─────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            The six layers
          </h2>
          <p className="text-muted-foreground mt-2">
            `index.css` declares the layer order up front, so the cascade
            is self-documenting:
          </p>
          <pre className="bg-muted text-foreground mt-4 overflow-x-auto rounded-md p-md font-mono text-sm">
            <code>{`@layer interlace.primitives, interlace.foundation, interlace.preflight,
       interlace.bridge, interlace.brand, interlace.semantics;

@import "./tokens.css";
@import "./foundation.css";
@import "./preflight.css";
@import "./theme.css";
@import "./interlace-theme.css";`}</code>
          </pre>

          <table className="border-border mt-6 w-full border-collapse border">
            <thead className="bg-muted">
              <tr>
                <th className="border-border border p-sm text-left font-semibold">
                  Layer
                </th>
                <th className="border-border border p-sm text-left font-semibold">
                  Owns
                </th>
                <th className="border-border border p-sm text-left font-semibold">
                  File
                </th>
              </tr>
            </thead>
            <tbody>
              {LAYERS.map((row) => (
                <tr key={row.layer} className="even:bg-muted/40">
                  <td className="border-border border p-sm font-mono text-sm">
                    {row.layer}
                  </td>
                  <td className="border-border border p-sm text-sm">
                    {row.owns}
                  </td>
                  <td className="border-border border p-sm font-mono text-sm">
                    {row.file}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-muted-foreground mt-4 text-sm">
            Left-to-right in the layer declaration = ascending cascade
            priority (later wins). So{' '}
            <code className="font-mono">interlace.semantics</code>{' '}
            overrides{' '}
            <code className="font-mono">interlace.brand</code>, which
            overrides everything before it.
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
            Declare it AFTER importing index.css and your hex values
            deterministically win — regardless of declaration order or
            specificity. Without cascade layers, brand override is
            source-order roulette.
          </p>
          <pre className="bg-muted text-foreground mt-4 overflow-x-auto rounded-md p-md font-mono text-sm">
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
          <ul className="mt-3 ml-md list-disc space-y-2 text-sm">
            <li>
              <code className="font-mono">interlace.preflight</code> —
              overriding this loses the WCAG 2.2 SC 2.4.13 focus ring,
              scrollbar tint, and{' '}
              <code className="font-mono">[data-min-viewport]</code>{' '}
              dev-mode outline contract.
            </li>
            <li>
              <code className="font-mono">interlace.bridge</code> —
              fumadocs ↔ shadcn token bridge. Touching it breaks
              cross-framework primitive resolution.
            </li>
            <li>
              <code className="font-mono">interlace.primitives</code> +{' '}
              <code className="font-mono">interlace.foundation</code> —
              keyframes, motion timings, type scale, spacing scale.
              These are structural; the brand layer is the authoring
              seam.
            </li>
          </ul>
        </section>

        {/* ─── References ────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            References
          </h2>
          <ul className="mt-3 ml-md list-disc space-y-2 text-sm">
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

const LAYERS: Array<{ layer: string; owns: string; file: string }> = [
  {
    layer: 'interlace.primitives',
    owns: 'Keyframes, motion timings, animation utility classes',
    file: 'tokens.css',
  },
  {
    layer: 'interlace.foundation',
    owns: 'Type scale, spacing scale, radius, container widths, font families (Tailwind @theme tokens)',
    file: 'foundation.css',
  },
  {
    layer: 'interlace.preflight',
    owns: 'body bg/fg/font, focus ring (WCAG 2.2 SC 2.4.13), scrollbar tint, placeholder contrast, min-viewport contract',
    file: 'preflight.css',
  },
  {
    layer: 'interlace.bridge',
    owns: 'fumadocs ↔ shadcn token bridge (--background: var(--color-fd-background))',
    file: 'theme.css',
  },
  {
    layer: 'interlace.brand',
    owns: 'Concrete brand hex literals (--interlace-primary, --interlace-background, …) for light + dark',
    file: 'interlace-theme.css',
  },
  {
    layer: 'interlace.semantics',
    owns: 'Alias bindings: --background → var(--interlace-background), etc. Plus Tailwind @theme inline registration.',
    file: 'interlace-theme.css',
  },
];
