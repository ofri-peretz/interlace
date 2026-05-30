import type { Metadata } from 'next';
import Link from 'next/link';

const STORYBOOK_URL = 'https://storybook.interlace.tools';

export const metadata: Metadata = {
  title: 'Getting started',
  description:
    'Wire @interlace/ui into your app in three commands — full DS baseline + a11y starter + layout starter. Plus the data-interlace-dev opt-in for the min-viewport contract.',
  openGraph: {
    title: 'Getting started — Interlace DS',
    description:
      'Three commands to the full DS floor: WCAG 2.2 SC 2.4.13 focus ring, [data-min-viewport] contract, reduced-motion respect, and the type/spacing/radius scales.',
    url: 'https://ds.interlace.tools/getting-started',
  },
};

export default function GettingStartedPage() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-border bg-background/80 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span
              aria-hidden
              className="inline-block size-6 rounded-md bg-linear-to-br from-violet-500 to-violet-700"
            />
            <span>Interlace UI</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <a
              href={STORYBOOK_URL}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Storybook ↗
            </a>
            <a
              href="https://github.com/ofri-peretz/interlace"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub ↗
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
          <Link href="/" className="hover:text-foreground transition-colors">
            ← All components
          </Link>
        </nav>

        <h1 className="mt-6 text-4xl font-bold tracking-tight">Getting started</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
          Three commands to a fully-themed app with the DS&apos;s a11y and
          responsive contracts active. Then keep installing primitives one at
          a time as you need them.
        </p>

        {/* ─── Step 1: theme ─────────────────────────────────────────── */}
        <Step
          n={1}
          title="Install the full CSS baseline"
          description={
            <>
              The <code className="font-mono text-foreground">@interlace/theme</code>{' '}
              bundle ships five stylesheets in the right cascade order:{' '}
              <code className="font-mono">tokens</code> →{' '}
              <code className="font-mono">foundation</code> →{' '}
              <code className="font-mono">preflight</code> →{' '}
              <code className="font-mono">theme</code> →{' '}
              <code className="font-mono">interlace-theme</code>. One command
              lands the type / spacing / radius scales, the WCAG 2.2 SC 2.4.13
              focus ring, the <code className="font-mono">[data-min-viewport]</code>{' '}
              container contract, reduced-motion respect, and the brand palette.
            </>
          }
        >
          <CodeBlock
            label="Install the theme"
            code="npx shadcn@latest add @interlace/theme"
          />
        </Step>

        {/* ─── Step 2: layout starter ────────────────────────────────── */}
        <Step
          n={2}
          title="Install the layout starter"
          description={
            <>
              Six primitives that compose every page —{' '}
              <code className="font-mono">Container</code>,{' '}
              <code className="font-mono">Section</code>,{' '}
              <code className="font-mono">Stack</code>,{' '}
              <code className="font-mono">Grid</code>,{' '}
              <code className="font-mono">Box</code>,{' '}
              <code className="font-mono">Typography</code>. The LAYOUT_PHILOSOPHY
              contract is satisfied in one install.
            </>
          }
        >
          <CodeBlock
            label="Install the layout starter"
            code="npx shadcn@latest add @interlace/layout-starter"
          />
        </Step>

        {/* ─── Step 3: a11y starter ──────────────────────────────────── */}
        <Step
          n={3}
          title="Install the a11y starter"
          description={
            <>
              <code className="font-mono">SkipLink</code> +{' '}
              <code className="font-mono">VisuallyHidden</code> +{' '}
              <code className="font-mono">FocusRing</code> +{' '}
              <code className="font-mono">useReducedMotion</code>. Drops the
              three primitives every consumer needs on day one plus the hook
              every animated primitive uses to honor the OS preference.
            </>
          }
        >
          <CodeBlock
            label="Install the a11y starter"
            code="npx shadcn@latest add @interlace/a11y-starter"
          />
        </Step>

        {/* ─── data-interlace-dev opt-in ─────────────────────────────── */}
        <section className="mt-16">
          <h2 className="text-xl font-semibold">
            Opt into the min-viewport dev outline
          </h2>
          <p className="text-muted-foreground mt-3">
            Every Interlace primitive declares its smallest viable viewport via{' '}
            <code className="font-mono text-foreground">
              data-min-viewport=&quot;320|480|768&quot;
            </code>
            . In development, add the{' '}
            <code className="font-mono text-foreground">data-interlace-dev</code>{' '}
            flag to your <code className="font-mono">{'<body>'}</code> and the
            preflight contract will draw a dashed outline around any primitive
            rendered in a container narrower than its declared minimum. Strip
            the attribute in production.
          </p>
          <div className="mt-4">
            <CodeBlock
              label="Layout root — Next.js / Remix / any framework"
              code={`<body
  data-interlace-dev={process.env.NODE_ENV !== 'production' ? '' : undefined}
>
  {children}
</body>`}
            />
          </div>
        </section>

        {/* ─── Foundations npm install (alternate) ───────────────────── */}
        <section className="mt-16">
          <h2 className="text-xl font-semibold">
            Alternate: install the CSS as an npm package
          </h2>
          <p className="text-muted-foreground mt-3">
            If you don&apos;t want to vendor the source via the shadcn CLI,
            install the CSS baseline as a versioned npm package:
          </p>
          <div className="mt-4 space-y-3">
            <CodeBlock label="Install" code="npm i @interlace/foundation" />
            <CodeBlock
              label="globals.css"
              code={`@import "@interlace/foundation";\n\n/* or just the focus + min-viewport contract */\n@import "@interlace/foundation/preflight.css";`}
            />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">
            The package follows semver against the CSS contract — patch updates
            preserve contrast + cascade behavior; majors are reserved for token
            renames or cascade reorderings. See{' '}
            <a
              href="https://github.com/ofri-peretz/interlace/tree/main/packages/foundation#versioning"
              className="text-foreground underline-offset-4 hover:underline"
            >
              @interlace/foundation README
            </a>
            .
          </p>
        </section>

        {/* ─── What you got ──────────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="text-xl font-semibold">
            What the three commands give you
          </h2>
          <dl className="border-border mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
            <Cell title="Focus ring (WCAG 2.2 SC 2.4.13)">
              2 px solid, 2 px offset, ≥3:1 contrast against the adjacent
              surface — on every interactive element, in both light and dark.
            </Cell>
            <Cell title="Min-viewport contract">
              Every primitive carries <code className="font-mono">data-min-viewport</code>;
              the dev-mode outline warns when one renders below its declared
              floor. Production strips the warning.
            </Cell>
            <Cell title="Reduced-motion respect">
              <code className="font-mono">prefers-reduced-motion: reduce</code>{' '}
              clamps every animation to 0.01ms globally; client primitives
              also gate on the <code className="font-mono">useReducedMotion</code>{' '}
              hook.
            </Cell>
            <Cell title="Type / spacing / radius scales">
              h1–h6, body, long, ui, ui-sm, caption, code variants. Six-step
              spacing (8/16/24/40/64/96 px). Three-step radius (8/12/16 px).
            </Cell>
            <Cell title="Brand palette (AAA-cleared)">
              violet-700 light (7.34:1 on white); violet-400 dark (7.42:1 on
              near-black). Five chart-series hues.
            </Cell>
            <Cell title="Skip-to-main + sr-only contract">
              <code className="font-mono">SkipLink</code> for WCAG 2.4.1 Bypass
              Blocks; <code className="font-mono">VisuallyHidden</code> for the
              screen-reader-only contract. Both shipped, both component-form.
            </Cell>
          </dl>
        </section>

        {/* ─── Next step ─────────────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="text-xl font-semibold">Next</h2>
          <p className="text-muted-foreground mt-3">
            From here, install primitives one at a time as you need them.
            Every primitive page lists its install command, anatomy, variants,
            R-rule compliance, and source.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <Link
              href="/"
              className="border-border bg-card hover:border-violet-500/60 inline-flex items-center gap-2 rounded-md border px-4 py-2 font-medium transition-colors"
            >
              ← Browse all components
            </Link>
            <a
              href={STORYBOOK_URL}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 transition-colors"
            >
              Storybook ↗
            </a>
            <a
              href="https://github.com/ofri-peretz/interlace/blob/main/DESIGN_PRINCIPLES.md"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 transition-colors"
            >
              DESIGN_PRINCIPLES.md ↗
            </a>
          </div>
        </section>

        <footer className="border-border mt-16 border-t pt-8 text-sm">
          <p className="text-muted-foreground">
            Source of truth for every contract above:{' '}
            <a
              href="https://github.com/ofri-peretz/interlace/blob/main/DESIGN_PRINCIPLES.md"
              className="text-foreground underline-offset-4 hover:underline"
            >
              DESIGN_PRINCIPLES.md
            </a>{' '}
            + the per-domain{' '}
            <a
              href="https://github.com/ofri-peretz/interlace/tree/main/docs/philosophies"
              className="text-foreground underline-offset-4 hover:underline"
            >
              philosophy docs
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}

function Step({
  n,
  title,
  description,
  children,
}: {
  n: number;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-3">
        <span className="text-violet-600 dark:text-violet-400 font-mono text-sm font-semibold">
          STEP {n}
        </span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <p className="text-muted-foreground mt-3">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="text-muted-foreground border-border border-b px-4 py-2 text-xs font-medium">
        {label}
      </div>
      <pre className="overflow-x-auto px-4 py-3">
        <code className="font-mono text-sm">{code}</code>
      </pre>
    </div>
  );
}

function Cell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card p-4">
      <dt className="text-foreground text-sm font-semibold">{title}</dt>
      <dd className="text-muted-foreground mt-2 text-sm">{children}</dd>
    </div>
  );
}
