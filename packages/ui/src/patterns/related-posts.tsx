import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Grid } from '../primitives/grid.js';
import { Skeleton } from '../primitives/skeleton.js';
import { Typography } from '../primitives/typography.js';
import { ArticleCard } from './article-card.js';

/**
 * @interlace/ui — RelatedPosts
 *
 * "Keep reading" surface that sits at the foot of an article page (or any
 * long-form route). Renders an h3 section heading followed by a responsive
 * grid of ArticleCards: one column on phones, two from `md` up, three from
 * `lg` up — the same 1/2/3 cadence the homepage feed uses, so a reader who
 * scrolls between an article tail and the index sees the same rhythm.
 *
 * The block is intentionally a pure composition over ArticleCard's `stack`
 * variant: every metric this block could surface (date, kicker, summary)
 * already lives on ArticleCard's props, so this file owns ONLY the heading,
 * the grid, and the field mapping from the editorial-friendly post shape
 * (`href` / `title` / `summary` / `publishedDateIso` / `kicker?`) to the
 * card's prop names (`description` / `publishedAt` / `sourceLabel`). That
 * mapping is the entire reason this block exists — without it, every page
 * that wanted a "related" grid would re-roll its own naming.
 *
 * ## Anatomy
 *
 *   RelatedPosts                       (section — data-min-viewport=480)
 *     ├─ Typography h3                 (title — "Related posts" by default)
 *     └─ Grid cols=1 md:2 lg:3 gap=md  (one ArticleCard per post)
 *           └─ ArticleCard variant="stack"
 *
 * ## MIN_VIEWPORT — 480
 *
 * The block degrades gracefully to one column below 480 (the heading still
 * reads, the cards still tap), but the editorial intent is "a row of cards"
 * — at 320 you get a single-file list that's indistinguishable from a plain
 * link list, which defeats the purpose of using card chrome. Pages that
 * must work below 480 should reach for a `<ul>` of plain anchors instead.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'section'> & RelatedPostsProps`       |
 * | R6   | data-slot on root                | `data-slot="related-posts"`                                 |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R8   | No `isXxx`; no boolean variants  | n/a — composition-only block, no variants                   |
 * | R10  | Composition seam                 | `title` slot + `posts` array mapped into ArticleCard        |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes + primitives           |
 * | R19  | Tokens only                      | Spacing via `--spacing-*` (gap-md / mb-md), no raw px       |
 * | R20  | AA contrast                      | Heading + card surfaces use semantic tokens (AA-cleared)    |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | `<section>` landmark; heading carries the accessible name   |
 */

export const MIN_VIEWPORT = 480 as const;

/**
 * Editorial-friendly post shape. Maps onto `ArticleCard` as:
 *
 *   { href, title }            → ArticleCard {href, title}        (identity)
 *   summary                    → ArticleCard.description
 *   publishedDateIso           → ArticleCard.publishedAt           (ISO string)
 *   kicker?                    → ArticleCard.sourceLabel           (small uppercase chip)
 *
 * Why a separate shape? CMS / MDX frontmatter and blog data sources speak
 * `summary` + `publishedDateIso`, not `description` + `publishedAt`. Owning
 * the rename here keeps every consumer's data layer clean.
 */
export interface RelatedPost {
  /** Destination URL — same semantics as `ArticleCard.href`. */
  href: string;
  /** Headline — same semantics as `ArticleCard.title`. */
  title: string;
  /** Short excerpt under the headline. Renders as the card description. */
  summary: string;
  /**
   * Publication date as an ISO-8601 string (e.g. `2026-05-10`). Mapped to
   * `ArticleCard.publishedAt`; the card formats it as `Mar 5, 2026`.
   */
  publishedDateIso: string;
  /**
   * Optional small uppercase label (e.g. `"Tutorial"`, `"Dev.to"`). Maps to
   * `ArticleCard.sourceLabel`, which renders it as the top-right chip on
   * the cover.
   */
  kicker?: string;
}

type RelatedPostsProps = React.ComponentProps<'section'> & {
  /** Section heading. Default: `"Related posts"`. */
  title?: React.ReactNode;
  /** Posts to render. One ArticleCard per entry, in order. Optional when `loading={true}`. */
  posts?: RelatedPost[];
  /**
   * When true, render a grid of `<Skeleton variant="article-card" />`
   * placeholders (count derived from `loadingCount`, default 3) so the
   * page reserves the eventual grid footprint while data loads.
   */
  loading?: boolean;
  /** How many skeleton cards to render when `loading={true}`. Default 3. */
  loadingCount?: number;
};

/**
 * "Keep reading" grid. Server component (no hooks).
 *
 * Renders nothing (returns `null`) when `posts` is empty, so callers can
 * pass a possibly-empty array without guarding at the call site — matches
 * `EmptyState`'s contract that "empty is a first-class state owned by the
 * consumer, not the block".
 */
export function RelatedPosts({
  className,
  title = 'Related posts',
  posts,
  loading,
  loadingCount = 3,
  ...props
}: RelatedPostsProps) {
  if (loading) {
    return (
      <section
        data-slot="related-posts"
        data-min-viewport={String(MIN_VIEWPORT)}
        aria-label={typeof title === 'string' ? title : undefined}
        aria-busy="true"
        className={cn('w-full', className)}
        {...props}
      >
        <Typography variant="h3" as="h2" className="mb-md">
          {title}
        </Typography>
        <Grid cols={3} gap="md">
          {Array.from({ length: loadingCount }).map((_, i) => (
            <Skeleton key={i} variant="article-card" label={null} />
          ))}
        </Grid>
      </section>
    );
  }
  if (!posts || posts.length === 0) return null;

  return (
    <section
      data-slot="related-posts"
      data-min-viewport={String(MIN_VIEWPORT)}
      aria-label={typeof title === 'string' ? title : undefined}
      className={cn('w-full', className)}
      {...props}
    >
      <Typography as="h2" variant="h3" className="mb-md">
        {title}
      </Typography>
      {/*
        Grid's `cols` variant is static (R21 closed set). To get the
        responsive 1 / md:2 / lg:3 cadence the spec calls for, we ground the
        base track at cols=1 and override at md/lg via Tailwind responsive
        classes — these win at the breakpoint regardless of source order.
      */}
      <Grid
        cols={1}
        gap="md"
        className="md:grid-cols-2 lg:grid-cols-3"
      >
        {posts.map((post) => (
          <ArticleCard
            key={post.href}
            href={post.href}
            title={post.title}
            description={post.summary}
            publishedAt={post.publishedDateIso}
            sourceLabel={post.kicker}
            variant="stack"
          />
        ))}
      </Grid>
    </section>
  );
}
