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

export { TagTemplate };
export type { TagTemplateProps };
