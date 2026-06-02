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

export { BlogHomeTemplate };
export type { BlogHomeTemplateProps };
