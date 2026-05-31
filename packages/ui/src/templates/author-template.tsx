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

export { AuthorTemplate };
export type { AuthorTemplateProps };
