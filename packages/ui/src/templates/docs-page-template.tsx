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
import { Skeleton } from '../primitives/skeleton.js';
import { Stack } from '../primitives/stack.js';

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

/**
 * Page-level loading state — the full-page silhouette of
 * `<DocsPageTemplate>`, not a single rect. Rendered by the consumer while
 * the whole route's data is in flight (`loading.tsx` in Next.js), or as
 * a `<SectionBoundary skeleton={…}>` override.
 *
 * Shapes mirror the real layout so the swap is CLS-neutral (R23). One
 * `role="status"` region for the page; inner skeletons pass
 * `label={null}` so screen readers hear one announcement, not ten.
 *
 * The flanking columns are opt-in (`sidebar` / `toc`), mirroring the
 * template's own optional props — a body-only docs page that painted a
 * 3-column skeleton would shift its content on hydration, which is the
 * exact bug the skeleton exists to prevent. A full docs route renders
 * `<DocsPageTemplate.Skeleton sidebar toc />`.
 */
function DocsPageTemplateSkeleton({
  sidebar = false,
  toc = false,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  /** Reserve the left nav column (md+). Match the page's own `sidebar` prop. */
  sidebar?: boolean;
  /** Reserve the right TOC rail (xl+). Match the page's own `toc` prop. */
  toc?: boolean;
}) {
  return (
    <div
      data-slot="docs-page-template-skeleton"
      data-min-viewport={String(MIN_VIEWPORT)}
      role="status"
      aria-busy="true"
      aria-label="Loading page…"
      className={cn(
        'bg-background text-foreground flex min-h-screen flex-col',
        className,
      )}
      {...props}
    >
      <Skeleton
        variant="rect"
        className="h-14 w-full rounded-none"
        label={null}
      />
      <div className="flex flex-1">
        {sidebar ? (
          <div className="border-border hidden w-64 shrink-0 border-r p-md md:block">
            <Skeleton variant="text" count={8} label={null} />
          </div>
        ) : null}
        <div className="flex-1 px-md py-xl">
          <Container size="prose">
            <Stack gap="lg">
              <Skeleton variant="page-header" label={null} />
              <Skeleton variant="prose" count={10} label={null} />
            </Stack>
          </Container>
        </div>
        {toc ? (
          <div className="hidden w-64 shrink-0 px-md py-xl xl:block">
            <Skeleton variant="text" count={5} label={null} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
DocsPageTemplateSkeleton.displayName = 'DocsPageTemplateSkeleton';
DocsPageTemplate.Skeleton = DocsPageTemplateSkeleton;

export { DocsPageTemplate };
export type { DocsPageTemplateProps };
