"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

/**
 * BackgroundGradientAnimation — a decorative, animated multi-blob gradient
 * surface (the "lava lamp" / aurora effect).
 *
 * Adapted in spirit from Aceternity UI
 * (https://ui.aceternity.com/components/background-gradient-animation), but
 * re-authored to the Interlace floor:
 *
 *   - **Tokens, not literals.** Every color resolves through a CSS custom
 *     property that falls back to a brand design token (`--interlace-*`), so the
 *     default look is on-brand and the build's `no-raw-color-literal` rule stays
 *     green. Consumers override any color via props.
 *   - **Self-scoped.** The original mutated `document.body.style` (a global side
 *     effect, hostile to any consumer). This version writes its CSS variables to
 *     its OWN root element via the inline-`style` CSS-variable exception, so
 *     multiple instances coexist and nothing leaks to the page.
 *   - **Motion-safe.** The looping blob animation is driven by CSS keyframes that
 *     the global `prefers-reduced-motion` reset already disables; the pointer
 *     follow-effect additionally reads `useReducedMotion()` and is skipped
 *     entirely for motion-sensitive users.
 *   - **Consumer-agnostic.** Extends the native `<div>`, forwards `ref`, spreads
 *     `...props`, merges `className`. No app/route/content assumptions; defaults
 *     are structural (full-bleed cover), never product copy.
 *
 * The animation keyframes (`animate-first`…`animate-fifth`, `moveVertical`,
 * `moveInCircle`, `moveHorizontal`) and the reduced-motion reset live in
 * `@interlace/ui/styles/tokens.css` — import it once in the consuming app.
 *
 * @example
 * ```tsx
 * <BackgroundGradientAnimation data-testid="hero-bg" className="h-[40rem]">
 *   <h1 className="text-fd-foreground">Your content</h1>
 * </BackgroundGradientAnimation>
 * ```
 */

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
          <filter id="bga-goo">
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
        className="pointer-events-none absolute inset-0 [filter:url(#bga-goo)_blur(40px)]"
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
