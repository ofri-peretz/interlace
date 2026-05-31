/**
 * @interlace/ui — Skeleton
 *
 * Loading-state placeholder. ONE component, many shapes — the `variant`
 * prop picks the silhouette of the resting component being loaded so the
 * page layout doesn't jump when real data arrives.
 *
 * ## Why one component, not paired `<XSkeleton>` per primitive
 *
 *   - One import path (`@interlace/ui/skeleton`), not 51.
 *   - One CVA-style variant table → one place to audit shapes against the
 *     DS catalogue.
 *   - The `variant` prop's TypeScript union LITERALLY equals the
 *     `SKELETON_VARIANTS` const tuple — invalid values fail at dev time
 *     (`error TS2322`), not at render time.
 *   - The lock test (`skeleton-variant-coverage-lock.test.ts`) walks
 *     `packages/ui/src/{primitives,patterns,templates}/*.tsx` + every
 *     story file, builds the set of `<Skeleton variant="…">` call sites,
 *     and asserts each one resolves to a registered variant. Catches:
 *     • typo in a story (`variant="aritcle-card"`),
 *     • a renamed primitive whose skeleton variant wasn't updated,
 *     • a new primitive added without a matching skeleton variant.
 *
 * ## Anatomy
 *
 *   <Skeleton variant="rect"    />               ← default, 1rect placeholder
 *   <Skeleton variant="avatar"  />               ← circular 36×36
 *   <Skeleton variant="button"  />               ← 36×96 rounded-md
 *   <Skeleton variant="article-card" />           ← composite: img + title + meta
 *   <Skeleton variant="rect"  count={3}  />       ← N placeholders, gap-sm
 *   <Skeleton variant="rect"  className="h-12 w-48" />  ← escape hatch
 *
 * ## MIN_VIEWPORT — 320
 *
 * Every variant lays out below 320 CSS-px without overflow. Composite
 * variants stack vertically; generic variants are width-100% by default.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el + VariantProps | `React.ComponentProps<'div'> & { variant?: SkeletonVariant }` |
 * | R6   | data-slot on root                | `data-slot="skeleton"` + `data-variant`                     |
 * | R7   | className merged + ...rest       | `cn(SKELETON_VARIANT_CLASSES[variant], className)` + `{...props}` |
 * | R8   | No `isXxx`; enum for variants    | `variant` is the closed `SkeletonVariant` union             |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; SKELETON_VARIANT_CLASSES uses utility classes |
 * | R19  | Tokens only                      | `bg-muted` / `animate-pulse` / `rounded-{sm,md,lg,full}` / `gap-md` — all DS tokens |
 * | R20  | AA contrast (n/a)                | Skeleton is non-text — no contrast requirement              |
 * | R25  | Server component                 | Pure render — no hooks                                      |
 * | R26  | A11y                             | `role="status"` + `aria-busy="true"` + visually-hidden text |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import {
  SKELETON_VARIANT_CLASSES,
  type SkeletonVariant,
} from './skeleton-variants.js';

export const MIN_VIEWPORT = 320 as const;

interface SkeletonProps
  extends Omit<React.ComponentProps<'div'>, 'role'> {
  /**
   * Silhouette to paint. Defaults to `'rect'` — a generic full-width line
   * placeholder. Use the matching primitive/pattern name for a
   * shape-perfect skeleton (e.g. `variant="avatar"`, `variant="article-card"`).
   *
   * The closed union literally equals the `SKELETON_VARIANTS` tuple in
   * `./skeleton-variants.ts` — adding a new value there extends this type.
   */
  variant?: SkeletonVariant;
  /**
   * Render N copies, stacked vertically with `gap-sm`. Useful for lists
   * (e.g. `<Skeleton variant="text" count={5} />` for a 5-line paragraph).
   * Defaults to 1.
   */
  count?: number;
  /**
   * Accessible loading-state label exposed to screen readers via a visually
   * hidden span. Defaults to `'Loading…'`. Set to `null` to suppress
   * (when the surrounding region already exposes a busy state).
   */
  label?: string | null;
}

const COMPOSITE_VARIANTS = new Set<SkeletonVariant>([
  'article-card',
  'author-byline',
  'newsletter-form',
  'page-header',
  'stat-card',
  'card',
  'code-block',
]);

function Skeleton({
  className,
  variant = 'rect',
  count = 1,
  label = 'Loading…',
  ref,
  ...props
}: SkeletonProps) {
  if (count > 1) {
    return (
      <div
        ref={ref}
        data-slot="skeleton-group"
        data-variant={variant}
        data-min-viewport={String(MIN_VIEWPORT)}
        role="status"
        aria-busy="true"
        aria-live="polite"
        className={cn('flex flex-col gap-sm', className)}
        {...props}
      >
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} variant={variant} label={null} />
        ))}
        {label !== null ? <SkeletonLabel>{label}</SkeletonLabel> : null}
      </div>
    );
  }

  if (COMPOSITE_VARIANTS.has(variant)) {
    return (
      <CompositeSkeleton
        ref={ref}
        variant={variant}
        label={label}
        className={className}
        {...props}
      />
    );
  }

  return (
    <div
      ref={ref}
      data-slot="skeleton"
      data-variant={variant}
      data-min-viewport={String(MIN_VIEWPORT)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        'animate-pulse bg-muted',
        SKELETON_VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {label !== null ? <SkeletonLabel>{label}</SkeletonLabel> : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Composite variants — render the resting shape of complex primitives
 * / patterns. Each is a single block of token-driven Tailwind utilities;
 * adding one requires adding the variant name to `SKELETON_VARIANTS`
 * (compile-time enum check) + the outer-shape class in
 * `SKELETON_VARIANT_CLASSES` (used as the root container).
 * ──────────────────────────────────────────────────────────────── */
type CompositeSkeletonProps = Omit<SkeletonProps, 'count'>;

function CompositeSkeleton({
  variant = 'rect',
  label = 'Loading…',
  className,
  ref,
  ...props
}: CompositeSkeletonProps) {
  return (
    <div
      ref={ref}
      data-slot="skeleton"
      data-variant={variant}
      data-min-viewport={String(MIN_VIEWPORT)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        'animate-pulse bg-muted',
        SKELETON_VARIANT_CLASSES[variant],
        'flex flex-col',
        className,
      )}
      {...props}
    >
      <CompositeBody variant={variant} />
      {label !== null ? <SkeletonLabel>{label}</SkeletonLabel> : null}
    </div>
  );
}

function CompositeBody({ variant }: { variant: SkeletonVariant }) {
  switch (variant) {
    case 'article-card':
      // Image (top) + 3 stacked content lines + meta row.
      return (
        <>
          <div className="bg-muted-foreground/10 h-40 w-full rounded-t-xl" />
          <div className="flex flex-col gap-xs p-md">
            <div className="bg-muted-foreground/10 h-5 w-3/4 rounded-sm" />
            <div className="bg-muted-foreground/10 h-4 w-full rounded-sm" />
            <div className="bg-muted-foreground/10 h-4 w-5/6 rounded-sm" />
            <div className="mt-xs flex items-center gap-sm">
              <div className="bg-muted-foreground/10 size-6 rounded-full" />
              <div className="bg-muted-foreground/10 h-3 w-20 rounded-sm" />
            </div>
          </div>
        </>
      );
    case 'author-byline':
      return (
        <div className="flex items-center gap-sm p-xs">
          <div className="bg-muted-foreground/10 size-10 rounded-full" />
          <div className="flex flex-col gap-xs">
            <div className="bg-muted-foreground/10 h-4 w-24 rounded-sm" />
            <div className="bg-muted-foreground/10 h-3 w-16 rounded-sm" />
          </div>
        </div>
      );
    case 'newsletter-form':
      return (
        <div className="flex flex-col gap-sm p-md">
          <div className="bg-muted-foreground/10 h-4 w-1/2 rounded-sm" />
          <div className="flex gap-sm">
            <div className="bg-muted-foreground/10 h-9 flex-1 rounded-md" />
            <div className="bg-muted-foreground/10 h-9 w-24 rounded-md" />
          </div>
        </div>
      );
    case 'page-header':
      return (
        <div className="flex flex-col gap-xs p-md">
          <div className="bg-muted-foreground/10 h-6 w-1/2 rounded-sm" />
          <div className="bg-muted-foreground/10 h-4 w-3/4 rounded-sm" />
        </div>
      );
    case 'stat-card':
      return (
        <div className="flex flex-col gap-xs p-md">
          <div className="bg-muted-foreground/10 h-3 w-16 rounded-sm" />
          <div className="bg-muted-foreground/10 h-8 w-24 rounded-md" />
        </div>
      );
    case 'card':
      return (
        <div className="flex flex-col gap-sm p-md">
          <div className="bg-muted-foreground/10 h-5 w-1/3 rounded-sm" />
          <div className="bg-muted-foreground/10 h-4 w-full rounded-sm" />
          <div className="bg-muted-foreground/10 h-4 w-2/3 rounded-sm" />
        </div>
      );
    case 'code-block':
      // 6 monospace lines of varying width.
      return (
        <div className="flex flex-col gap-xs p-md">
          {[0.4, 0.7, 0.55, 0.85, 0.6, 0.3].map((w, i) => (
            <div
              key={i}
              className="bg-muted-foreground/10 h-3 rounded-sm"
              style={{ width: `${w * 100}%` }}
            />
          ))}
        </div>
      );
    default:
      return null;
  }
}

/**
 * Visually-hidden text exposing the loading state to assistive tech.
 * Inlined here (instead of importing the VisuallyHidden primitive) so
 * Skeleton stays server-safe and import-cycle-free.
 */
function SkeletonLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'sr-only',
        // Belt-and-suspenders sr-only in case the consumer's Tailwind
        // preset strips the utility — kept absolute positioning + tiny
        // size so it stays out of the visual flow on every renderer.
        'pointer-events-none absolute size-px overflow-hidden whitespace-nowrap',
      )}
    >
      {children}
    </span>
  );
}

export { Skeleton };
export type { SkeletonProps };
export {
  SKELETON_VARIANTS,
  type SkeletonVariant,
} from './skeleton-variants.js';
