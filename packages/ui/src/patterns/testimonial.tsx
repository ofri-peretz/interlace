/**
 * @interlace/ui — Testimonial + TestimonialGrid
 *
 * Quote + attribution surfaces. Single Testimonial cells render an
 * blockquote with an author avatar; TestimonialGrid lays them out in
 * a 1-3 column grid. Server components.
 *
 * ## Anatomy
 *
 *   Testimonial:
 *     <figure data-slot="testimonial" data-min-viewport="320">
 *       <blockquote>{quote}</blockquote>
 *       <figcaption>
 *         <Avatar /> <cite>{author}</cite> · <span>{role}</span>
 *       </figcaption>
 *     </figure>
 *
 *   TestimonialGrid:
 *     <section data-slot="testimonial-grid"><Container>
 *       <Grid cols={3}>{items.map(<Testimonial/>)}</Grid>
 *     </Container></section>
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | Testimonial extends `<figure>`; Grid extends `<section>`    |
 * | R6   | data-slot on root                | `data-slot="testimonial"` / `data-slot="testimonial-grid"`  |
 * | R10  | Composition seam                 | TestimonialGrid takes `items: Testimonial[]`                |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`                                         |
 * | R19  | Tokens only                      | bg-card, border-border, semantic foreground                 |
 * | R25  | Server component                 | No hooks                                                    |
 * | R26  | A11y                             | semantic <blockquote> + <cite>                              |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Avatar, AvatarImage, AvatarFallback } from '../primitives/avatar.js';
import { Container } from '../primitives/container.js';
import { Grid } from '../primitives/grid.js';
import { Skeleton } from '../primitives/skeleton.js';
import { Stack } from '../primitives/stack.js';
import { Typography } from '../primitives/typography.js';

export const MIN_VIEWPORT = 320 as const;

interface TestimonialItem {
  quote: React.ReactNode;
  authorName: string;
  authorRole?: React.ReactNode;
  authorAvatar?: string;
}

interface TestimonialProps
  extends Omit<React.ComponentProps<'figure'>, 'children'>,
    TestimonialItem {
  /** When true, render a placeholder card. */
  loading?: boolean;
}

function initialOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

function Testimonial({
  quote,
  authorName,
  authorRole,
  authorAvatar,
  loading,
  className,
  ...props
}: TestimonialProps) {
  if (loading) {
    return (
      <Skeleton
        variant="card"
        data-slot="testimonial"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={className}
      />
    );
  }
  return (
    <figure
      data-slot="testimonial"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        'border-border bg-card text-card-foreground flex flex-col gap-md rounded-lg border p-md',
        className,
      )}
      {...props}
    >
      <blockquote className="text-body leading-body text-foreground">
        “{quote}”
      </blockquote>
      <figcaption className="flex items-center gap-sm">
        <Avatar className="size-9 shrink-0">
          {authorAvatar ? (
            <AvatarImage src={authorAvatar} alt="" />
          ) : null}
          <AvatarFallback>{initialOf(authorName)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <cite className="font-body text-ui font-semibold not-italic text-foreground">
            {authorName}
          </cite>
          {authorRole ? (
            <span className="text-muted-foreground text-sm">{authorRole}</span>
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
}
Testimonial.displayName = 'Testimonial';

interface TestimonialGridProps extends Omit<React.ComponentProps<'section'>, 'title'> {
  title?: React.ReactNode;
  lead?: React.ReactNode;
  items?: TestimonialItem[];
  cols?: 1 | 2 | 3;
  loading?: boolean;
  loadingCount?: number;
}

/**
 * Mobile-first track counts per desktop `cols`. Written out statically because
 * Tailwind cannot scan a runtime-built `sm:grid-cols-${n}`.
 */
const TESTIMONIAL_GRID_COLS: Record<1 | 2 | 3, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

function TestimonialGrid({
  title,
  lead,
  items = [],
  cols = 3,
  loading,
  loadingCount,
  className,
  ...props
}: TestimonialGridProps) {
  const skeletonCount = loadingCount ?? cols;
  return (
    <section
      data-slot="testimonial-grid"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('py-xl', className)}
      {...props}
    >
      <Container size="content">
        <Stack gap="lg">
          {(title || lead) && (
            <Stack gap="sm" align="center" className="text-center">
              {title ? (
                <Typography variant="h2" as="h2" className="text-balance">
                  {title}
                </Typography>
              ) : null}
              {lead ? (
                <Typography variant="long" tone="muted" className="max-w-prose">
                  {lead}
                </Typography>
              ) : null}
            </Stack>
          )}
          {/* Responsive collapse: `cols` is a DESKTOP count. Unqualified it
              keeps 3 tracks at 375px, squeezing each quote card until the
              author name and role collapse to zero width and vanish. */}
          <Grid cols={cols} gap="md" className={TESTIMONIAL_GRID_COLS[cols]}>
            {loading
              ? Array.from({ length: skeletonCount }).map((_, i) => (
                  <Skeleton key={i} variant="card" label={null} />
                ))
              : items.map((item, i) => <Testimonial key={i} {...item} />)}
          </Grid>
        </Stack>
      </Container>
    </section>
  );
}
TestimonialGrid.displayName = 'TestimonialGrid';

export { Testimonial, TestimonialGrid };
export type { TestimonialProps, TestimonialGridProps, TestimonialItem };
