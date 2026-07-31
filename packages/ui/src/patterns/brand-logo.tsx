/**
 * @interlace/ui — BrandMark + BrandLogo (the canonical Interlace nav lockup)
 *
 * The locked two-bar Interlace mark plus the lowercase monospace wordmark
 * "interlace". This is the SAME lockup eslint.interlace.tools ships in its
 * top nav — one component so every *.interlace.tools site renders an
 * identical brand header instead of hand-copied SVG.
 *
 * ## Geometry (locked — never bend)
 *
 * viewBox 0 0 100 100, two rx-14 bars (62×28) rotated -30° about the
 * center; orange bar leads upper-left, green bar lower-right. See the
 * brand-mark favicons (apps/registry/public/favicon.svg) for the same
 * geometry.
 *
 * ## Color contract
 *
 * Bar fills read `var(--brand-mark-bar-o)` / `var(--brand-mark-bar-g)` —
 * theme-paired decorative fills defined in
 * `packages/ui/styles/interlace-theme.css` (light #a84c17/#0a6b47, dark
 * #f4794a/#0d9460). Consumers outside this monorepo (e.g. the eslint docs
 * site) define the same two custom properties and the lockup follows their
 * theme switch automatically.
 *
 * | Rule | Concept                        | Where in this file                              |
 * | ---- | ------------------------------ | ----------------------------------------------- |
 * | R2   | Travels (high)                 | Zero product nouns beyond the brand itself      |
 * | R4   | Extends native el              | `React.ComponentProps<'svg'>` / `<'span'>`      |
 * | R6   | data-slot on every named part  | `brand-mark` / `brand-logo`                     |
 * | R7   | className merged + ...rest     | `cn(...)` + `{...props}` on both parts          |
 * | R18  | Tailwind only — no inline style| SVG geometry is numeric attrs, fills are tokens |
 * | R19  | Tokens only — no raw hex       | `var(--brand-mark-bar-*)`                       |
 * | R23  | CLS=0                          | Fixed width/height on the SVG                   |
 * | R25  | Server component               | no hooks → no 'use client'                      |
 * | R26  | a11y                           | Mark is aria-hidden; the wordmark names the brand |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

interface BrandMarkProps extends React.ComponentProps<'svg'> {
  /** Rendered size in px (width = height). @default 22 */
  size?: number;
}

/** The two-bar Interlace mark alone (decorative — pair with visible text). */
function BrandMark({ size = 22, className, ...props }: BrandMarkProps) {
  return (
    <svg
      data-slot="brand-mark"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('shrink-0', className)}
      {...props}
    >
      <g transform="rotate(-30 50 50)">
        <rect
          x="10"
          y="18"
          width="62"
          height="28"
          rx="14"
          fill="var(--brand-mark-bar-o)"
        />
        <rect
          x="28"
          y="54"
          width="62"
          height="28"
          rx="14"
          fill="var(--brand-mark-bar-g)"
        />
      </g>
    </svg>
  );
}

interface BrandLogoProps extends React.ComponentProps<'span'> {
  /** Mark size in px. @default 22 */
  markSize?: number;
}

/**
 * Mark + wordmark lockup: the two-bar mark followed by lowercase monospace
 * "interlace". Wrap in your own `<Link href="/">` — the lockup is display
 * only, so each site keeps its own routing.
 */
function BrandLogo({ markSize = 22, className, children, ...props }: BrandLogoProps) {
  return (
    <span
      data-slot="brand-logo"
      className={cn('inline-flex items-center gap-2.5', className)}
      {...props}
    >
      <BrandMark size={markSize} />
      <span className="font-mono font-semibold lowercase tracking-tight">
        interlace
      </span>
      {children}
    </span>
  );
}

export { BrandMark, BrandLogo };
export type { BrandMarkProps, BrandLogoProps };
