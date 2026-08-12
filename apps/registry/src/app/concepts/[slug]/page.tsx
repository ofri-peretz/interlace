import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ConceptBlocks } from '@/components/prose/blocks';
import { SiteNav } from '@/components/site-nav';
import { conceptBySlug, listConcepts } from '@/lib/concepts';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const STORYBOOK_URL =
  process.env.NEXT_PUBLIC_STORYBOOK_URL ?? 'https://storybook.interlace.tools';

export const dynamicParams = false;

export function generateStaticParams() {
  return listConcepts().map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = conceptBySlug(slug);
  if (!page) return { title: 'Not found' };
  return {
    title: page.title,
    description: page.lead,
    openGraph: {
      title: `${page.title} — Interlace DS concepts`,
      description: page.lead,
      url: `https://ds.interlace.tools/concepts/${page.slug}`,
    },
  };
}

export default async function ConceptPage({ params }: PageProps) {
  const { slug } = await params;
  const page = conceptBySlug(slug);
  if (!page) notFound();

  const all = listConcepts();
  const index = all.findIndex((p) => p.slug === page.slug);
  const previous = index > 0 ? all[index - 1] : null;
  const next = index < all.length - 1 ? all[index + 1] : null;

  return (
    <div className="bg-background text-foreground min-h-screen">
      <SiteNav />

      <main className="mx-auto max-w-content px-6 py-16">
        <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
          <Link
            href="/concepts"
            className="hover:text-foreground transition-colors"
          >
            ← Concepts
          </Link>
        </nav>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance">
          {page.title}
        </h1>

        {/*
          The two links a reader of a derived page needs: the file it came from
          (so the claim is checkable) and the Storybook render (which has the
          live demos this projection deliberately does not fork).
        */}
        <p className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
          <a
            href={`https://github.com/ofri-peretz/interlace/blob/main/${page.file}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground break-all transition-colors"
          >
            {page.file} ↗
          </a>
          <span aria-hidden>·</span>
          <a
            href={`${STORYBOOK_URL}/?path=/docs/${page.storybookId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            same page in Storybook, with live demos ↗
          </a>
        </p>

        {page.headings.length > 2 ? (
          <nav
            aria-label="On this page"
            className="border-border bg-card/40 mt-8 rounded-lg border p-5"
          >
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              On this page
            </h2>
            <ol className="mt-3 space-y-1.5 text-sm">
              {page.headings.map((heading) => (
                <li key={heading.id}>
                  <Link
                    href={`#${heading.id}`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {heading.text}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="max-w-prose">
          <ConceptBlocks blocks={page.blocks} />
        </div>

        <nav
          aria-label="More concepts"
          className="border-border mt-16 grid gap-4 border-t pt-8 sm:grid-cols-2"
        >
          {previous ? (
            <Link
              href={`/concepts/${previous.slug}`}
              className="border-border hover:border-primary/60 rounded-lg border p-4 transition-colors"
            >
              <span className="text-muted-foreground text-xs">← Previous</span>
              <span className="mt-1 block font-semibold">{previous.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/concepts/${next.slug}`}
              className="border-border hover:border-primary/60 rounded-lg border p-4 text-right transition-colors sm:col-start-2"
            >
              <span className="text-muted-foreground text-xs">Next →</span>
              <span className="mt-1 block font-semibold">{next.title}</span>
            </Link>
          ) : null}
        </nav>
      </main>
    </div>
  );
}
