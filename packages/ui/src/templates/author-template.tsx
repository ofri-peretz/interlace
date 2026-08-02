/**
 * @interlace/ui — AuthorTemplate
 *
 * Author profile page — bio header + their articles grid. Used by
 * `/authors/[slug]` routes on a blog. The bio header is a multi-part
 * card (avatar + name + role + bio + social links); the grid uses
 * ArticleListGrid for the article list.
 *
 * ## MIN_VIEWPORT — 320
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Container } from '../primitives/container.js';
import { SectionBoundary } from '../primitives/section-boundary.js';
import { Stack } from '../primitives/stack.js';
import { Topbar } from '../patterns/topbar.js';
import { Footer } from '../patterns/footer.js';
import { Skeleton } from '../primitives/skeleton.js';

export const MIN_VIEWPORT = 320 as const;

interface AuthorTemplateProps extends React.ComponentProps<'div'> {
  topbar: React.ComponentProps<typeof Topbar>;
  /**
   * Author bio header — consumer-supplied. Typically renders
   * <AuthorByline /> + a paragraph + social links.
   */
  bio: React.ReactNode;
  /** Article grid — typically <ArticleListGrid title="By Ofri" posts={...} />. */
  articles: React.ReactNode;
  footer?: React.ComponentProps<typeof Footer>;
}

function AuthorTemplate({
  topbar,
  bio,
  articles,
  footer,
  className,
  ...props
}: AuthorTemplateProps) {
  return (
    <div
      data-slot="author-template"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('bg-background text-foreground', className)}
      {...props}
    >
      <Topbar {...topbar} />

      <main>
        <Container size="prose">
          <Stack gap="xl" className="py-xl">
            <SectionBoundary name="author-bio" skeletonVariant="author-byline">
              {bio}
            </SectionBoundary>

            <SectionBoundary
              name="author-articles"
              skeletonVariant="article-card"
            >
              {articles}
            </SectionBoundary>
          </Stack>
        </Container>
      </main>

      {footer ? <Footer {...footer} /> : null}
    </div>
  );
}
AuthorTemplate.displayName = 'AuthorTemplate';

/**
 * Page-level loading state — the full-page silhouette of
 * `<AuthorTemplate>`, not a single rect. Rendered by the consumer while
 * the whole route's data is in flight (`loading.tsx` in Next.js), or as
 * a `<SectionBoundary skeleton={…}>` override.
 *
 * Shapes mirror the real layout so the swap is CLS-neutral (R23). One
 * `role="status"` region for the page; inner skeletons pass
 * `label={null}` so screen readers hear one announcement, not ten.
 */
function AuthorTemplateSkeleton({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="author-template-skeleton"
      data-min-viewport={String(MIN_VIEWPORT)}
      role="status"
      aria-busy="true"
      aria-label="Loading author…"
      className={cn('bg-background text-foreground', className)}
      {...props}
    >
      <Skeleton
        variant="rect"
        className="h-14 w-full rounded-none"
        label={null}
      />
      <Container size="prose">
        <Stack gap="xl" className="py-xl">
          <Skeleton variant="author-byline" label={null} />
          <Skeleton variant="article-card" count={3} label={null} />
        </Stack>
      </Container>
    </div>
  );
}
AuthorTemplateSkeleton.displayName = 'AuthorTemplateSkeleton';
AuthorTemplate.Skeleton = AuthorTemplateSkeleton;

export { AuthorTemplate };
export type { AuthorTemplateProps };
