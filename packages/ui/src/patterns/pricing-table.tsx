/**
 * @interlace/ui — PricingTable
 *
 * 2-4 column pricing-tier grid. Each tier is a card with name, price,
 * description, feature list, and a CTA button. The "Most popular" tier
 * gets a highlight border. Server component.
 *
 * ## Anatomy
 *
 *   <section data-slot="pricing-table" data-min-viewport="320">
 *     <Container>
 *       <Grid>{tiers.map(<PricingCard/>)}</Grid>
 *     </Container>
 *   </section>
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'section'>` + PricingTable props      |
 * | R6   | data-slot on root                | `data-slot="pricing-table"` + `data-slot="pricing-tier"`    |
 * | R10  | Composition seam (tiers)         | Array<PricingTier>                                          |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R25  | Server component                 | No hooks                                                    |
 * | R26  | A11y                             | semantic <article>, <ul>, <button>                          |
 */

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Container } from '../primitives/container.js';
import { Grid } from '../primitives/grid.js';
import { Skeleton } from '../primitives/skeleton.js';
import { Stack } from '../primitives/stack.js';
import { Typography } from '../primitives/typography.js';

export const MIN_VIEWPORT = 320 as const;

interface PricingTier {
  name: React.ReactNode;
  price: React.ReactNode;
  /** Optional sub-text after the price (e.g. "/ month"). */
  pricePer?: React.ReactNode;
  description?: React.ReactNode;
  features?: React.ReactNode[];
  /** CTA button. */
  cta?: React.ReactNode;
  /** Highlights the card with a brand-primary ring. Use on the "Most popular" tier. */
  featured?: boolean;
}

interface PricingTableProps extends Omit<React.ComponentProps<'section'>, 'title'> {
  title?: React.ReactNode;
  lead?: React.ReactNode;
  tiers?: PricingTier[];
  cols?: 2 | 3 | 4;
  /**
   * How much air the collection has: the gap between cards, the section's
   * padding and each tier's padding.
   * `compact` for dashboards and sidebars, `relaxed` for a landing page.
   * @default 'default'
   */
  density?: 'compact' | 'default' | 'relaxed';
  loading?: boolean;
}

/**
 * Track counts per `cols`, keyed on the width of this component (it is the
 * `@container`), not the viewport: the same grid in a sidebar or a card
 * collapses as it would on a phone. Two tracks from 28rem, the full count
 * from 56rem. Written out statically because Tailwind cannot scan a
 * runtime-built `@4xl:grid-cols-${n}`.
 */
const TIER_GRID_COLS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-1 @md:grid-cols-2',
  3: 'grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-3',
  4: 'grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-4',
};

/** Card gap per `density`, on the Grid primitive's closed gap scale. */
const DENSITY_GAP = { compact: 'sm', default: 'md', relaxed: 'lg' } as const;
/** Section padding per `density`. */
const DENSITY_SECTION = { compact: 'py-10', default: 'py-16', relaxed: 'py-24' } as const;
/** Tier padding and the rhythm inside it per `density`, so the inside never breathes more than the shell. */
const DENSITY_CARD = { compact: 'gap-4 p-4', default: 'gap-6 p-6', relaxed: 'gap-8 p-8' } as const;
/** Space above a tier's CTA per `density`, on the same step as the tier's padding. */
const DENSITY_CTA = { compact: 'pt-4', default: 'pt-6', relaxed: 'pt-8' } as const;

function PricingTable({
  title,
  lead,
  tiers = [],
  cols = 3,
  density = 'default',
  loading,
  className,
  ...props
}: PricingTableProps) {
  return (
    <section
      data-slot="pricing-table"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-density={density}
      className={cn('@container', DENSITY_SECTION[density], className)}
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
          {/* Responsive collapse: `cols` is a DESKTOP count. Left unqualified
              it holds 3 tracks at every width — a 98px tier card on a 375px
              phone, whose price and CTA button overflow the viewport. */}
          <Grid cols={cols} gap={DENSITY_GAP[density]} className={TIER_GRID_COLS[cols]}>
            {loading
              ? Array.from({ length: cols }).map((_, i) => (
                  <Skeleton key={i} variant="card" label={null} />
                ))
              : tiers.map((tier, i) => (
                  <article
                    key={i}
                    data-slot="pricing-tier"
                    data-featured={tier.featured ? '' : undefined}
                    className={cn(
                      'border-border bg-card text-card-foreground relative flex flex-col rounded-xl border',
                      DENSITY_CARD[density],
                      tier.featured && 'border-primary ring-primary/40 ring-2',
                    )}
                  >
                    {tier.featured ? (
                      <span className="bg-primary text-primary-foreground absolute -top-3 end-6 rounded-full px-4 py-2 text-xs font-semibold">
                        Most popular
                      </span>
                    ) : null}
                    <Typography variant="h4" as="h3">
                      {tier.name}
                    </Typography>
                    <div className="flex items-baseline gap-2">
                      <Typography variant="h2" as="span" className="leading-none">
                        {tier.price}
                      </Typography>
                      {tier.pricePer ? (
                        <Typography variant="ui" as="span" tone="muted">
                          {tier.pricePer}
                        </Typography>
                      ) : null}
                    </div>
                    {tier.description ? (
                      <Typography variant="body" tone="muted">
                        {tier.description}
                      </Typography>
                    ) : null}
                    {tier.features && tier.features.length > 0 ? (
                      <ul className="flex flex-col gap-2 text-sm">
                        {tier.features.map((feature, fi) => (
                          <li key={fi} className="flex items-start gap-2">
                            <Check aria-hidden className="text-primary mt-1 size-4 shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {tier.cta ? (
                      <div className={cn('mt-auto', DENSITY_CTA[density])}>{tier.cta}</div>
                    ) : null}
                  </article>
                ))}
          </Grid>
        </Stack>
      </Container>
    </section>
  );
}
PricingTable.displayName = 'PricingTable';

export { PricingTable };
export type { PricingTableProps, PricingTier };
