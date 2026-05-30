// Focus Cards — a grid of cards where pointing-at or focusing one card
// dims and softly blurs the rest, drawing the eye to the active card.
// Re-authored to the Interlace floor from the Aceternity UI "Focus Cards"
// pattern (https://ui.aceternity.com/components/focus-cards): focus (not
// just hover) now drives the active state, the active card is controllable,
// content is composed via slots, and all color comes from design tokens.
"use client";

import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  useCallback,
  useState,
} from "react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

/**
 * Details passed to {@link FocusCardsProps.onActiveChange} alongside the
 * active index. Lets consumers learn *why* the active card changed without
 * inferring it from the event type.
 */
export interface FocusCardsChangeDetails {
  /** What moved focus to (or away from) the card. */
  reason: "pointer" | "focus" | "blur";
}

/**
 * Props for a single {@link FocusCard}. Extends the native `<article>` element
 * (a self-contained media + caption unit) so consumers can spread data
 * attributes, ARIA, and listeners onto the card.
 */
export interface FocusCardProps
  extends Omit<ComponentPropsWithoutRef<"article">, "onChange"> {
  /**
   * Caption shown over the media when the card is active. Slot (`ReactNode`),
   * not a string, so consumers can compose a title + description, a link, an
   * icon row, etc. Omit for a media-only card.
   */
  caption?: ReactNode;
  /**
   * The card media — typically an image or `next/image`, but any node works
   * (video, canvas, gradient). The component never assumes an image element,
   * so there is no app- or framework-specific media policy baked in.
   */
  children?: ReactNode;
  /**
   * Force the active (sharp, caption-visible) state regardless of the parent
   * grid. Inside {@link FocusCards} the active/dim state flows automatically
   * from the grid via CSS, so leave this unset there; pass it only when
   * composing a `FocusCard` standalone.
   * @default false
   */
  active?: boolean;
  /**
   * Force the dimmed (blurred, receded) state regardless of the parent grid.
   * Like {@link FocusCardProps.active}, only needed for standalone composition.
   * @default false
   */
  dimmed?: boolean;
  /**
   * Stable end-to-end selector. Required at the type level (no runtime
   * default) so a consumer omission surfaces in review rather than silently
   * shipping a shared id. Sub-parts derive `{value}-media` / `{value}-caption`.
   */
  "data-testid": string;
}

/**
 * Props for {@link FocusCards}.
 *
 * @typeParam TItem - shape of each item in {@link FocusCardsProps.items}.
 */
export interface FocusCardsProps<TItem = unknown>
  extends Omit<ComponentPropsWithoutRef<"ul">, "onChange" | "children"> {
  /**
   * Data for each card. The component is data-shape agnostic: provide any
   * array and render each entry via {@link FocusCardsProps.renderItem}. Keys
   * come from {@link FocusCardsProps.getItemKey} (falls back to the index).
   */
  items: readonly TItem[];
  /**
   * Render one card from an item. Return a {@link FocusCard} (recommended) so
   * the active/dim styling applies, or any node for full control. Receives the
   * item, its index, and whether it is currently active.
   */
  renderItem: (item: TItem, index: number, active: boolean) => ReactNode;
  /**
   * Derive a stable React key for an item. Defaults to the array index, which
   * is only safe for a static, non-reordered list — supply this whenever the
   * list can reorder or items can be inserted/removed.
   * @default (_, index) => index
   */
  getItemKey?: (item: TItem, index: number) => React.Key;
  /**
   * Controlled active card index, or `null` for "none active". Pair with
   * {@link FocusCardsProps.onActiveChange}. Leave undefined to run
   * uncontrolled via {@link FocusCardsProps.defaultActiveIndex}.
   */
  activeIndex?: number | null;
  /**
   * Initial active card index for uncontrolled usage.
   * @default null
   */
  defaultActiveIndex?: number | null;
  /**
   * Called when the active card changes, with the new index (or `null`) and
   * the reason it changed. Noun-first per the DS event convention.
   */
  onActiveChange?: (
    index: number | null,
    details: FocusCardsChangeDetails,
  ) => void;
  /**
   * Number of columns at the largest breakpoint. Mobile is always a single
   * column; the grid steps up to this count at `md`. Clamped to 1–4 because
   * the responsive ladder only defines tokens up to four columns.
   * @default 3
   */
  columns?: 1 | 2 | 3 | 4;
  /**
   * Stable end-to-end selector for the grid. Required at the type level.
   * Sub-parts derive `{value}-item-{index}`.
   */
  "data-testid": string;
}

const COLUMN_CLASS: Record<NonNullable<FocusCardsProps["columns"]>, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

/**
 * A single card in a {@link FocusCards} grid. Stays sharp while active; dims
 * and blurs while a sibling is active. Renders as a semantic `<article>` —
 * inside {@link FocusCards} it fills a list item, giving the grid real list
 * semantics for assistive tech.
 *
 * Reduced-motion users get the dim/sharpen contrast without the blur or scale
 * transition, per {@link useReducedMotion}.
 */
export function FocusCard({
  caption,
  children,
  active = false,
  dimmed = false,
  className,
  "data-testid": testId,
  ...props
}: FocusCardProps) {
  const reducedMotion = useReducedMotion();

  return (
    <article
      data-slot="focus-card"
      // Mirror any manual override onto the card itself so the caption + recede
      // selectors below resolve identically whether the state comes from the
      // parent grid (`group/focus-item`) or from these props.
      data-active={active ? "" : undefined}
      data-dimmed={dimmed && !active ? "" : undefined}
      data-testid={testId}
      className={cn(
        // Token-backed surface; fixed aspect ratio reserves space (CLS=0).
        "group/card relative isolate aspect-[4/3] size-full overflow-hidden rounded-xl bg-fd-muted",
        "ring-1 ring-fd-border",
        // Focus ring for keyboard users landing on a focusable child.
        "focus-within:ring-2 focus-within:ring-fd-ring",
        !reducedMotion &&
          "transition-[filter,transform,opacity] duration-300 ease-out",
        // Recede when a sibling is active (driven by the grid's group) or when
        // forced via the `dimmed` prop — but never while this card is active.
        "group-data-[dimmed]/focus-item:opacity-60 data-[dimmed]:opacity-60",
        "group-data-[active]/focus-item:opacity-100 data-[active]:opacity-100",
        !reducedMotion &&
          "group-data-[dimmed]/focus-item:scale-[0.98] group-data-[dimmed]/focus-item:blur-sm data-[dimmed]:scale-[0.98] data-[dimmed]:blur-sm",
        !reducedMotion &&
          "group-data-[active]/focus-item:scale-100 group-data-[active]/focus-item:blur-none data-[active]:scale-100 data-[active]:blur-none",
        className,
      )}
      {...props}
    >
      <div
        data-slot="focus-card-media"
        data-testid={`${testId}-media`}
        className="absolute inset-0 size-full [&>*]:size-full [&_img]:size-full [&_img]:object-cover [&_video]:object-cover"
      >
        {children}
      </div>

      {caption != null && (
        <div
          data-slot="focus-card-caption"
          data-testid={`${testId}-caption`}
          className={cn(
            "absolute inset-x-0 bottom-0 flex items-end p-4 text-(--focus-card-caption-color) sm:p-6",
            // Caption sits over arbitrary media, so the scrim is intentionally a
            // stable dark layer in BOTH themes (a theme-relative token would
            // flip to light in dark mode and fail contrast against the light
            // caption text). Both are overridable CSS variables — re-skin via
            // `[--focus-card-scrim:…]` / `[--focus-card-caption-color:…]` on
            // the card — with AA-safe defaults resolved through the Tailwind
            // theme (never raw color literals).
            "bg-gradient-to-t from-(--focus-card-scrim) to-transparent",
            "[--focus-card-caption-color:theme(colors.white)] [--focus-card-scrim:theme(colors.black/70%)]",
            // Caption fades in once the card (or its grid item) is active.
            "opacity-0 group-data-[active]/focus-item:opacity-100 group-data-[active]/card:opacity-100 data-[active]:opacity-100",
            !reducedMotion && "transition-opacity duration-300 ease-out",
          )}
        >
          {caption}
        </div>
      )}
    </article>
  );
}

/**
 * Focus Cards — a responsive grid that spotlights one card at a time. Pointing
 * at or keyboard-focusing a card keeps it sharp while every sibling dims and
 * blurs, so the user's attention follows their cursor or focus ring.
 *
 * Controlled and uncontrolled:
 * ```tsx
 * // Uncontrolled — the grid owns the active index.
 * <FocusCards
 *   data-testid="gallery"
 *   items={photos}
 *   renderItem={(photo, i) => (
 *     <FocusCard data-testid={`gallery-card-${i}`} caption={photo.title}>
 *       <img src={photo.src} alt={photo.title} />
 *     </FocusCard>
 *   )}
 * />
 *
 * // Controlled — drive the active index from outside.
 * <FocusCards
 *   data-testid="gallery"
 *   items={photos}
 *   activeIndex={active}
 *   onActiveChange={(index) => setActive(index)}
 *   renderItem={renderPhoto}
 * />
 * ```
 *
 * Keyboard: Tab moves focus to a focusable child inside a card (e.g. a link in
 * the caption); the card it lives in becomes active via `focusin`, and the
 * focus ring stays visible. No motion is required to operate the grid.
 */
export function FocusCards<TItem>({
  items,
  renderItem,
  getItemKey,
  activeIndex,
  defaultActiveIndex = null,
  onActiveChange,
  columns = 3,
  className,
  "data-testid": testId,
  ...props
}: FocusCardsProps<TItem>) {
  const [uncontrolledIndex, setUncontrolledIndex] = useState<number | null>(
    defaultActiveIndex,
  );
  const controlled = activeIndex !== undefined;
  const active = controlled ? activeIndex : uncontrolledIndex;

  const setActive = useCallback(
    (next: number | null, reason: FocusCardsChangeDetails["reason"]) => {
      if (!controlled) setUncontrolledIndex(next);
      onActiveChange?.(next, { reason });
    },
    [controlled, onActiveChange],
  );

  return (
    <ul
      data-slot="focus-cards"
      data-testid={testId}
      className={cn(
        // Mobile-first: one column, density added at md and up.
        "grid w-full grid-cols-1 gap-4 md:gap-6 lg:gap-8",
        COLUMN_CLASS[columns],
        className,
      )}
      {...props}
    >
      {items.map((item, index) => {
        const isActive = active === index;
        return (
          <li
            key={getItemKey ? getItemKey(item, index) : index}
            data-slot="focus-cards-item"
            data-testid={`${testId}-item-${index}`}
            // Named group: the rendered card reads `group-data-[active]` /
            // `group-data-[dimmed]` from here, so the active/dim styling flows
            // automatically without the consumer forwarding any props.
            data-active={isActive ? "" : undefined}
            data-dimmed={active !== null && !isActive ? "" : undefined}
            onPointerEnter={() => setActive(index, "pointer")}
            onPointerLeave={() => setActive(null, "pointer")}
            onFocus={() => setActive(index, "focus")}
            onBlur={(event) => {
              // Only clear when focus leaves the card entirely, not when it
              // moves between focusable children inside the same card.
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setActive(null, "blur");
              }
            }}
            className="group/focus-item flex"
          >
            {renderItem(item, index, isActive)}
          </li>
        );
      })}
    </ul>
  );
}
