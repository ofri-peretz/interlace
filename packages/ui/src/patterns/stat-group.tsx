/**
 * @interlace/ui — StatGroup
 *
 * Horizontal row (or grid) of StatCards. The pattern stat pages reach
 * for: 3-5 hero KPIs at the top of a page, each a labelled big number.
 * Server component.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'section'>`                           |
 * | R6   | data-slot on root                | `data-slot="stat-group"`                                    |
 * | R10  | Composition seam (stats)         | `stats: StatCardProps[]`                                    |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R25  | Server component                 | No hooks                                                    |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Grid } from '../primitives/grid.js';
import { Skeleton } from '../primitives/skeleton.js';
import { StatCard } from './stat-card.js';

export const MIN_VIEWPORT = 320 as const;

type StatItem = React.ComponentProps<typeof StatCard>;

interface StatGroupProps extends React.ComponentProps<'section'> {
  stats?: StatItem[];
  cols?: 2 | 3 | 4;
  loading?: boolean;
}

function StatGroup({
  stats = [],
  cols = 3,
  loading,
  className,
  ...props
}: StatGroupProps) {
  return (
    <section
      data-slot="stat-group"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('w-full', className)}
      {...props}
    >
      <Grid cols={cols} gap="md">
        {loading
          ? Array.from({ length: cols }).map((_, i) => (
              <Skeleton key={i} variant="stat-card" label={null} />
            ))
          : stats.map((stat, i) => <StatCard key={i} {...stat} />)}
      </Grid>
    </section>
  );
}
StatGroup.displayName = 'StatGroup';

export { StatGroup };
export type { StatGroupProps };
