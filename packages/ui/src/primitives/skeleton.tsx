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

/**
 * Variants that render an inner shape via `CompositeBody` rather than a bare
 * tinted box.
 *
 * This Set must stay in step with the `case` labels in `CompositeBody` —
 * membership here is what routes a variant there at all. A variant with a
 * `case` but no entry silently falls through to the simple `<div>` path and
 * paints nothing; `skeleton-variant-coverage-lock` asserts the two agree so
 * that can't happen twice.
 */
const COMPOSITE_VARIANTS = new Set<SkeletonVariant>([
  'article-card',
  'author-byline',
  'newsletter-form',
  'page-header',
  'prev-next-post',
  'stat-card',
  'card',
  'code-block',
  // Form family — both are containers of repeating rows, so their
  // silhouette is structural rather than a single painted box.
  'form',
  'radio-group',
  // Overlay / nav surfaces (wave 1.2).
  'breadcrumb',
  'menu',
  'pagination',
  'tabs',
  'toc',
  // Charts (wave 5). `metric-table` is the only composite of the three: its
  // silhouette is a header row plus repeating rows, which a single painted box
  // cannot express. `chart` and `sparkline` are honest rectangles.
  'metric-table',
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
    case 'prev-next-post':
      // Two bordered link cards, each a kicker line over a title line —
      // and the same `grid-cols-1 md:grid-cols-2` cadence the real block
      // uses, so the article footer doesn't reflow when the pair arrives.
      return (
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          {['items-start', 'items-end'].map((align) => (
            <div
              key={align}
              className={cn(
                'flex flex-col gap-1 rounded-lg border border-border p-md',
                align,
              )}
            >
              <div className="bg-muted-foreground/10 h-3 w-20 rounded-sm" />
              <div className="bg-muted-foreground/10 h-5 w-3/4 rounded-sm" />
            </div>
          ))}
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
    case 'form':
      // Three label+control rows and a submit button — the resting shape
      // of <Form><Field>…</Field></Form> so the page doesn't jump when
      // the real fields hydrate.
      return (
        <div className="flex flex-col gap-md">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-xs">
              <div className="bg-muted-foreground/10 h-4 w-24 rounded-sm" />
              <div className="bg-muted-foreground/10 h-9 w-full rounded-md" />
            </div>
          ))}
          <div className="bg-muted-foreground/10 h-9 w-24 rounded-md" />
        </div>
      );
    case 'radio-group':
      // Three option rows at the primitive's own `gap-2` pitch: a 16px
      // dot plus its label.
      return (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="bg-muted-foreground/10 size-4 rounded-full" />
              <div className="bg-muted-foreground/10 h-4 w-32 rounded-sm" />
            </div>
          ))}
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
    case 'breadcrumb':
      // Trail of crumbs + separators — the resting Breadcrumb silhouette.
      return (
        <div className="flex items-center gap-sm px-xs">
          <div className="bg-muted-foreground/10 h-3 w-16 rounded-sm" />
          <div className="bg-muted-foreground/10 size-1.5 rounded-full" />
          <div className="bg-muted-foreground/10 h-3 w-20 rounded-sm" />
          <div className="bg-muted-foreground/10 size-1.5 rounded-full" />
          <div className="bg-muted-foreground/10 h-3 w-12 rounded-sm" />
        </div>
      );
    case 'menu':
      // DropdownMenu / ContextMenu popup: 4 item rows + a separator.
      return (
        <div className="flex flex-col gap-xs p-xs">
          <div className="bg-muted-foreground/10 h-6 w-full rounded-sm" />
          <div className="bg-muted-foreground/10 h-6 w-full rounded-sm" />
          <div className="bg-muted-foreground/10 h-px w-full" />
          <div className="bg-muted-foreground/10 h-6 w-full rounded-sm" />
          <div className="bg-muted-foreground/10 h-6 w-4/5 rounded-sm" />
        </div>
      );
    case 'pagination':
      // Prev + 3 page pills + Next, centred like the real nav.
      return (
        <div className="flex items-center justify-center gap-xs">
          <div className="bg-muted-foreground/10 h-8 w-20 rounded-md" />
          <div className="bg-muted-foreground/10 size-8 rounded-md" />
          <div className="bg-muted-foreground/10 size-8 rounded-md" />
          <div className="bg-muted-foreground/10 size-8 rounded-md" />
          <div className="bg-muted-foreground/10 h-8 w-20 rounded-md" />
        </div>
      );
    case 'tabs':
      // Tab list row + the panel body underneath.
      return (
        <div className="flex flex-col gap-sm p-xs">
          <div className="flex gap-xs">
            <div className="bg-muted-foreground/10 h-8 w-20 rounded-md" />
            <div className="bg-muted-foreground/10 h-8 w-24 rounded-md" />
            <div className="bg-muted-foreground/10 h-8 w-16 rounded-md" />
          </div>
          <div className="bg-muted-foreground/10 h-4 w-full rounded-sm" />
          <div className="bg-muted-foreground/10 h-4 w-3/4 rounded-sm" />
        </div>
      );
    case 'toc':
      // Heading rail: h2 lines flush, h3 lines indented.
      return (
        <div className="flex flex-col gap-xs p-sm">
          <div className="bg-muted-foreground/10 h-3 w-3/4 rounded-sm" />
          <div className="bg-muted-foreground/10 ml-md h-3 w-2/3 rounded-sm" />
          <div className="bg-muted-foreground/10 ml-md h-3 w-1/2 rounded-sm" />
          <div className="bg-muted-foreground/10 h-3 w-4/5 rounded-sm" />
          <div className="bg-muted-foreground/10 ml-md h-3 w-3/5 rounded-sm" />
        </div>
      );
    case 'metric-table':
      // Header row plus four metric rows. The trailing narrow cells stand in
      // for the sparkline and delta columns, so the row width the data will
      // occupy is reserved before it arrives.
      return (
        <div className="flex flex-col gap-xs p-sm">
          <div className="flex items-center gap-sm border-b border-border pb-xs">
            <div className="bg-muted-foreground/10 h-3 w-1/4 rounded-sm" />
            <div className="bg-muted-foreground/10 ml-auto h-3 w-10 rounded-sm" />
            <div className="bg-muted-foreground/10 h-3 w-10 rounded-sm" />
            <div className="bg-muted-foreground/10 h-3 w-12 rounded-sm" />
          </div>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-center gap-sm">
              <div className="bg-muted-foreground/10 h-4 w-1/3 rounded-sm" />
              <div className="bg-muted-foreground/10 ml-auto h-4 w-10 rounded-sm" />
              <div className="bg-muted-foreground/10 h-4 w-[90px] rounded-sm" />
              <div className="bg-muted-foreground/10 h-4 w-12 rounded-sm" />
            </div>
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
