/**
 * @interlace/ui — Callout
 *
 * Inline-prose annotation. The "stop and read this" surface that punctuates
 * long-form content (docs, MDX, READMEs). Distinct from `Alert` — Alert is
 * an out-of-band runtime banner ("your save failed"), Callout is an in-band
 * authored aside ("note: this rule is type-aware"). Both can share pigment
 * but they live at different altitudes in the system.
 *
 * Five tones, each fixed to a lucide icon + a semantic-token border-tint:
 *
 *   - info     Info             — neutral context, parallel to the body
 *   - note     Lightbulb        — author tip / suggestion
 *   - success  CircleCheck      — confirmation / positive outcome
 *   - warn     TriangleAlert    — non-blocking caution
 *   - danger   OctagonAlert     — destructive / blocking consequence
 *
 * ## Anatomy
 *
 *   Callout                            (div — role="note" — data-min-viewport=320)
 *     ├─ {icon}                        (lucide, decorative — aria-hidden)
 *     └─ <div>                         (text column)
 *         ├─ {title?}                  (Typography variant=ui font-medium)
 *         └─ {children}                (free-form prose)
 *
 * ## MIN_VIEWPORT — 320
 *
 * Callouts live inside body prose; they MUST work on the narrowest reading
 * viewport (320 CSS-px). The icon-left + text-column flex layout reflows
 * naturally — no horizontal scroll, no truncation.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el + VariantProps | `React.ComponentProps<'div'> & VariantProps<...>` + props   |
 * | R6   | data-slot on root                | `data-slot="callout"` + data-tone                           |
 * | R7   | className merged + ...rest + ref | `cn(calloutVariants(...), className)` + `{...props}`        |
 * | R8   | No `isXxx`; enum for tone        | `tone` is a 5-way enum, never a boolean                     |
 * | R10  | Composition seam                 | `title` slot + `children`                                   |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | zero inline `style`; cva classes + Lucide via className     |
 * | R19  | Tokens only                      | `p-md` / `rounded-md` / `border-l-*` widths via spacing + radius tokens; colors via semantic tokens |
 * | R20  | AA contrast                      | tones map to AA-cleared semantic tokens (primary/destructive/foreground/muted-foreground) + neutral surface |
 * | R25  | Server component                 | no hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | `role="note"` on the div; lucide icon marked `aria-hidden`  |
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  CircleCheck,
  Info,
  Lightbulb,
  OctagonAlert,
  TriangleAlert,
} from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Typography } from './typography.js';

/**
 * Minimum viable viewport (CSS px) for this primitive. Below it, preflight
 * draws a dev-mode outline; in prod the component still renders. Exported
 * so consumers / tests can read it.
 */
export const MIN_VIEWPORT = 320 as const;

const calloutVariants = cva(
  // Base — flex row, icon left, text column right; 4px left border via
  // `border-l-4`; padding from the spacing scale; rounded-md from radius
  // tokens. Card-tint surface so the callout reads as a block in prose.
  [
    'flex items-start gap-sm',
    'rounded-md border border-border border-l-4 bg-card/40 p-md',
    '[&_[data-slot=callout-icon]]:size-5 [&_[data-slot=callout-icon]]:shrink-0',
  ].join(' '),
  {
    variants: {
      /**
       * Narrative tone. Drives the icon, the left-border color, and the
       * icon tint. Surface stays neutral so adjacent callouts don't fight
       * each other for attention.
       */
      tone: {
        info:
          'border-l-primary [&_[data-slot=callout-icon]]:text-primary',
        note:
          'border-l-accent-foreground [&_[data-slot=callout-icon]]:text-accent-foreground',
        success:
          'border-l-primary [&_[data-slot=callout-icon]]:text-primary',
        warn:
          'border-l-foreground [&_[data-slot=callout-icon]]:text-foreground',
        danger:
          'border-l-destructive [&_[data-slot=callout-icon]]:text-destructive',
      },
    },
    defaultVariants: {
      tone: 'info',
    },
  },
);

type CalloutTone = NonNullable<VariantProps<typeof calloutVariants>['tone']>;

/** Per-tone lucide icon. One source of truth; no consumer override. */
const TONE_ICON: Record<CalloutTone, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  info: Info,
  note: Lightbulb,
  success: CircleCheck,
  warn: TriangleAlert,
  danger: OctagonAlert,
};

interface CalloutProps
  extends Omit<React.ComponentProps<'div'>, 'title'>,
    VariantProps<typeof calloutVariants> {
  /**
   * Optional headline above the body. Renders as Typography variant=ui
   * font-medium. Note: overrides the native `<div title>` tooltip attribute
   * with a React node — the native tooltip is rarely useful on a Callout
   * and the visible heading wins.
   */
  title?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Inline-prose annotation. Server component (no hooks).
 *
 * Usage:
 *
 *   <Callout tone="warn" title="Heads up">
 *     This rule is type-aware and adds ~50ms to lint runs.
 *   </Callout>
 */
const Callout = React.forwardRef<HTMLDivElement, CalloutProps>(
  ({ className, tone, title, children, ...props }, ref) => {
    const resolvedTone: CalloutTone = tone ?? 'info';
    const Icon = TONE_ICON[resolvedTone];

    return (
      <div
        ref={ref}
        role="note"
        data-slot="callout"
        data-min-viewport={String(MIN_VIEWPORT)}
        data-tone={resolvedTone}
        className={cn(calloutVariants({ tone }), className)}
        {...props}
      >
        <Icon data-slot="callout-icon" aria-hidden />
        <div data-slot="callout-body" className="min-w-0 flex-1">
          {title ? (
            <Typography
              as="p"
              variant="ui"
              className="font-medium"
              data-slot="callout-title"
            >
              {title}
            </Typography>
          ) : null}
          {children}
        </div>
      </div>
    );
  },
);
Callout.displayName = 'Callout';

export { Callout, calloutVariants };
export type { CalloutProps, CalloutTone };
