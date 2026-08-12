import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteNav } from '@/components/site-nav';
import { CONCEPTS_SOURCE, listConcepts } from '@/lib/concepts';

export const metadata: Metadata = {
  title: 'Concepts',
  description:
    'The seven doctrine pages behind the Interlace DS — responsiveness, layout, colour & theming, accessibility, loading & motion, versioning — and where each guarantee is enforced.',
  openGraph: {
    title: 'Concepts — Interlace DS',
    description:
      'Seven contracts, and the test that enforces each one. Not a style guide.',
    url: 'https://ds.interlace.tools/concepts',
  },
};

export default function ConceptsIndexPage() {
  const pages = listConcepts();
  const overview = pages.find((p) => p.slug === 'overview');
  const rest = pages.filter((p) => p.slug !== 'overview');

  return (
    <div className="bg-background text-foreground min-h-screen">
      <SiteNav />

      <main className="mx-auto max-w-content px-6 py-16">
        <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
          <Link href="/" className="hover:text-foreground transition-colors">
            ← All components
          </Link>
        </nav>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance">
          Concepts
        </h1>
        <p className="text-muted-foreground mt-3 max-w-prose text-lg">
          {overview?.lead ??
            'What this design system guarantees, and where each guarantee is enforced.'}
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {rest.map((page) => (
            <Link
              key={page.slug}
              href={`/concepts/${page.slug}`}
              className="border-border hover:border-primary/60 bg-card/40 hover:bg-card group flex flex-col rounded-lg border p-5 transition-colors"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-semibold">{page.title}</span>
                <span
                  aria-hidden
                  className="text-muted-foreground group-hover:text-primary transition-colors"
                >
                  →
                </span>
              </span>
              <span className="text-muted-foreground mt-2 line-clamp-4 text-sm leading-relaxed">
                {page.lead}
              </span>
              <span className="text-muted-foreground/80 mt-3 font-mono text-xs">
                {page.headings.length} section
                {page.headings.length === 1 ? '' : 's'}
              </span>
            </Link>
          ))}
        </div>

        {overview ? (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight">
              Start here
            </h2>
            <p className="text-muted-foreground mt-2 max-w-prose">
              The overview frames the other six: what the system is, what it
              guarantees, and — the section most docs sites leave out — what it
              does <em>not</em> enforce.
            </p>
            <Link
              href="/concepts/overview"
              className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 mt-4 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors"
            >
              Read the overview
              <span aria-hidden>→</span>
            </Link>
          </section>
        ) : null}

        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            One source, two surfaces
          </h2>
          <p className="text-muted-foreground mt-2 max-w-prose">
            These pages are authored once, as MDX in{' '}
            <code className="font-mono text-sm">{CONCEPTS_SOURCE}</code>, and
            derived into this site by{' '}
            <code className="font-mono text-sm">
              scripts/build-concepts.mjs
            </code>
            . Storybook renders the same file with live component demos
            embedded; the registry renders the prose where a reader evaluating
            the system will actually be. Neither is a copy — a build gate fails
            if this projection drifts from the MDX.
          </p>
        </section>
      </main>
    </div>
  );
}
