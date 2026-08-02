/**
 * @interlace/ui — BlogHomeTemplate
 *
 * Blog index surface. Topbar + hero (greeting / about) + ArticleListGrid
 * (featured + recent) + optional NewsletterForm + Footer. The shape every
 * personal / company blog reaches for.
 *
 * ## MIN_VIEWPORT — 320
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { SectionBoundary } from '../primitives/section-boundary.js';
import { Topbar } from '../patterns/topbar.js';
import { Footer } from '../patterns/footer.js';
import { Skeleton } from '../primitives/skeleton.js';
import { Stack } from '../primitives/stack.js';
import { Container } from '../primitives/container.js';

export const MIN_VIEWPORT = 320 as const;

interface BlogHomeTemplateProps extends React.ComponentProps<'div'> {
  topbar: React.ComponentProps<typeof Topbar>;
  /** Page header / hero. */
  hero?: React.ReactNode;
  /** Article list grid (typically <ArticleListGrid /> with featured + posts). */
  articles: React.ReactNode;
  /** Optional newsletter signup. */
  newsletter?: React.ReactNode;
  footer: React.ComponentProps<typeof Footer>;
}

function BlogHomeTemplate({
  topbar,
  hero,
  articles,
  newsletter,
  footer,
  className,
  ...props
}: BlogHomeTemplateProps) {
  return (
    <div
      data-slot="blog-home-template"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('bg-background text-foreground', className)}
      {...props}
    >
      <Topbar {...topbar} />

      {hero ? (
        <SectionBoundary name="blog-hero" skeletonVariant="page-header">
          {hero}
        </SectionBoundary>
      ) : null}

      <SectionBoundary name="blog-articles" skeletonVariant="article-card">
        {articles}
      </SectionBoundary>

      {newsletter ? (
        <SectionBoundary
          name="blog-newsletter"
          skeletonVariant="newsletter-form"
        >
          {newsletter}
        </SectionBoundary>
      ) : null}

      <Footer {...footer} />
    </div>
  );
}
BlogHomeTemplate.displayName = 'BlogHomeTemplate';

/**
 * Page-level loading state — the full-page silhouette of
 * `<BlogHomeTemplate>`, not a single rect. Rendered by the consumer while
 * the whole route's data is in flight (`loading.tsx` in Next.js), or as
 * a `<SectionBoundary skeleton={…}>` override.
 *
 * Shapes mirror the real layout so the swap is CLS-neutral (R23). One
 * `role="status"` region for the page; inner skeletons pass
 * `label={null}` so screen readers hear one announcement, not ten.
 */
function BlogHomeTemplateSkeleton({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="blog-home-template-skeleton"
      data-min-viewport={String(MIN_VIEWPORT)}
      role="status"
      aria-busy="true"
      aria-label="Loading posts…"
      className={cn('bg-background text-foreground', className)}
      {...props}
    >
      <Skeleton
        variant="rect"
        className="h-14 w-full rounded-none"
        label={null}
      />
      <Container size="content">
        <Stack gap="xl" className="py-xl">
          <Skeleton variant="page-header" label={null} />
          <Skeleton variant="article-card" count={3} label={null} />
          <Skeleton variant="newsletter-form" label={null} />
        </Stack>
      </Container>
    </div>
  );
}
BlogHomeTemplateSkeleton.displayName = 'BlogHomeTemplateSkeleton';
BlogHomeTemplate.Skeleton = BlogHomeTemplateSkeleton;

export { BlogHomeTemplate };
export type { BlogHomeTemplateProps };
