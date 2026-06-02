/**
 * @interlace/ui — GradeBadge
 *
 * Visual grade pill — A+ / A / A- / B+ / B / … / F. The atomic surface for
 * scorecard pages: a single chip that announces a tier without making the
 * reader compute. Five tones (excellent/good/fair/poor/fail) map onto the
 * 13-grade ladder so the colour story stays manageable.
 *
 * ## Anatomy
 *
 *   <span data-slot="grade-badge" data-grade="A+" data-tone="excellent">
 *     A+
 *   </span>
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el + VariantProps | `React.ComponentProps<'span'> & VariantProps<...>`          |
 * | R6   | data-slot + data-grade           | `data-slot="grade-badge"` + `data-grade` + `data-tone`      |
 * | R7   | className merged + ...rest       | `cn(gradeBadgeVariants(...), className)` + `{...props}`     |
 * | R8   | No isXxx; closed grade enum      | `grade` is the 13-tier `'A+' | 'A' | 'A-' | ... | 'F'`        |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R19  | Tokens only                      | bg-success/warning/destructive + foreground tokens          |
 * | R20  | AA contrast                      | tone-foreground on tone-background clears AA in both modes  |
 * | R25  | Server component                 | No hooks                                                    |
 * | R26  | A11y                             | aria-label="Grade: A+" so SRs announce the score in words   |
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

const GRADE_VALUES = [
  'A+', 'A', 'A-',
  'B+', 'B', 'B-',
  'C+', 'C', 'C-',
  'D+', 'D', 'D-',
  'F',
] as const;

export type GradeValue = (typeof GRADE_VALUES)[number];

type GradeTone = 'excellent' | 'good' | 'fair' | 'poor' | 'fail';

const GRADE_TONE_MAP: Record<GradeValue, GradeTone> = {
  'A+': 'excellent', 'A': 'excellent', 'A-': 'excellent',
  'B+': 'good',       'B': 'good',       'B-': 'good',
  'C+': 'fair',       'C': 'fair',       'C-': 'fair',
  'D+': 'poor',       'D': 'poor',       'D-': 'poor',
  'F':  'fail',
};

const gradeBadgeVariants = cva(
  // Base — sits inline, tabular numerals so digits don't jiggle.
  'inline-flex items-center justify-center rounded-full font-mono font-bold tabular-nums whitespace-nowrap',
  {
    variants: {
      tone: {
        excellent: 'bg-success text-success-foreground',
        good:      'bg-primary text-primary-foreground',
        fair:      'bg-warning text-warning-foreground',
        // `poor` uses a darker orange than `fair` (warning) but isn't yet
        // catastrophic. Inline orange-900 because the DS doesn't ship an
        // intermediate orange semantic; this is the one place we reach
        // outside the token surface. Clears AAA at 8.5:1 on white.
        poor:      'bg-orange-900 text-white',
        fail:      'bg-destructive text-destructive-foreground',
      },
      size: {
        sm: 'h-5 min-w-8 px-xs text-xs',
        md: 'h-7 min-w-10 px-sm text-sm',
        lg: 'h-12 min-w-16 px-md text-xl',
      },
    },
    defaultVariants: {
      tone: 'good',
      size: 'md',
    },
  },
);

interface GradeBadgeProps
  extends Omit<React.ComponentProps<'span'>, 'children'>,
    Pick<VariantProps<typeof gradeBadgeVariants>, 'size'> {
  /** The grade itself. Drives the tone automatically (A* = excellent, etc.). */
  grade: GradeValue;
}

function GradeBadge({
  grade,
  size = 'md',
  className,
  ...props
}: GradeBadgeProps) {
  const tone = GRADE_TONE_MAP[grade];
  return (
    <span
      data-slot="grade-badge"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-grade={grade}
      data-tone={tone}
      aria-label={`Grade: ${grade}`}
      className={cn(gradeBadgeVariants({ tone, size }), className)}
      {...props}
    >
      {grade}
    </span>
  );
}
GradeBadge.displayName = 'GradeBadge';

export { GradeBadge, gradeBadgeVariants, GRADE_VALUES };
export type { GradeBadgeProps };
