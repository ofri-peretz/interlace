/**
 * @interlace/ui — Skeleton variant catalogue.
 *
 * Single source of truth for the `<Skeleton variant>` discriminated union.
 * Every entry maps to a Tailwind shape class set that paints a placeholder
 * matching the corresponding primitive / pattern / template.
 *
 * Adding a new variant:
 *   1. Add the name to `SKELETON_VARIANTS` below (alphabetic within its
 *      category block).
 *   2. Add the matching shape class set to `SKELETON_VARIANT_CLASSES`.
 *   3. The TypeScript `SkeletonVariant` union and the lock test
 *      (`skeleton-variant-coverage-lock.test.ts`) pick the new value up
 *      automatically.
 *
 * The lock test ALSO asserts: every `<Skeleton variant="x">` call site in
 * the codebase resolves to a value in this array. Typos and renames fail
 * the PR at CI time, complementing the dev-time TypeScript check.
 */

export const SKELETON_VARIANTS = [
  // ── Generic shapes (no specific primitive — reusable) ────────────────
  'rect',
  'circle',
  'text',
  'paragraph',

  // ── Primitive-shaped (matches a primitive's resting silhouette) ──────
  'avatar',
  'badge',
  'button',
  'card',
  'code-block',
  'input',
  'prose',
  'tag',

  // ── Form family (Phase 1.1) ──────────────────────────────────────────
  // One variant per form primitive so a loading form reserves the exact
  // resting silhouette of the control it replaces — CLS=0 (R23). The
  // coverage assertion in `skeleton-variant-coverage-lock.test.ts` pins
  // this list to the primitives directory, so a new form control cannot
  // ship without its placeholder.
  'checkbox',
  'form',
  'label',
  'number-field',
  'radio-group',
  'select',
  'slider',
  'switch',
  'textarea',

  // ── Pattern-shaped (matches a pattern's full layout) ─────────────────
  'article-card',
  'author-byline',
  'newsletter-form',
  'page-header',
  'prev-next-post',
  'stat-card',

  // ── Template-shaped (matches a template's full-page layout) ──────────
  // Added by Phase 4 when the templates land.
] as const;

export type SkeletonVariant = (typeof SKELETON_VARIANTS)[number];

/**
 * Shape class map. Each variant gets the Tailwind utility chain that
 * paints its silhouette. Values use DS tokens (`rounded-md` / `h-9` /
 * `gap-md`) — no raw px / hex. The Skeleton root always adds
 * `animate-pulse bg-muted` so these only need to declare layout.
 *
 * For COMPOSITE variants (card, article-card, author-byline, ...) the
 * class string is the OUTER container; the Skeleton component reads a
 * separate `<X>InnerSkeleton` JSX block per variant — see
 * `./skeleton.tsx`.
 */
export const SKELETON_VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  // Generic
  rect: 'h-4 w-full rounded-md',
  circle: 'size-9 rounded-full',
  text: 'h-4 w-2/3 rounded-sm',
  paragraph: 'h-4 w-full rounded-sm',

  // Primitive-shaped
  avatar: 'size-9 rounded-full',
  badge: 'h-5 w-16 rounded-full',
  button: 'h-9 w-24 rounded-md',
  card: 'h-32 w-full rounded-lg',
  'code-block': 'h-40 w-full rounded-md',
  input: 'h-9 w-full rounded-md',
  prose: 'h-4 w-full rounded-sm',
  tag: 'h-5 w-12 rounded-full',

  // Form family — silhouettes match the resting control geometry exactly.
  //   checkbox / radio dot   size-4   (16px, per checkbox.tsx / radio-group.tsx)
  //   switch track           h-5 w-8  (the 1.15rem track rounds to h-5 here)
  //   select trigger / input h-9      (36px control height)
  //   slider rail            h-2      (per slider.tsx SliderTrack)
  //   textarea md            min-h-2xl (per textarea.tsx size=md)
  checkbox: 'size-4 rounded-sm',
  label: 'h-4 w-24 rounded-sm',
  'number-field': 'h-9 w-32 rounded-md',
  select: 'h-9 w-full rounded-md',
  slider: 'h-2 w-full rounded-full',
  switch: 'h-5 w-8 rounded-full',
  textarea: 'min-h-2xl w-full rounded-md',
  // Composite (inner JSX in skeleton.tsx): a field group / option list.
  form: 'w-full rounded-md',
  'radio-group': 'w-full rounded-md',

  // Pattern-shaped (outer; composite inner rendered in skeleton.tsx)
  'article-card': 'h-72 w-full rounded-xl',
  'author-byline': 'h-12 w-full rounded-md',
  'newsletter-form': 'h-32 w-full rounded-md',
  'page-header': 'h-20 w-full rounded-md',
  // Transparent + unrounded on purpose: this variant paints TWO cards side
  // by side, so the shape lives entirely in the composite body. A filled
  // root would draw a third block behind them.
  'prev-next-post': 'h-24 w-full bg-transparent',
  'stat-card': 'h-24 w-full rounded-lg',
};
