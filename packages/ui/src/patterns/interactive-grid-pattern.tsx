"use client";

import {
  type ComponentPropsWithoutRef,
  forwardRef,
  useCallback,
  useId,
  useState,
} from "react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

// -----------------------------------------------------------------------------
// API parity (R13 / R17)
// -----------------------------------------------------------------------------
// Inspired by Magic UI's `InteractiveGridPattern`
// (https://magicui.design/docs/components/interactive-grid-pattern), re-authored
// to the Interlace floor. Deviations from upstream, all documented:
//   • Color is token-driven, not hard-coded gray literals — stroke/fill inherit
//     `currentColor`, opacity is exposed as props mapped to CSS variables, so a
//     consumer drives the palette from any design token via `className`/`color`
//     (R19, no-raw-color-literal).
//   • The hover fade respects `prefers-reduced-motion` (R26) by collapsing the
//     transition to an instant swap — upstream animated unconditionally.
//   • Hover state is controllable (`hoveredSquare` + `onHoveredSquareChange` +
//     `defaultHoveredSquare`) so a parent can drive / observe the active cell
//     (R14), instead of being trapped in internal `useState`.
//   • Pointer affordances are pluggable per cell via `squareProps`, and a
//     `<title>` plus `role="presentation"` keep the decorative grid out of the
//     a11y tree without an axe suppression (R20 / R26).
// -----------------------------------------------------------------------------

/**
 * Per-square render hook. Receives the flat index plus its grid coordinates and
 * returns extra SVG `<rect>` props (e.g. `data-*`, `onClick`) merged onto the
 * cell. Lets a consumer wire interactivity without forking the component (R10).
 */
export type InteractiveGridSquareProps = (
  index: number,
  position: { row: number; column: number },
) => ComponentPropsWithoutRef<"rect"> | undefined;

export interface InteractiveGridPatternProps
  extends Omit<ComponentPropsWithoutRef<"svg">, "width" | "height"> {
  /**
   * Stable selector hook for tests. Required — no runtime default so an
   * omission surfaces in review rather than silently masking it (R5). Each
   * `<rect>` derives `{value}-cell-{index}`.
   */
  "data-testid": string;
  /**
   * Width of a single square, in user-space units.
   * @default 40
   */
  squareWidth?: number;
  /**
   * Height of a single square, in user-space units.
   * @default 40
   */
  squareHeight?: number;
  /**
   * Number of columns in the grid (horizontal squares).
   * @default 24
   */
  columns?: number;
  /**
   * Number of rows in the grid (vertical squares).
   * @default 24
   */
  rows?: number;
  /**
   * Stroke opacity of every cell's border, 0–1. Combined with the inherited
   * `currentColor` so the consumer controls the hue via a token.
   * @default 0.3
   */
  lineOpacity?: number;
  /**
   * Fill opacity applied to the hovered cell, 0–1. Combined with the inherited
   * `currentColor` so the consumer controls the hue via a token.
   * @default 0.3
   */
  hoverOpacity?: number;
  /**
   * Controlled active cell. Pass `null` for "none hovered". When set, the
   * component is controlled and `onHoveredSquareChange` is the source of truth
   * (R14). Leave `undefined` to let the component manage hover internally.
   * @default undefined
   */
  hoveredSquare?: number | null;
  /**
   * Initial active cell for the uncontrolled mode (R14).
   * @default null
   */
  defaultHoveredSquare?: number | null;
  /**
   * Fires when the hovered cell changes — `index` is the flat cell index or
   * `null` when the pointer leaves the grid (R9, noun-first change event).
   */
  onHoveredSquareChange?: (
    index: number | null,
    details: { row: number; column: number } | null,
  ) => void;
  /**
   * Extra props merged onto every `<rect>`, computed per cell (R10).
   */
  squareProps?: InteractiveGridSquareProps;
  /**
   * Class applied to every `<rect>` cell — merged after the base classes.
   */
  squaresClassName?: string;
  /**
   * Accessible name announced for the decorative grid. The grid is
   * presentational, so this only surfaces as the SVG `<title>` for tooling.
   * @default "Decorative interactive grid"
   */
  label?: string;
}

/**
 * `InteractiveGridPattern` — a decorative, pointer-reactive grid of squares,
 * sized to fill its positioned parent. Each cell highlights on hover; the fade
 * honors `prefers-reduced-motion`.
 *
 * Color is token-driven: cells inherit `currentColor`, so set the hue with a
 * text-color token (e.g. `className="text-border"`) and tune visibility with
 * `lineOpacity` / `hoverOpacity`. Place inside a `relative` container.
 *
 * @example
 * ```tsx
 * <div className="relative h-64 overflow-hidden">
 *   <InteractiveGridPattern
 *     data-testid="hero-grid"
 *     className="text-border"
 *     columns={20}
 *     rows={12}
 *   />
 * </div>
 * ```
 */
export const InteractiveGridPattern = forwardRef<
  SVGSVGElement,
  InteractiveGridPatternProps
>(function InteractiveGridPattern(
  {
    "data-testid": dataTestid,
    squareWidth = 40,
    squareHeight = 40,
    columns = 24,
    rows = 24,
    lineOpacity = 0.3,
    hoverOpacity = 0.3,
    hoveredSquare: hoveredSquareProp,
    defaultHoveredSquare = null,
    onHoveredSquareChange,
    squareProps,
    className,
    squaresClassName,
    label = "Decorative interactive grid",
    ...props
  },
  ref,
) {
  const reducedMotion = useReducedMotion();
  const titleId = useId();

  const [uncontrolledHovered, setUncontrolledHovered] = useState<number | null>(
    defaultHoveredSquare,
  );
  const isControlled = hoveredSquareProp !== undefined;
  const hoveredSquare = isControlled ? hoveredSquareProp : uncontrolledHovered;

  const setHovered = useCallback(
    (index: number | null) => {
      const details =
        index === null
          ? null
          : { row: Math.floor(index / columns), column: index % columns };
      if (!isControlled) setUncontrolledHovered(index);
      onHoveredSquareChange?.(index, details);
    },
    [columns, isControlled, onHoveredSquareChange],
  );

  return (
    <svg
      ref={ref}
      data-slot="interactive-grid-pattern"
      data-testid={dataTestid}
      role="presentation"
      aria-labelledby={titleId}
      width={squareWidth * columns}
      height={squareHeight * rows}
      // Dynamic, computed CSS-variable overrides — the one R18-sanctioned use
      // of inline style. These feed the token-driven opacities into the class
      // system below; they are not static styling.
      style={{
        // @ts-expect-error -- CSS custom properties are valid inline style keys.
        "--grid-line-opacity": lineOpacity,
        "--grid-hover-opacity": hoverOpacity,
      }}
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full text-border",
        className,
      )}
      {...props}
    >
      <title id={titleId}>{label}</title>
      {Array.from({ length: columns * rows }).map((_, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = column * squareWidth;
        const y = row * squareHeight;
        const active = hoveredSquare === index;
        const { className: extraClassName, ...extra } =
          squareProps?.(index, { row, column }) ?? {};

        return (
          <rect
            key={index}
            // Consumer extras spread first so the component keeps ownership of
            // the slot, hover tracking, and geometry below (R10 without footgun).
            {...extra}
            data-slot="interactive-grid-square"
            data-testid={`${dataTestid}-cell-${index}`}
            data-active={active || undefined}
            x={x}
            y={y}
            width={squareWidth}
            height={squareHeight}
            className={cn(
              "pointer-events-auto fill-transparent stroke-current [stroke-opacity:var(--grid-line-opacity)]",
              // Reduced motion → instant swap; otherwise a quick fade in and a
              // slow fade out, matching the upstream feel (R26).
              reducedMotion
                ? "transition-none"
                : "transition-[fill] duration-100 ease-in-out [&:not([data-active])]:duration-1000",
              active && "fill-current [fill-opacity:var(--grid-hover-opacity)]",
              squaresClassName,
              extraClassName,
            )}
            onPointerEnter={(event) => {
              extra.onPointerEnter?.(event);
              setHovered(index);
            }}
            onPointerLeave={(event) => {
              extra.onPointerLeave?.(event);
              setHovered(null);
            }}
          />
        );
      })}
    </svg>
  );
});
