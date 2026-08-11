"use client";

/**
 * @interlace/ui — BackgroundGradientAnimation
 *
 * The "lava lamp" surface: five radial-gradient blobs orbiting behind an SVG
 * goo filter and a 40px blur, over a two-stop gradient backdrop, plus a sixth
 * blob that eases toward the pointer.
 *
 * Every colour is a prop that falls back to an `--interlace-*` token, so the
 * default look is on-brand and no literal ships in source.
 *
 * ## Provenance
 *
 * Our reimplementation of the Aceternity UI component of the same name. What
 * is ours: the whole token fallback chain (upstream shipped colour literals);
 * self-scoping — the original mutated `document.body.style`, this one writes
 * its CSS variables to its own root so several instances can coexist; and a
 * pointer loop that actually schedules frames, replacing upstream's
 * stale-closure nested `setState` that never re-ran.
 *
 * ## Anatomy
 *
 *   div                              (data-slot="background-gradient-animation",
 *                                     isolate, backdrop linear-gradient)
 *     ├─ svg.hidden                  (data-slot="gradient-filter" — feGaussianBlur
 *     │                               → feColorMatrix → feBlend, the goo)
 *     ├─ div aria-hidden             (data-slot="gradient-blobs", filter:url(#<gooId>))
 *     │   ├─ div.animate-first … .animate-fifth
 *     │   └─ div                     (data-slot="gradient-pointer" — only when active)
 *     └─ div.z-10                    (data-slot="gradient-content" — your children)
 *
 * ## Motion — two kinds, gated two ways
 *
 * The five orbits are CSS keyframes (`--animate-first`…`--animate-fifth` in
 * `styles/tokens.css`). They are named in that file's
 * `prefers-reduced-motion: reduce` block (`animation: none !important`) and
 * also caught by the wildcard in `styles/preflight.css`, so they need no JS.
 * The blobs stay on screen, parked.
 *
 * The pointer blob is a `requestAnimationFrame` loop writing
 * `node.style.transform`, which neither CSS rule can reach. It is gated in JS:
 * `pointerActive = interactive && !reducedMotion`, and when that is false the
 * element is not rendered and the effect returns before adding its listener.
 *
 * ## The goo filter id is per-instance
 *
 * `bga-goo-<useId()>`, not a literal. SVG ids are document-global: as
 * `id="bga-goo"` two instances on one page emitted duplicate ids and browsers
 * resolved `url(#bga-goo)` to the first, so both surfaces shared whichever
 * filter mounted first — and unmounting that one took the other's goo with it.
 *
 * The reference therefore moves from an arbitrary Tailwind utility to an
 * inline `style`, because Tailwind scans source as raw text and cannot emit a
 * class whose value is a template literal. That is the same R18 carve-out the
 * colour variables already use, for the same reason: the value is computed.
 */

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

/**
 * CSS-blend-mode applied between the orbiting blobs. `hard-light` gives the
 * vivid, saturated aurora look; `normal` flattens them for a calmer surface.
 *
 * Mirrors the CSS `mix-blend-mode` keyword set, narrowed to the values that read
 * well against a gradient backdrop.
 */
export type GradientBlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "hard-light"
  | "soft-light"
  | "lighten"
  | "darken";

export interface BackgroundGradientAnimationProps
  extends ComponentPropsWithoutRef<"div"> {
  /**
   * CSS color for the start of the backdrop linear-gradient. Any CSS color is
   * valid; pass a token reference (e.g. `"var(--interlace-accent)"`) to stay on
   * the design system. When omitted, falls back to the brand accent token.
   * @default "var(--interlace-accent)"
   */
  gradientBackgroundStart?: string;
  /**
   * CSS color for the end of the backdrop linear-gradient. Pass a token
   * reference to stay on-brand. When omitted, falls back to the brand
   * primary-active token.
   * @default "var(--interlace-primary-active)"
   */
  gradientBackgroundEnd?: string;
  /**
   * CSS color of the first (largest, vertically-drifting) blob. When omitted,
   * falls back to the brand primary token.
   * @default "var(--interlace-primary)"
   */
  firstColor?: string;
  /**
   * CSS color of the second (counter-rotating) blob. When omitted, falls back to
   * the brand primary-hover token.
   * @default "var(--interlace-primary-hover)"
   */
  secondColor?: string;
  /**
   * CSS color of the third (slow-orbiting) blob. When omitted, falls back to the
   * brand accent-foreground token.
   * @default "var(--interlace-accent-foreground)"
   */
  thirdColor?: string;
  /**
   * CSS color of the fourth (horizontally-drifting) blob. When omitted, falls
   * back to the brand primary-subtle-foreground token.
   * @default "var(--interlace-primary-subtle-foreground)"
   */
  fourthColor?: string;
  /**
   * CSS color of the fifth (orbiting) blob. When omitted, falls back to the
   * brand secondary-foreground token.
   * @default "var(--interlace-secondary-foreground)"
   */
  fifthColor?: string;
  /**
   * CSS color of the pointer-follow blob (only rendered when `interactive`).
   * When omitted, falls back to the brand primary token.
   * @default "var(--interlace-primary)"
   */
  pointerColor?: string;
  /**
   * Diameter of each blob as a CSS length (relative to the container). Larger
   * values produce a softer, more diffuse wash.
   * @default "80%"
   */
  size?: string;
  /**
   * `mix-blend-mode` applied between the blobs. `hard-light` is the vivid
   * default; `normal` calms the surface.
   * @default "hard-light"
   */
  blendMode?: GradientBlendMode;
  /**
   * Render a blob that eases toward the pointer on `pointermove`. Disabled
   * automatically when the user prefers reduced motion.
   * @default true
   */
  interactive?: boolean;
  /**
   * Content rendered above the gradient (z-stacked over the decorative layer).
   * The gradient layer is `aria-hidden`, so foreground content keeps its own
   * semantics.
   */
  children?: ReactNode;
  /**
   * Class name merged onto the foreground content wrapper. Use it to position or
   * pad your content (the root takes `className` via `...props`).
   */
  contentClassName?: string;
}

/**
 * Shared class list for the five orbiting blobs. Each blob layers its own
 * radial-gradient color (a CSS variable) and orbit animation on top.
 */
const BLOB_BASE = cn(
  "absolute h-(--bga-size) w-(--bga-size) [mix-blend-mode:var(--bga-blend)]",
  "top-[calc(50%-var(--bga-size)/2)] left-[calc(50%-var(--bga-size)/2)]",
  "[transform-origin:center_center] opacity-100",
);

export const BackgroundGradientAnimation = forwardRef<
  HTMLDivElement,
  BackgroundGradientAnimationProps
>(function BackgroundGradientAnimation(
  {
    gradientBackgroundStart,
    gradientBackgroundEnd,
    firstColor,
    secondColor,
    thirdColor,
    fourthColor,
    fifthColor,
    pointerColor,
    size = "80%",
    blendMode = "hard-light",
    interactive = true,
    children,
    className,
    contentClassName,
    style,
    ...props
  },
  ref,
) {
  const pointerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  // Per-instance, because SVG ids are document-global. `useId()`'s output is
  // stripped to `[A-Za-z0-9_-]` so it is safe inside a `url(#…)` reference
  // whatever punctuation React decides to spell it with.
  const gooId = `bga-goo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  // The pointer-follow blob runs only when interactivity is requested AND the
  // user has not opted out of motion. Reduced motion always wins.
  const pointerActive = interactive && !reducedMotion;

  // Smoothly ease the pointer blob toward the cursor with a single rAF loop.
  // Replaces the original's stale-closure nested-setState loop, which never
  // actually re-scheduled a frame. All transforms are written to the element
  // directly (no React re-render per frame), and the loop is fully cleaned up.
  useEffect(() => {
    const node = pointerRef.current;
    if (!node || !pointerActive) return;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frame = 0;

    const onPointerMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      target.x = event.clientX - rect.left;
      target.y = event.clientY - rect.top;
    };

    const tick = () => {
      current.x += (target.x - current.x) / 20;
      current.y += (target.y - current.y) / 20;
      node.style.transform = `translate(${Math.round(current.x)}px, ${Math.round(current.y)}px)`;
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointerMove);
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      cancelAnimationFrame(frame);
    };
  }, [pointerActive]);

  // Dynamic CSS-variable assignments — the lone sanctioned use of inline
  // `style` (R18). Color props pass through untouched; when a prop is omitted
  // the fallback token in the radial-gradient class chain takes over, so the
  // default look is on-brand and no raw color literal ever reaches source.
  const cssVars = {
    "--bga-bg-start": gradientBackgroundStart,
    "--bga-bg-end": gradientBackgroundEnd,
    "--bga-first": firstColor,
    "--bga-second": secondColor,
    "--bga-third": thirdColor,
    "--bga-fourth": fourthColor,
    "--bga-fifth": fifthColor,
    "--bga-pointer": pointerColor,
    "--bga-size": size,
    "--bga-blend": blendMode,
    ...style,
  } as CSSProperties;

  return (
    <div
      ref={ref}
      data-slot="background-gradient-animation"
      style={cssVars}
      className={cn(
        "relative isolate h-full w-full overflow-hidden",
        // Backdrop linear-gradient: token-defaulted via the var() fallback chain.
        "bg-[linear-gradient(40deg,var(--bga-bg-start,var(--interlace-accent)),var(--bga-bg-end,var(--interlace-primary-active)))]",
        className,
      )}
      {...props}
    >
      {/* SVG goo filter — purely decorative, never in the a11y tree. */}
      <svg aria-hidden="true" className="hidden" data-slot="gradient-filter">
        <defs>
          <filter id={gooId}>
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="10"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {/* Decorative blob layer — non-interactive, hidden from assistive tech. */}
      <div
        aria-hidden="true"
        data-slot="gradient-blobs"
        className="pointer-events-none absolute inset-0"
        // Inline rather than an arbitrary `[filter:url(#…)]` utility, and not
        // by preference: Tailwind scans source as raw TEXT, so a class built
        // from a template literal is a candidate it never sees and never emits.
        // The id has to be per-instance, so the declaration has to leave the
        // class system. Same R18 carve-out as the CSS variables above.
        style={{ filter: `url(#${gooId}) blur(40px)` }}
      >
        <div
          className={cn(
            BLOB_BASE,
            "[background:radial-gradient(circle_at_center,var(--bga-first,var(--interlace-primary))_0,transparent_50%)_no-repeat]",
            "animate-first",
          )}
        />
        <div
          className={cn(
            BLOB_BASE,
            "[background:radial-gradient(circle_at_center,var(--bga-second,var(--interlace-primary-hover))_0,transparent_50%)_no-repeat]",
            "[transform-origin:calc(50%-400px)] animate-second",
          )}
        />
        <div
          className={cn(
            BLOB_BASE,
            "[background:radial-gradient(circle_at_center,var(--bga-third,var(--interlace-accent-foreground))_0,transparent_50%)_no-repeat]",
            "[transform-origin:calc(50%+400px)] animate-third",
          )}
        />
        <div
          className={cn(
            BLOB_BASE,
            "[background:radial-gradient(circle_at_center,var(--bga-fourth,var(--interlace-primary-subtle-foreground))_0,transparent_50%)_no-repeat]",
            "[transform-origin:calc(50%-200px)] animate-fourth opacity-70",
          )}
        />
        <div
          className={cn(
            BLOB_BASE,
            "[background:radial-gradient(circle_at_center,var(--bga-fifth,var(--interlace-secondary-foreground))_0,transparent_50%)_no-repeat]",
            "[transform-origin:calc(50%-800px)_calc(50%+800px)] animate-fifth",
          )}
        />

        {pointerActive && (
          <div
            ref={pointerRef}
            data-slot="gradient-pointer"
            className={cn(
              "absolute -top-1/2 -left-1/2 h-full w-full opacity-70 [mix-blend-mode:var(--bga-blend)]",
              "[background:radial-gradient(circle_at_center,var(--bga-pointer,var(--interlace-primary))_0,transparent_50%)_no-repeat]",
            )}
          />
        )}
      </div>

      {/* Foreground content — z-stacked above the decorative layer. */}
      <div
        data-slot="gradient-content"
        className={cn("relative z-10", contentClassName)}
      >
        {children}
      </div>
    </div>
  );
});
