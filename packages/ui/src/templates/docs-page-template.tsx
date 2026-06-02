/**
 * @interlace/ui — DocsPageTemplate
 *
 * Documentation page surface. Topbar at top, optional sidebar nav on the
 * left (md+), main content in the centre with a `<Prose>` wrapper, and an
 * optional TOC rail on the right (xl+).
 *
 * Used by `ds.interlace.tools` (the registry app's docs pages) and by
 * `apps/docs` (the ESLint plugins docs). One template, two consumers.
 *
 * ## MIN_VIEWPORT — 320
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Container } from '../primitives/container.js';
import { Prose } from '../primitives/prose.js';
import { SectionBoundary } from '../primitives/section-boundary.js';
import { Topbar } from '../patterns/topbar.js';
import { Footer } from '../patterns/footer.js';

export const MIN_VIEWPORT = 320 as const;

interface DocsPageTemplateProps extends React.ComponentProps<'div'> {
  topbar: React.ComponentProps<typeof Topbar>;
  /** Left sidebar (typically a nav tree). Hidden below md. */
  sidebar?: React.ReactNode;
  /** Right rail (typically a TOC). Hidden below xl. */
  toc?: React.ReactNode;
  /** Page body — wrapped in <Prose>. */
  body: React.ReactNode;
  /** Optional footer at the bottom. */
  footer?: React.ComponentProps<typeof Footer>;
}

function DocsPageTemplate({
  topbar,
  sidebar,
  toc,
  body,
  footer,
  className,
  ...props
}: DocsPageTemplateProps) {
  return (
    <div
      data-slot="docs-page-template"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        'bg-background text-foreground flex min-h-screen flex-col',
        className,
      )}
      {...props}
    >
      <Topbar {...topbar} />

      <div className="flex flex-1">
        {sidebar ? (
          <aside
            className="border-border bg-card hidden w-64 shrink-0 border-r md:block"
            aria-label="Section navigation"
          >
            <SectionBoundary name="docs-sidebar" skeletonVariant="card">
              {sidebar}
            </SectionBoundary>
          </aside>
        ) : null}

        <main className="flex-1 px-md py-xl">
          <SectionBoundary name="docs-body" skeletonVariant="prose">
            <Container size="prose">
              <Prose>{body}</Prose>
            </Container>
          </SectionBoundary>
        </main>

        {toc ? (
          <aside
            className="hidden w-64 shrink-0 px-md py-xl xl:block"
            aria-label="Table of contents"
          >
            <SectionBoundary name="docs-toc" skeletonVariant="text">
              {toc}
            </SectionBoundary>
          </aside>
        ) : null}
      </div>

      {footer ? <Footer {...footer} /> : null}
    </div>
  );
}
DocsPageTemplate.displayName = 'DocsPageTemplate';

export { DocsPageTemplate };
export type { DocsPageTemplateProps };
