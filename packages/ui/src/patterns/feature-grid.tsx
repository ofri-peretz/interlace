/**
 * @interlace/ui — FeatureGrid
 *
 * Grid of small "feature" cards: icon + title + 1-2 line description.
 * The shape every landing page reaches for to spell out "what we do" in
 * 3-6 cells. Server component, no hooks.
 *
 * ## Anatomy
 *
 *   <section data-slot="feature-grid" data-min-viewport="320">
 *     <Container><Grid cols={3}>{features.map(...)}</Grid></Container>
 *   </section>
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'section'>` + FeatureGrid props       |
 * | R6   | data-slot on root                | `data-slot="feature-grid"` + `data-slot="feature"` per cell |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R10  | Composition seam (slots)         | `features` array of {icon, title, description}              |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`                                         |
 * | R19  | Tokens only                      | spacing + radius + token colours                            |
 * | R20  | AA contrast                      | foreground on background                                    |
 * | R25  | Server component                 | No hooks                                                    |
 * | R26  | A11y                             | `<section>` landmark; icons aria-hidden, titles as h3       |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Container } from '../primitives/container.js';
import { Grid } from '../primitives/grid.js';
import { Skeleton } from '../primitives/skeleton.js';
import { Stack } from '../primitives/stack.js';
import { Typography } from '../primitives/typography.js';

export const MIN_VIEWPORT = 320 as const;

interface FeatureItem {
  /** Decorative icon — typically a lucide icon, marked aria-hidden. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional CTA inside the card. */
  action?: React.ReactNode;
}

interface FeatureGridProps extends Omit<React.ComponentProps<'section'>, 'title'> {
  /** Section title (renders as h2 above the grid). */
  title?: React.ReactNode;
  /** One-line lead under the title. */
  lead?: React.ReactNode;
  /** Feature cells. */
  features?: FeatureItem[];
  /**
   * Grid column count at md+. Defaults to 3 (one of 2 / 3 / 4 — same as
   * the Grid primitive's closed enum). Mobile is always 1 column.
   */
  cols?: 2 | 3 | 4;
  /** When true, render a placeholder grid of card skeletons. */
  loading?: boolean;
  /** Skeleton count when loading. Defaults to `cols`. */
  loadingCount?: number;
}

function FeatureGrid({
  title,
  lead,
  features = [],
  cols = 3,
  loading,
  loadingCount,
  className,
  ...props
}: FeatureGridProps) {
  const skeletonCount = loadingCount ?? cols;
  return (
    <section
      data-slot="feature-grid"
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
          {loading ? (
            <Grid cols={cols} gap="md">
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <Skeleton key={i} variant="card" label={null} />
              ))}
            </Grid>
          ) : features.length > 0 ? (
            <Grid cols={cols} gap="md">
              {features.map((f, i) => (
                <article
                  key={i}
                  data-slot="feature"
                  className="border-border bg-card text-card-foreground flex flex-col gap-sm rounded-lg border p-md"
                >
                  {f.icon ? (
                    <div className="text-primary" aria-hidden>
                      {f.icon}
                    </div>
                  ) : null}
                  <Typography variant="h4" as="h3">
                    {f.title}
                  </Typography>
                  {f.description ? (
                    <Typography variant="body" tone="muted">
                      {f.description}
                    </Typography>
                  ) : null}
                  {f.action ? <div className="mt-xs">{f.action}</div> : null}
                </article>
              ))}
            </Grid>
          ) : null}
        </Stack>
      </Container>
    </section>
  );
}
FeatureGrid.displayName = 'FeatureGrid';

export { FeatureGrid };
export type { FeatureGridProps, FeatureItem };
