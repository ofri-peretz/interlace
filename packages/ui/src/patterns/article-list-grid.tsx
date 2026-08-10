/**
 * @interlace/ui — ArticleListGrid
 *
 * Grid of ArticleCards with an optional featured slot above. The pattern
 * blog index pages reach for: one big featured card (overlay variant)
 * above N tiles. Composes RelatedPosts-style streaming with proper
 * loading + empty states.
 *
 * ## Anatomy
 *
 *   <section data-slot="article-list-grid" data-min-viewport="320">
 *     <Container>
 *       {featured && <ArticleCard variant="overlay" priority />}
 *       <Grid cols={3}>{posts.map(<ArticleCard />)}</Grid>
 *     </Container>
 *   </section>
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'section'>` + props                   |
 * | R6   | data-slot on root                | `data-slot="article-list-grid"`                             |
 * | R10  | Composition seam                 | `featured` + `posts` arrays of ArticleCard props            |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`                                         |
 * | R25  | Server component                 | No hooks                                                    |
 * | R26  | A11y                             | `<section>` landmark                                        |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Container } from '../primitives/container.js';
import { Grid } from '../primitives/grid.js';
import { Skeleton } from '../primitives/skeleton.js';
import { Stack } from '../primitives/stack.js';
import { Typography } from '../primitives/typography.js';
import { ArticleCard, type ArticleCardProps } from './article-card.js';

export const MIN_VIEWPORT = 320 as const;

interface ArticleListGridProps extends Omit<React.ComponentProps<'section'>, 'title'> {
  title?: React.ReactNode;
  lead?: React.ReactNode;
  /** Optional featured article (renders as a hero card above the grid). */
  featured?: ArticleCardProps;
  /** Regular tiles. */
  posts?: ArticleCardProps[];
  cols?: 2 | 3 | 4;
  loading?: boolean;
  loadingCount?: number;
  /** Custom empty state. Defaults to a small muted line. */
  emptyState?: React.ReactNode;
}

/**
 * Mobile-first track counts per desktop `cols`. Written out statically because
 * Tailwind cannot scan a runtime-built `sm:grid-cols-${n}`.
 */
const ARTICLE_GRID_COLS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

function ArticleListGrid({
  title,
  lead,
  featured,
  posts = [],
  cols = 3,
  loading,
  loadingCount,
  emptyState,
  className,
  ...props
}: ArticleListGridProps) {
  const skeletonCount = loadingCount ?? cols;
  const isEmpty = !loading && !featured && posts.length === 0;
  return (
    <section
      data-slot="article-list-grid"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('py-xl', className)}
      {...props}
    >
      <Container size="content">
        <Stack gap="lg">
          {(title || lead) && (
            <Stack gap="sm">
              {title ? (
                <Typography variant="h2" as="h2" className="text-balance">
                  {title}
                </Typography>
              ) : null}
              {lead ? (
                <Typography variant="long" tone="muted">
                  {lead}
                </Typography>
              ) : null}
            </Stack>
          )}
          {loading ? (
            <>
              <Skeleton variant="article-card" className="h-72 w-full" label={null} />
              {/* Responsive collapse: `cols` is a DESKTOP count. Unqualified it
                  holds 3 tracks at 375px and the truncated author name inside
                  each card measures 0px wide — invisible. */}
              <Grid cols={cols} gap="md" className={ARTICLE_GRID_COLS[cols]}>
                {Array.from({ length: skeletonCount }).map((_, i) => (
                  <Skeleton key={i} variant="article-card" label={null} />
                ))}
              </Grid>
            </>
          ) : isEmpty ? (
            emptyState ?? (
              <Typography variant="long" tone="muted" className="text-center">
                No articles yet.
              </Typography>
            )
          ) : (
            <>
              {featured ? (
                <ArticleCard {...featured} variant="overlay" priority />
              ) : null}
              {posts.length > 0 ? (
                <Grid cols={cols} gap="md" className={ARTICLE_GRID_COLS[cols]}>
                  {posts.map((post, i) => (
                    <ArticleCard key={i} {...post} />
                  ))}
                </Grid>
              ) : null}
            </>
          )}
        </Stack>
      </Container>
    </section>
  );
}
ArticleListGrid.displayName = 'ArticleListGrid';

export { ArticleListGrid };
export type { ArticleListGridProps };
