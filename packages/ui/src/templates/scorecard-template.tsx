/**
 * @interlace/ui — ScorecardTemplate
 *
 * Graded-evaluation page. Topbar + overall-grade header + per-dimension
 * scorecard rows + optional methodology footnote + Footer.
 *
 * Used by `/scorecard`, plugin scorecards, Lighthouse-style reports.
 * Each dimension row streams independently via SectionBoundary so the
 * overall header paints while individual dimension details are still
 * fetching.
 *
 * ## MIN_VIEWPORT — 320
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Container } from '../primitives/container.js';
import { GradeBadge, type GradeValue } from '../primitives/grade-badge.js';
import { SectionBoundary } from '../primitives/section-boundary.js';
import { Stack } from '../primitives/stack.js';
import { Typography } from '../primitives/typography.js';
import { Topbar } from '../patterns/topbar.js';
import { Footer } from '../patterns/footer.js';
import { ScorecardRow } from '../patterns/scorecard-row.js';

export const MIN_VIEWPORT = 320 as const;

interface ScorecardDimension {
  name: React.ReactNode;
  grade: GradeValue;
  score: number;
  caption?: React.ReactNode;
  details?: React.ReactNode;
}

interface ScorecardTemplateProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  topbar: React.ComponentProps<typeof Topbar>;
  /** Page title. */
  title: React.ReactNode;
  /** One-paragraph lead under the title. */
  lead?: React.ReactNode;
  /** Overall result — drives the hero grade pill at the top. */
  overall?: {
    grade: GradeValue;
    score: number;
    /** Optional caption next to the overall grade (e.g. "92% pass rate"). */
    caption?: React.ReactNode;
  };
  /** Per-dimension scores. */
  dimensions?: ScorecardDimension[];
  /**
   * Optional methodology footnote — explains how scores are computed.
   * Rendered as a muted block under the body.
   */
  methodology?: React.ReactNode;
  footer?: React.ComponentProps<typeof Footer>;
}

function ScorecardTemplate({
  topbar,
  title,
  lead,
  overall,
  dimensions = [],
  methodology,
  footer,
  className,
  ...props
}: ScorecardTemplateProps) {
  return (
    <div
      data-slot="scorecard-template"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('bg-background text-foreground', className)}
      {...props}
    >
      <Topbar {...topbar} />

      <main>
        <Container size="content">
          <Stack gap="xl" className="py-xl">
            <SectionBoundary name="scorecard-header" skeletonVariant="page-header">
              <div className="flex flex-col gap-md md:flex-row md:items-center md:justify-between">
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
                {overall ? (
                  <div className="flex flex-col items-end gap-xs">
                    <div className="flex items-baseline gap-sm">
                      <span className="font-body text-h1 font-bold tabular-nums leading-none">
                        {overall.score}
                      </span>
                      <GradeBadge grade={overall.grade} size="lg" />
                    </div>
                    {overall.caption ? (
                      <Typography variant="ui-sm" tone="muted">
                        {overall.caption}
                      </Typography>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </SectionBoundary>

            <SectionBoundary
              name="scorecard-dimensions"
              skeletonVariant="card"
            >
              <Stack gap="md">
                {dimensions.map((dim, i) => (
                  <ScorecardRow key={i} {...dim} />
                ))}
              </Stack>
            </SectionBoundary>

            {methodology ? (
              <SectionBoundary
                name="scorecard-methodology"
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
ScorecardTemplate.displayName = 'ScorecardTemplate';

export { ScorecardTemplate };
export type { ScorecardTemplateProps, ScorecardDimension };
