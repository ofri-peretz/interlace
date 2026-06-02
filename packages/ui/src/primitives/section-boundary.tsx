'use client';

/**
 * @interlace/ui — SectionBoundary
 *
 * The "stream per section" primitive. Fuses React Suspense + a class-based
 * ErrorBoundary into one component so a template can render
 * section-by-section with per-section skeleton + per-section error
 * fallback. The page paints whatever's ready; slow / failed sections
 * degrade in place without blocking the rest.
 *
 *   <ArticleTemplate>
 *     <SectionBoundary name="article-header">       ← header streams
 *       <ArticleHeader articleId={id} />            ← async RSC inside
 *     </SectionBoundary>
 *     <SectionBoundary name="article-body">         ← body streams
 *       <ArticleBody articleId={id} />              ← async RSC inside
 *     </SectionBoundary>
 *     <SectionBoundary name="article-related">      ← related streams
 *       <RelatedPosts articleId={id} />             ← async RSC inside
 *     </SectionBoundary>
 *   </ArticleTemplate>
 *
 * Each `<SectionBoundary>` declares ITS OWN suspense + error boundary so
 * a slow `<RelatedPosts>` doesn't block `<ArticleBody>` from painting.
 * Without this, React promotes the suspense up to the nearest ancestor
 * boundary — typically the page root — and the entire page goes blank
 * until the slowest data source resolves.
 *
 * ## Anatomy
 *
 *   <section data-slot="section-boundary" data-name="…" data-min-viewport="320">
 *     <Suspense fallback={skeleton}>
 *       <ErrorBoundary fallback={error}>
 *         {children}
 *       </ErrorBoundary>
 *     </Suspense>
 *   </section>
 *
 * ## MIN_VIEWPORT — 320
 *
 * Inherits whatever children render; the section wrapper itself is just a
 * flexible block container with the standard `data-min-viewport`.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'section'>` + section-boundary props  |
 * | R6   | data-slot on root                | `data-slot="section-boundary"` + `data-name`                |
 * | R7   | className merged + ...rest       | `cn(className)` + `{...props}` on <section>                 |
 * | R8   | No `isXxx`; required `name`      | `name` required (telemetry surface) — not a boolean         |
 * | R10  | Composition seam (fallbacks)     | `skeleton` + `error` slots accept any ReactNode             |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; cn() pass-through                      |
 * | R19  | Tokens only                      | (n/a — primitive renders no visual chrome itself)           |
 * | R20  | AA contrast                      | (delegated to fallback children — Skeleton + ErrorState own AA) |
 * | R25  | Client component                 | Suspense + ErrorBoundary require client tier                |
 * | R26  | A11y                             | role="region" + aria-label={name} so screen readers can land on each section |
 *
 * Out of scope: this primitive does NOT manage retries, telemetry,
 * timeout-driven fallbacks, or progressive enhancement of failed sections.
 * Those belong in a sibling `<RetryBoundary>` / consumer-app instrumentation.
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Skeleton, type SkeletonVariant } from './skeleton.js';

export const MIN_VIEWPORT = 320 as const;

interface SectionBoundaryProps extends React.ComponentProps<'section'> {
  /**
   * Telemetry-grade name for this section ("article-header",
   * "registry-item-variants"). Required so error reporters / Sentry
   * breadcrumbs / a11y screen-reader announcements have a stable handle.
   *
   * Also projected to the DOM as `data-name` so playwright E2E + manual
   * QA can `await page.locator('[data-slot="section-boundary"][data-name="article-header"]')`
   * without coupling to className.
   */
  name: string;
  /**
   * Loading-state UI surfaced while children suspend. Defaults to a
   * generic full-width `<Skeleton variant="card" />`. Pass a
   * shape-matched variant via `skeletonVariant` for a one-prop swap, or
   * pass an arbitrary ReactNode via `skeleton` for full control.
   */
  skeleton?: React.ReactNode;
  /** Shortcut for the common case — picks a `<Skeleton variant>` shape. */
  skeletonVariant?: SkeletonVariant;
  /**
   * Error-state UI surfaced when children (or any descendant) throws.
   * Defaults to a minimal `<p role="alert">Section failed to load.</p>`
   * styled with `text-destructive`. Pass a React node — including a
   * `<button onClick={retry}>` — to give the user a recovery path.
   *
   * NOTE: rendering a different fallback after recovery requires a
   * remount (the boundary's error state is one-shot). For retry-on-click
   * patterns, wrap children in a key-based forced remount.
   */
  error?: React.ReactNode;
  children: React.ReactNode;
}

function SectionBoundary({
  name,
  skeleton,
  skeletonVariant,
  error,
  children,
  className,
  ...props
}: SectionBoundaryProps) {
  const fallback =
    skeleton ?? <Skeleton variant={skeletonVariant ?? 'card'} />;
  const errorFallback = error ?? (
    <p
      role="alert"
      className="text-destructive font-body text-ui p-md"
    >
      Section failed to load.
    </p>
  );

  return (
    <section
      data-slot="section-boundary"
      data-name={name}
      data-min-viewport={String(MIN_VIEWPORT)}
      role="region"
      aria-label={name}
      className={cn('contents', className)}
      {...props}
    >
      <SectionErrorBoundary fallback={errorFallback} name={name}>
        <React.Suspense fallback={fallback}>{children}</React.Suspense>
      </SectionErrorBoundary>
    </section>
  );
}
SectionBoundary.displayName = 'SectionBoundary';

/* ─────────────────────────────────────────────────────────────────
 * SectionErrorBoundary — a minimal class-based boundary scoped to the
 * SectionBoundary primitive. React 19 still has no functional error
 * boundary (componentDidCatch is class-only); we inline a private one
 * here rather than pulling react-error-boundary as a dep because we
 * own a fixed UX (single fallback, no retry slot — that's a follow-up
 * primitive). Class + small surface = no upkeep cost.
 * ──────────────────────────────────────────────────────────────── */
interface SectionErrorBoundaryProps {
  fallback: React.ReactNode;
  name: string;
  children: React.ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
}

class SectionErrorBoundary extends React.Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Surface for consumer telemetry — leave a breadcrumb that's
    // greppable. Consumers wanting structured reporting can wrap their
    // app in their own ErrorBoundary higher up; our boundary doesn't
    // swallow the throw, the React error reporting still fires too.
    // eslint-disable-next-line no-console
    console.error(
      `[SectionBoundary "${this.props.name}"] section failed to render`,
      error,
      info.componentStack,
    );
  }

  render(): React.ReactNode {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export { SectionBoundary };
export type { SectionBoundaryProps };
