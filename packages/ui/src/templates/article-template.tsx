/**
 * @interlace/ui — ArticleTemplate
 *
 * Full-page surface for long-form articles. Composes the header
 * (title + AuthorByline), the body (Prose-wrapped MDX/HTML),
 * the related-posts grid, prev/next navigation, and share buttons —
 * each in its own `<SectionBoundary>` so the page streams section-by-
 * section instead of blocking on the slowest data source.
 *
 * This is the canonical example of the 5-layer architecture in action:
 *
 *   • PRIMITIVES — Container, Prose, Typography (the chrome)
 *   • PATTERNS   — AuthorByline, RelatedPosts, PrevNextPost, ShareButtons
 *   • TEMPLATE   — composes the patterns inside SectionBoundaries
 *
 * A consumer drops:
 *
 *   <ArticleTemplate
 *     header={await getArticleHeader(slug)}        ← async RSC suspends
 *     body={<MDXRenderer source={await getBody(slug)} />}
 *     related={await getRelatedArticles(slug)}      ← async, independent
 *     prevNext={await getPrevNext(slug)}            ← async, independent
 *     shareUrl={absoluteUrl(slug)}
 *   />
 *
 * Each async prop suspends INSIDE its own SectionBoundary, so the page
 * paints incrementally — header first (small payload), then body, then
 * related/prev-next (the slowest queries).
 *
 * ## Anatomy
 *
 *   <article data-slot="article-template" data-min-viewport="320">
 *     <Container size="prose">
 *       <SectionBoundary name="article-header">
 *         <Typography variant="h1">{title}</Typography>
 *         <AuthorByline {...byline} />
 *       </SectionBoundary>
 *       <SectionBoundary name="article-body">
 *         <Prose>{body}</Prose>
 *       </SectionBoundary>
 *       <SectionBoundary name="article-share">
 *         <ShareButtons {...share} />
 *       </SectionBoundary>
 *       <SectionBoundary name="article-prev-next">
 *         <PrevNextPost prev={...} next={...} />
 *       </SectionBoundary>
 *       <SectionBoundary name="article-related">
 *         <RelatedPosts posts={...} />
 *       </SectionBoundary>
 *     </Container>
 *   </article>
 *
 * ## MIN_VIEWPORT — 320
 *
 * Every composed primitive/pattern declares 320 (Container.prose,
 * Prose, AuthorByline, etc.); the template inherits that floor.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'article'>` + template props          |
 * | R6   | data-slot on root                | `data-slot="article-template"`                              |
 * | R7   | className merged + ...rest       | `cn(className)` + `{...props}` on <article>                 |
 * | R10  | Composition seam (slots)         | `header` / `body` / `related` / `prevNext` / `shareUrl` props |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}`                  |
 * | R18  | Tailwind only                    | Zero inline `style`; layout via Container + cn()            |
 * | R19  | Tokens only                      | (delegated to composed primitives — they own the tokens)    |
 * | R20  | AA contrast                      | (delegated)                                                  |
 * | R25  | Server component                 | Pure composition — no hooks                                 |
 * | R26  | A11y                             | `<article>` landmark + per-section `<SectionBoundary>` regions |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { SectionBoundary } from '../primitives/section-boundary.js';
import { Container } from '../primitives/container.js';
import { Prose } from '../primitives/prose.js';
import { Typography } from '../primitives/typography.js';
import { AuthorByline } from '../patterns/author-byline.js';
import { PrevNextPost } from '../patterns/prev-next-post.js';
import { RelatedPosts } from '../patterns/related-posts.js';
import { ShareButtons } from '../patterns/share-buttons.js';

export const MIN_VIEWPORT = 320 as const;

interface ArticleTemplateProps
  extends Omit<React.ComponentProps<'article'>, 'title'> {
  /** Article title — rendered as the h1. Required (it's the landmark). */
  title: React.ReactNode;
  /**
   * Author + publish date + reading-time row, rendered under the title.
   * Consumer can either pass the full ReactNode (max flexibility — e.g.
   * to add their own meta chip) or use `byline` for the standard
   * AuthorByline pattern.
   */
  header?: React.ReactNode;
  /** Shortcut: AuthorByline props. Ignored when `header` is provided. */
  byline?: React.ComponentProps<typeof AuthorByline>;
  /**
   * The article body. Wrapped in <Prose> for the canonical type contract.
   * Pass either rendered MDX/HTML (`<div dangerouslySetInnerHTML={...} />`),
   * a stream of MDX components, or any ReactNode.
   */
  body: React.ReactNode;
  /** Prev/next links (footer of the article). Both are optional. */
  prevNext?: React.ComponentProps<typeof PrevNextPost>;
  /** Related-articles grid (after prev/next). */
  related?: React.ComponentProps<typeof RelatedPosts>;
  /**
   * Share-buttons row. When provided, renders between body and prev/next.
   * Set to `null` to suppress entirely (some publications hide social
   * surfaces on niche posts).
   */
  share?: React.ComponentProps<typeof ShareButtons> | null;
}

function ArticleTemplate({
  title,
  header,
  byline,
  body,
  prevNext,
  related,
  share,
  className,
  ...props
}: ArticleTemplateProps) {
  return (
    <article
      data-slot="article-template"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('py-xl', className)}
      {...props}
    >
      <Container size="prose">
        <SectionBoundary name="article-header" skeletonVariant="page-header">
          <header className="flex flex-col gap-md">
            <Typography variant="h1" as="h1" className="text-balance">
              {title}
            </Typography>
            {header ?? (byline ? <AuthorByline {...byline} /> : null)}
          </header>
        </SectionBoundary>

        <SectionBoundary name="article-body" skeletonVariant="prose">
          <div className="mt-xl">
            <Prose>{body}</Prose>
          </div>
        </SectionBoundary>

        {share !== null && share !== undefined ? (
          <SectionBoundary
            name="article-share"
            skeletonVariant="card"
            className="mt-xl"
          >
            <ShareButtons {...share} />
          </SectionBoundary>
        ) : null}

        {prevNext ? (
          <SectionBoundary
            name="article-prev-next"
            skeletonVariant="card"
            className="mt-xl"
          >
            <PrevNextPost {...prevNext} />
          </SectionBoundary>
        ) : null}

        {related ? (
          <SectionBoundary
            name="article-related"
            skeletonVariant="article-card"
            className="mt-xl"
          >
            <RelatedPosts {...related} />
          </SectionBoundary>
        ) : null}
      </Container>
    </article>
  );
}
ArticleTemplate.displayName = 'ArticleTemplate';

export { ArticleTemplate };
export type { ArticleTemplateProps };
