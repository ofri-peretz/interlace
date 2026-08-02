/**
 * @interlace/ui — StatsTemplate
 *
 * Public-facing metrics page. Topbar + header (title + lead) +
 * SectionBoundary(StatGroup) + SectionBoundary(arbitrary chart/table
 * content) + optional methodology footnote + Footer.
 *
 * Used by `/stats`, internal reporting dashboards, public analytics
 * surfaces. Each loadable region streams via SectionBoundary so the
 * hero KPIs paint while the detail table is still fetching.
 *
 * ## MIN_VIEWPORT — 320
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Container } from '../primitives/container.js';
import { SectionBoundary } from '../primitives/section-boundary.js';
import { Stack } from '../primitives/stack.js';
import { Typography } from '../primitives/typography.js';
import { Topbar } from '../patterns/topbar.js';
import { Footer } from '../patterns/footer.js';
import { StatGroup } from '../patterns/stat-group.js';
import { StatCard } from '../patterns/stat-card.js';
import { Skeleton } from '../primitives/skeleton.js';

type StatCardProps = React.ComponentProps<typeof StatCard>;

export const MIN_VIEWPORT = 320 as const;

interface StatsTemplateProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  topbar: React.ComponentProps<typeof Topbar>;
  /** Page title. */
  title: React.ReactNode;
  /** One-paragraph lead under the title. */
  lead?: React.ReactNode;
  /** Hero KPI row (3-5 metrics). */
  hero?: StatCardProps[];
  /** Detail content (chart / table / etc.) — consumer-supplied. */
  children?: React.ReactNode;
  /**
   * Optional methodology footnote — explains where the numbers come
   * from. Rendered as a muted block under the body.
   */
  methodology?: React.ReactNode;
  footer?: React.ComponentProps<typeof Footer>;
}

function StatsTemplate({
  topbar,
  title,
  lead,
  hero,
  children,
  methodology,
  footer,
  className,
  ...props
}: StatsTemplateProps) {
  return (
    <div
      data-slot="stats-template"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('bg-background text-foreground', className)}
      {...props}
    >
      <Topbar {...topbar} />

      <main>
        <Container size="content">
          <Stack gap="xl" className="py-xl">
            <SectionBoundary name="stats-header" skeletonVariant="page-header">
              <Stack gap="sm">
                <Typography variant="h1" as="h1" className="text-balance">
                  {title}
                </Typography>
                {lead ? (
                  <Typography variant="long" tone="muted" className="max-w-prose">
                    {lead}
                  </Typography>
                ) : null}
              </Stack>
            </SectionBoundary>

            {hero ? (
              <SectionBoundary
                name="stats-hero"
                skeletonVariant="stat-card"
              >
                <StatGroup stats={hero} cols={hero.length >= 4 ? 4 : (hero.length as 2 | 3)} />
              </SectionBoundary>
            ) : null}

            {children ? (
              <SectionBoundary
                name="stats-body"
                skeletonVariant="card"
              >
                {children}
              </SectionBoundary>
            ) : null}

            {methodology ? (
              <SectionBoundary
                name="stats-methodology"
                skeletonVariant="text"
              >
                <div className="border-border border-t pt-md">
                  <Typography variant="ui-sm" tone="muted">
                    {methodology}
                  </Typography>
                </div>
              </SectionBoundary>
            ) : null}
          </Stack>
        </Container>
      </main>

      {footer ? <Footer {...footer} /> : null}
    </div>
  );
}
StatsTemplate.displayName = 'StatsTemplate';

/**
 * Page-level loading state — the full-page silhouette of
 * `<StatsTemplate>`, not a single rect. Rendered by the consumer while
 * the whole route's data is in flight (`loading.tsx` in Next.js), or as
 * a `<SectionBoundary skeleton={…}>` override.
 *
 * Shapes mirror the real layout so the swap is CLS-neutral (R23). One
 * `role="status"` region for the page; inner skeletons pass
 * `label={null}` so screen readers hear one announcement, not ten.
 */
function StatsTemplateSkeleton({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="stats-template-skeleton"
      data-min-viewport={String(MIN_VIEWPORT)}
      role="status"
      aria-busy="true"
      aria-label="Loading stats…"
      className={cn('bg-background text-foreground', className)}
      {...props}
    >
      <Skeleton
        variant="rect"
        className="h-14 w-full rounded-none"
        label={null}
      />
      <Container size="content">
        <Stack gap="xl" className="py-xl">
          <Skeleton variant="page-header" label={null} />
          <Skeleton variant="stat-card" count={3} label={null} />
          <Skeleton variant="card" label={null} />
        </Stack>
      </Container>
    </div>
  );
}
StatsTemplateSkeleton.displayName = 'StatsTemplateSkeleton';
StatsTemplate.Skeleton = StatsTemplateSkeleton;

export { StatsTemplate };
export type { StatsTemplateProps };
