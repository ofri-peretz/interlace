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
  /** Highlights the card with a violet ring. Use on the "Most popular" tier. */
  featured?: boolean;
}

interface PricingTableProps extends Omit<React.ComponentProps<'section'>, 'title'> {
  title?: React.ReactNode;
  lead?: React.ReactNode;
  tiers?: PricingTier[];
  cols?: 2 | 3 | 4;
  loading?: boolean;
}

function PricingTable({
  title,
  lead,
  tiers = [],
  cols = 3,
  loading,
  className,
  ...props
}: PricingTableProps) {
  return (
    <section
      data-slot="pricing-table"
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
          <Grid cols={cols} gap="md">
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
                      'border-border bg-card text-card-foreground relative flex flex-col gap-md rounded-lg border p-md',
                      tier.featured && 'border-primary ring-primary/40 ring-2',
                    )}
                  >
                    {tier.featured ? (
                      <span className="bg-primary text-primary-foreground absolute -top-3 right-md rounded-full px-sm py-xs text-xs font-semibold">
                        Most popular
                      </span>
                    ) : null}
                    <Typography variant="h4" as="h3">
                      {tier.name}
                    </Typography>
                    <div className="flex items-baseline gap-xs">
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
                      <ul className="flex flex-col gap-xs text-sm">
                        {tier.features.map((feature, fi) => (
                          <li key={fi} className="flex items-start gap-xs">
                            <Check
                              aria-hidden
                              className="text-primary mt-1 size-4 shrink-0"
                            />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {tier.cta ? <div className="mt-auto pt-md">{tier.cta}</div> : null}
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
