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
  /**
   * How much air the collection has: the gap between cards and the section's padding.
   * `compact` for dashboards and sidebars, `relaxed` for a landing page.
   * @default 'default'
   */
  density?: 'compact' | 'default' | 'relaxed';
  loading?: boolean;
  loadingCount?: number;
  /** Custom empty state. Defaults to a small muted line. */
  emptyState?: React.ReactNode;
}

/**
 * Track counts per `cols`, keyed on the width of this component (it is the
 * `@container`), not the viewport: the same grid in a sidebar or a card
 * collapses as it would on a phone. Two tracks from 28rem, the full count
 * from 56rem. Written out statically because Tailwind cannot scan a
 * runtime-built `@4xl:grid-cols-${n}`.
 */
const ARTICLE_GRID_COLS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-1 @md:grid-cols-2',
  3: 'grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-3',
  4: 'grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-4',
};

/** Card gap per `density`, on the Grid primitive's closed gap scale. */
const DENSITY_GAP = { compact: 'sm', default: 'md', relaxed: 'lg' } as const;
/** Section padding per `density`. */
const DENSITY_SECTION = { compact: 'py-10', default: 'py-16', relaxed: 'py-24' } as const;

function ArticleListGrid({
  title,
  lead,
  featured,
  posts = [],
  cols = 3,
  density = 'default',
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
      data-density={density}
      className={cn('@container', DENSITY_SECTION[density], className)}
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
              <Grid cols={cols} gap={DENSITY_GAP[density]} className={ARTICLE_GRID_COLS[cols]}>
                {Array.from({ length: skeletonCount }).map((_, i) => (
                  <Skeleton key={i} variant="article-card" label={null} />
                ))}
              </Grid>
            </>
          ) : isEmpty ? (
            (emptyState ?? (
              <Typography variant="long" tone="muted" className="text-center">
                No articles yet.
              </Typography>
            ))
          ) : (
            <>
              {featured ? <ArticleCard {...featured} variant="overlay" priority /> : null}
              {posts.length > 0 ? (
                <Grid cols={cols} gap={DENSITY_GAP[density]} className={ARTICLE_GRID_COLS[cols]}>
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
