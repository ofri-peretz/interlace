/**
 * @interlace/ui — ScorecardRow
 *
 * A single dimension row in a scorecard: name + GradeBadge + numeric
 * score + optional details. Used by ScorecardTemplate to render each
 * scored category (Performance, Coverage, Adoption, ...).
 *
 * ## Anatomy
 *
 *   <article data-slot="scorecard-row" data-min-viewport="320">
 *     <header><h3>{name}</h3> <GradeBadge /> <span>{score}</span></header>
 *     {details && <div>{details}</div>}
 *   </article>
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { GradeBadge, type GradeValue } from '../primitives/grade-badge.js';
import { Skeleton } from '../primitives/skeleton.js';
import { Typography } from '../primitives/typography.js';

export const MIN_VIEWPORT = 320 as const;

interface ScorecardRowProps extends Omit<React.ComponentProps<'article'>, 'title'> {
  /** Dimension name (e.g. "Performance", "Coverage"). */
  name: React.ReactNode;
  /** WCAG-style letter grade. */
  grade: GradeValue;
  /** Numeric score (0-100). Rendered tabular for column alignment. */
  score: number;
  /** Optional sub-line (e.g. "12 of 14 rules passing"). */
  caption?: React.ReactNode;
  /** Optional detail content under the header (chart, table, callouts). */
  details?: React.ReactNode;
  loading?: boolean;
}

function ScorecardRow({
  name,
  grade,
  score,
  caption,
  details,
  loading,
  className,
  ...props
}: ScorecardRowProps) {
  if (loading) {
    return (
      <Skeleton
        variant="card"
        data-slot="scorecard-row"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={className}
      />
    );
  }
  return (
    <article
      data-slot="scorecard-row"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-grade={grade}
      className={cn(
        'border-border bg-card text-card-foreground flex flex-col gap-md rounded-lg border p-md',
        className,
      )}
      {...props}
    >
      <header className="flex items-center justify-between gap-sm">
        <div className="flex flex-col gap-xs">
          <Typography variant="h4" as="h2">
            {name}
          </Typography>
          {caption ? (
            <Typography variant="ui-sm" tone="muted">
              {caption}
            </Typography>
          ) : null}
        </div>
        <div className="flex items-center gap-sm">
          <span className="font-body text-h3 font-bold tabular-nums leading-none">
            {score}
          </span>
          <GradeBadge grade={grade} size="lg" />
        </div>
      </header>
      {details ? <div>{details}</div> : null}
    </article>
  );
}
ScorecardRow.displayName = 'ScorecardRow';

export { ScorecardRow };
export type { ScorecardRowProps };
