/**
 * @interlace/ui — TagTemplate
 *
 * Tag-filtered article index. Used by `/tags/[slug]` routes on a blog
 * to show "all articles tagged #typescript" etc. Shows a header
 * ("Tagged: #typescript") then an ArticleListGrid of matching posts.
 *
 * ## MIN_VIEWPORT — 320
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Container } from '../primitives/container.js';
import { SectionBoundary } from '../primitives/section-boundary.js';
import { Stack } from '../primitives/stack.js';
import { Tag } from '../primitives/tag.js';
import { Typography } from '../primitives/typography.js';
import { Topbar } from '../patterns/topbar.js';
import { Footer } from '../patterns/footer.js';
import { Skeleton } from '../primitives/skeleton.js';

export const MIN_VIEWPORT = 320 as const;

interface TagTemplateProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  topbar: React.ComponentProps<typeof Topbar>;
  /** Tag name (rendered in the h1). */
  tagName: string;
  /** Optional URL for the tag chip in the header. */
  tagHref?: string;
  /** Optional one-line lead under the title. */
  lead?: React.ReactNode;
  /** Article grid — typically <ArticleListGrid posts={...} />. */
  articles: React.ReactNode;
  /** Optional sibling-tag cluster for navigation. */
  relatedTags?: React.ReactNode;
  footer?: React.ComponentProps<typeof Footer>;
}

function TagTemplate({
  topbar,
  tagName,
  tagHref,
  lead,
  articles,
  relatedTags,
  footer,
  className,
  ...props
}: TagTemplateProps) {
  return (
    <div
      data-slot="tag-template"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-tag={tagName}
      className={cn('bg-background text-foreground', className)}
      {...props}
    >
      <Topbar {...topbar} />

      <main>
        <Container size="content">
          <Stack gap="xl" className="py-xl">
            <SectionBoundary name="tag-header" skeletonVariant="page-header">
              <Stack gap="sm">
                <Typography variant="h1" as="h1" className="text-balance">
                  Tagged:{' '}
                  <Tag href={tagHref ?? '#'} tone="primary">
                    #{tagName}
                  </Tag>
                </Typography>
                {lead ? (
                  <Typography variant="long" tone="muted" className="max-w-prose">
                    {lead}
                  </Typography>
                ) : null}
              </Stack>
            </SectionBoundary>

            <SectionBoundary
              name="tag-articles"
              skeletonVariant="article-card"
            >
              {articles}
            </SectionBoundary>

            {relatedTags ? (
              <SectionBoundary
                name="tag-related"
                skeletonVariant="text"
              >
                <Stack gap="sm">
                  <Typography variant="h3" as="h2">
                    Related tags
                  </Typography>
                  {relatedTags}
                </Stack>
              </SectionBoundary>
            ) : null}
          </Stack>
        </Container>
      </main>

      {footer ? <Footer {...footer} /> : null}
    </div>
  );
}
TagTemplate.displayName = 'TagTemplate';

/**
 * Page-level loading state — the full-page silhouette of
 * `<TagTemplate>`, not a single rect. Rendered by the consumer while
 * the whole route's data is in flight (`loading.tsx` in Next.js), or as
 * a `<SectionBoundary skeleton={…}>` override.
 *
 * Shapes mirror the real layout so the swap is CLS-neutral (R23). One
 * `role="status"` region for the page; inner skeletons pass
 * `label={null}` so screen readers hear one announcement, not ten.
 */
function TagTemplateSkeleton({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="tag-template-skeleton"
      data-min-viewport={String(MIN_VIEWPORT)}
      role="status"
      aria-busy="true"
      aria-label="Loading tagged posts…"
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
          <Skeleton variant="tag" count={2} label={null} />
        </Stack>
      </Container>
    </div>
  );
}
TagTemplateSkeleton.displayName = 'TagTemplateSkeleton';
TagTemplate.Skeleton = TagTemplateSkeleton;

export { TagTemplate };
export type { TagTemplateProps };
