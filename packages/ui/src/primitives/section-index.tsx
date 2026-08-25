import * as React from 'react';

import { cn } from '../lib/cn.js';

/**
 * SectionIndex — the numbered eyebrow: a zero-padded mono numeral in
 * the AAA brand orange beside an uppercase tracked label. The page's sections
 * become a legible sequence ("01 THE AGENDA … 04 THE PROOF"), telling
 * readers there is an order and where they stand in it.
 *
 * One reference law (BRAND_PHILOSOPHY §4): numbered section indices,
 * refracted through the terminal-decode voice — the numeral is
 * monospaced with tabular figures, the way a terminal counts, not a
 * display face. The numeral is the view's meaning-point accent in
 * `text-primary` — the 7:1 AAA-cleared brand orange, because at 14px
 * the numeral is TEXT, and the strand pair is scoped to woven gestures
 * (both caught by the storybook AAA gate). The label stays muted. No motion: consumers who want the
 * decode gesture pass `<DecodeText>` as the label — composition, not
 * coupling (R16).
 *
 * ## A11y
 *
 * "02" spoken aloud is noise ("zero two"). The numeral is aria-hidden
 * and an sr-only "Section 2:" carries the semantic, so screen readers
 * hear "Section 2: The Agenda" while the visual keeps the padded
 * terminal form.
 *
 * ## Anatomy
 *
 *   <SectionIndex value={2} data-testid="…">The Agenda</SectionIndex>
 *
 *   p                (data-slot="section-index" — the eyebrow line)
 *     ├─ span        (data-slot="section-index-numeral", aria-hidden)
 *     ├─ span        (sr-only "Section N:")
 *     └─ children    (the label — string or <DecodeText>)
 *
 * Fits SectionHeader's `eyebrow` slot directly.
 */

export interface SectionIndexProps
  extends Omit<React.ComponentPropsWithoutRef<'p'>, 'children'> {
  /** Stable selector for E2E tests; consumer provides — no default (R5). */
  'data-testid': string;
  /** 1-based position in the page's sequence; rendered zero-padded. */
  value: number;
  /** The eyebrow label — a string, or `<DecodeText>` for the gesture. */
  children: React.ReactNode;
}

export function SectionIndex({
  'data-testid': testId,
  value,
  children,
  className,
  ...rest
}: SectionIndexProps) {
  return (
    <p
      data-slot="section-index"
      data-testid={testId}
      className={cn(
        'flex items-baseline gap-3 text-sm font-medium uppercase tracking-wider text-muted-foreground',
        className,
      )}
      {...rest}
    >
      <span
        data-slot="section-index-numeral"
        aria-hidden="true"
        className="font-mono text-primary [font-variant-numeric:tabular-nums]"
      >
        {String(value).padStart(2, '0')}
      </span>
      <span className="sr-only">Section {value}:</span>
      {children}
    </p>
  );
}
