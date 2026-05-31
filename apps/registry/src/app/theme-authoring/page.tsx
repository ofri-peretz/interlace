import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteNav } from '@/components/site-nav';

export const metadata: Metadata = {
  title: 'Theme Authoring',
  description:
    'How to fork the Interlace brand layer — palette swap, dark mode, contrast verification. Five steps, no DS forks needed.',
  openGraph: {
    title: 'Theme Authoring — Interlace DS',
    description:
      'Fork the brand by overriding @layer interlace.brand. Five steps, deterministic cascade, no DS forks.',
    url: 'https://ds.interlace.tools/theme-authoring',
  },
};

export default function ThemeAuthoringPage() {
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
          Theme Authoring
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
          Fork the Interlace brand without forking the DS. Five steps —
          install, override the brand layer, swap the palette, verify
          contrast, ship.
        </p>

        <Step n={1} title="Install the DS baseline">
          <p className="text-muted-foreground">
            Get the full CSS contract in one line:
          </p>
          <Snippet>
            {`@import "tailwindcss";\n@import "@interlace/ui/styles/index.css";`}
          </Snippet>
          <p className="text-muted-foreground mt-3 text-sm">
            Full details:{' '}
            <Link
              href="/css-contract"
              className="text-primary underline-offset-4 hover:underline"
            >
              CSS contract
            </Link>
            .
          </p>
        </Step>

        <Step
          n={2}
          title="Pick your brand palette"
        >
          <p className="text-muted-foreground">
            The Interlace defaults are Tailwind violet. Pick your own
            primary hue + neutral surface; the rest of the palette
            derives from those two. Verify each pair clears WCAG 2.2
            AA (≥4.5:1 body, ≥3:1 large) at{' '}
            <a
              href="https://webaim.org/resources/contrastchecker/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              WebAIM contrast checker
            </a>
            .
          </p>
        </Step>

        <Step n={3} title="Override @layer interlace.brand">
          <p className="text-muted-foreground">
            Declare the brand layer AFTER the DS import. Source order
            doesn&apos;t matter — the layer wins by cascade rule.
          </p>
          <Snippet>{`/* consumer's global.css */
@import "tailwindcss";
@import "@interlace/ui/styles/index.css";

@layer interlace.brand {
  :root {
    /* Primary scale */
    --interlace-primary: oklch(0.55 0.22 264);          /* your blue */
    --interlace-primary-hover: oklch(0.50 0.22 264);
    --interlace-primary-active: oklch(0.45 0.22 264);
    --interlace-primary-foreground: #ffffff;
    --interlace-primary-subtle: oklch(0.96 0.04 264);
    --interlace-primary-subtle-foreground: oklch(0.30 0.22 264);

    /* Surface */
    --interlace-background: #ffffff;
    --interlace-foreground: #0a0a0f;
    --interlace-muted-foreground: #4a4458;              /* ≥4.5:1 on background */
    /* … the rest of the brand tokens */
  }

  .dark {
    --interlace-primary: oklch(0.78 0.18 264);
    --interlace-background: #0a0a0f;
    --interlace-foreground: #ededf2;
    --interlace-muted-foreground: #c4c0d4;
    /* … */
  }
}`}</Snippet>
        </Step>

        <Step n={4} title="Verify contrast across the catalogue">
          <p className="text-muted-foreground">
            Visit{' '}
            <Link
              href="/semantics-catalog"
              className="text-primary underline-offset-4 hover:underline"
            >
              the semantics catalogue
            </Link>{' '}
            to see every resolved semantic token + its current contrast
            score in light + dark. Anything below 4.5:1 on body text or
            3:1 on UI controls needs a tweak.
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            For the live storefront we also publish the storybook a11y
            CI as a hard gate — see{' '}
            <a
              href="https://storybook.interlace.tools"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              storybook.interlace.tools ↗
            </a>{' '}
            for the canonical pairs in action.
          </p>
        </Step>

        <Step n={5} title="Ship">
          <p className="text-muted-foreground">
            That&apos;s it. Every primitive, pattern, and template that
            references{' '}
            <code className="font-mono">--background</code>,{' '}
            <code className="font-mono">--foreground</code>,{' '}
            <code className="font-mono">--primary</code>, etc.
            automatically picks up your brand — no per-component
            overrides, no DS fork, no upgrade pain when the DS ships a
            new primitive.
          </p>
        </Step>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            What you cannot safely override
          </h2>
          <ul className="text-muted-foreground mt-3 ml-md list-disc space-y-2 text-sm">
            <li>
              <code className="font-mono">@layer interlace.preflight</code>{' '}
              — the focus-ring + min-viewport baseline. Overriding it
              costs WCAG 2.2 SC 2.4.13.
            </li>
            <li>
              <code className="font-mono">@layer interlace.bridge</code>{' '}
              — fumadocs ↔ shadcn translation. Overriding it breaks
              cross-framework primitive resolution.
            </li>
            <li>
              <code className="font-mono">@layer interlace.foundation</code>{' '}
              — type scale + spacing scale + radius + container widths.
              These are structural; if you really need a different
              spacing scale you&apos;re forking the DS, not theming it.
            </li>
          </ul>
        </section>
      </main>
    </div>
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
