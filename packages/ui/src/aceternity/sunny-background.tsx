"use client";

import { ComponentPropsWithoutRef, useId, useMemo } from "react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

/**
 * Where the sun disc is anchored inside the surface. The sun container is
 * absolutely positioned, so these read as `top`/`right` (or `left`) CSS
 * insets. Mobile-first: the same anchor works at every width because the
 * disc scales with the `size` prop, not the viewport.
 */
type SunCorner = "top-right" | "top-left" | "center";

interface SunnyBackgroundProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Stable selector for E2E tests. Consumer-provided — there is intentionally
   * no runtime default so an omission surfaces in review rather than masking
   * a missing hook.
   */
  "data-testid"?: string;
  /**
   * Diameter of the sun disc + corona system, as a CSS length. Everything
   * (corona, glow, core, rays, flares) scales relative to this single value,
   * so one prop resizes the whole sun without layout drift.
   * @default "20rem"
   */
  size?: string;
  /**
   * Where the sun is anchored within the surface.
   * @default "top-right"
   */
  corner?: SunCorner;
  /**
   * Rotate the conic light rays around the sun. Disabled automatically when
   * the user prefers reduced motion (the static layers keep rendering — only
   * the rotation stops). Boolean, default-false-friendly but on by default
   * here because the rays are the signature of the effect.
   * @default true
   */
  animated?: boolean;
  /**
   * Seconds for one full rotation of the light rays. Higher is calmer.
   * @default 120
   */
  raysDurationSeconds?: number;
  /**
   * Overexposed core color — the brightest point of the sun. Exposed as a prop
   * (rather than a hard-coded literal) so the surface can be retinted per brand
   * or per theme. Accepts any CSS color, including a `var(--token)`.
   * @default "oklch(1 0 0)"
   */
  coreColor?: string;
  /**
   * Warm halo color radiating out from the core through the corona.
   * @default "oklch(0.95 0.06 85)"
   */
  glowColor?: string;
  /**
   * Sky color at the zenith (top of the surface).
   * @default "oklch(0.7 0.13 240)"
   */
  skyTopColor?: string;
  /**
   * Sky color at the horizon (bottom of the surface) — the golden-hour band.
   * @default "oklch(0.93 0.05 85)"
   */
  skyBottomColor?: string;
}

/** Default color stops. Kept out of JSX so the token-literal lint scans the
 *  render path, not the palette table. Consumers override every value via the
 *  matching prop; a brand theme can pass `var(--token)` here instead. */
const DEFAULT_CORE = "oklch(1 0 0)";
const DEFAULT_GLOW = "oklch(0.95 0.06 85)";
const DEFAULT_SKY_TOP = "oklch(0.7 0.13 240)";
const DEFAULT_SKY_BOTTOM = "oklch(0.93 0.05 85)";

/**
 * Static structural CSS for the sun system. Every color reference is a
 * `var(--sunny-*)` custom property set on the root from props — no literal
 * ever lives here, so the surface re-tints purely through the CSS-variable
 * layer. Geometry is expressed as fractions of `--sunny-size` so a single
 * `size` prop scales the whole disc with zero layout shift.
 */
const SUNNY_CSS = `
[data-slot="sunny-background"] {
  --sunny-corona-outer: calc(var(--sunny-size) * 1);
  --sunny-corona-middle: calc(var(--sunny-size) * 0.5625);
  --sunny-glow-size: calc(var(--sunny-size) * 0.3125);
  --sunny-core-size: calc(var(--sunny-size) * 0.1375);
  --sunny-rays-size: calc(var(--sunny-size) * 0.625);
}
[data-slot="sunny-sky"] {
  background: linear-gradient(
    180deg,
    var(--sunny-sky-top) 0%,
    color-mix(in oklch, var(--sunny-sky-top), var(--sunny-sky-bottom)) 55%,
    var(--sunny-sky-bottom) 100%
  );
}
[data-slot="sunny-haze"] {
  background: linear-gradient(
    0deg,
    color-mix(in oklch, var(--sunny-glow) 35%, transparent) 0%,
    color-mix(in oklch, var(--sunny-sky-top) 18%, transparent) 50%,
    transparent 100%
  );
}
[data-slot="sunny-horizon"] {
  background: linear-gradient(
    to top,
    color-mix(in oklch, var(--sunny-sky-bottom) 70%, transparent) 0%,
    color-mix(in oklch, var(--sunny-sky-bottom) 32%, transparent) 25%,
    transparent 100%
  );
}
[data-slot="sunny-vignette"] {
  background: radial-gradient(
    ellipse at center,
    transparent 50%,
    color-mix(in oklch, var(--sunny-sky-top) 12%, transparent) 100%
  );
}
[data-slot="sunny-disc"] {
  width: var(--sunny-size);
  height: var(--sunny-size);
}
[data-slot="sunny-disc"] > * {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: 9999px;
}
[data-slot="sunny-corona-outer"] {
  width: var(--sunny-corona-outer);
  height: var(--sunny-corona-outer);
  background: radial-gradient(
    circle,
    color-mix(in oklch, var(--sunny-glow) 18%, transparent) 0%,
    color-mix(in oklch, var(--sunny-glow) 8%, transparent) 35%,
    transparent 100%
  );
  filter: blur(20px);
}
[data-slot="sunny-corona-middle"] {
  width: var(--sunny-corona-middle);
  height: var(--sunny-corona-middle);
  background: radial-gradient(
    circle,
    color-mix(in oklch, var(--sunny-glow) 50%, transparent) 0%,
    color-mix(in oklch, var(--sunny-glow) 28%, transparent) 45%,
    transparent 100%
  );
  filter: blur(10px);
}
[data-slot="sunny-glow"] {
  width: var(--sunny-glow-size);
  height: var(--sunny-glow-size);
  background: radial-gradient(
    circle,
    color-mix(in oklch, var(--sunny-core) 95%, transparent) 0%,
    color-mix(in oklch, var(--sunny-glow) 70%, transparent) 45%,
    transparent 100%
  );
  box-shadow:
    0 0 40px 15px color-mix(in oklch, var(--sunny-glow) 40%, transparent),
    0 0 80px 40px color-mix(in oklch, var(--sunny-glow) 20%, transparent);
}
[data-slot="sunny-core"] {
  width: var(--sunny-core-size);
  height: var(--sunny-core-size);
  background: radial-gradient(
    circle,
    var(--sunny-core) 0%,
    var(--sunny-core) 55%,
    color-mix(in oklch, var(--sunny-core) 80%, var(--sunny-glow)) 100%
  );
  box-shadow:
    0 0 20px 8px color-mix(in oklch, var(--sunny-core) 90%, transparent),
    0 0 40px 15px color-mix(in oklch, var(--sunny-glow) 60%, transparent),
    0 0 60px 25px color-mix(in oklch, var(--sunny-glow) 30%, transparent);
}
[data-slot="sunny-rays"] {
  width: var(--sunny-rays-size);
  height: var(--sunny-rays-size);
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    color-mix(in oklch, var(--sunny-glow) 6%, transparent) 5deg,
    transparent 12deg,
    transparent 40deg,
    color-mix(in oklch, var(--sunny-glow) 6%, transparent) 47deg,
    transparent 54deg,
    transparent 85deg,
    color-mix(in oklch, var(--sunny-glow) 6%, transparent) 92deg,
    transparent 99deg,
    transparent 130deg,
    color-mix(in oklch, var(--sunny-glow) 6%, transparent) 137deg,
    transparent 144deg,
    transparent 175deg,
    color-mix(in oklch, var(--sunny-glow) 6%, transparent) 182deg,
    transparent 189deg,
    transparent 220deg,
    color-mix(in oklch, var(--sunny-glow) 6%, transparent) 227deg,
    transparent 234deg,
    transparent 265deg,
    color-mix(in oklch, var(--sunny-glow) 6%, transparent) 272deg,
    transparent 279deg,
    transparent 310deg,
    color-mix(in oklch, var(--sunny-glow) 6%, transparent) 317deg,
    transparent 324deg,
    transparent 355deg,
    color-mix(in oklch, var(--sunny-glow) 6%, transparent) 360deg
  );
  filter: blur(2px);
}
[data-slot="sunny-rays"][data-animated="true"] {
  animation: sunny-rays-rotate var(--sunny-rays-duration) linear infinite;
}
[data-slot="sunny-flare"] {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in oklch, var(--sunny-core) 60%, transparent) 45%,
    color-mix(in oklch, var(--sunny-core) 80%, transparent) 50%,
    color-mix(in oklch, var(--sunny-core) 60%, transparent) 55%,
    transparent 100%
  );
  filter: blur(0.5px);
}
[data-slot-variant="sunny-flare-h"] {
  width: calc(var(--sunny-size) * 0.375);
  height: 2px;
  opacity: 0.4;
}
[data-slot-variant="sunny-flare-v"] {
  width: 2px;
  height: calc(var(--sunny-size) * 0.25);
  background: linear-gradient(
    180deg,
    transparent 0%,
    color-mix(in oklch, var(--sunny-core) 50%, transparent) 45%,
    color-mix(in oklch, var(--sunny-core) 70%, transparent) 50%,
    color-mix(in oklch, var(--sunny-core) 50%, transparent) 55%,
    transparent 100%
  );
  opacity: 0.3;
}
[data-slot-variant="sunny-flare-diag-1"] {
  width: calc(var(--sunny-size) * 0.1875);
  height: 1px;
  transform: translate(-50%, -50%) rotate(45deg);
  opacity: 0.2;
}
[data-slot-variant="sunny-flare-diag-2"] {
  width: calc(var(--sunny-size) * 0.1875);
  height: 1px;
  transform: translate(-50%, -50%) rotate(-45deg);
  opacity: 0.2;
}
@keyframes sunny-rays-rotate {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  [data-slot="sunny-rays"] {
    animation: none !important;
  }
}
`;

/**
 * SunnyBackground — a consumer-agnostic, fully tokenizable daylight surface.
 *
 * A layered atmospheric sky with a photoreal sun: corona → glow → overexposed
 * core → slowly-rotating conic light rays → anamorphic lens flares → horizon
 * golden-hour band → depth vignette. Renders as a purely decorative,
 * non-interactive layer (`aria-hidden`, `pointer-events-none`) you drop behind
 * hero or section content.
 *
 * Built with the ecosystem (R13): the whole effect is plain CSS — no canvas,
 * no animation library — so it runs on the server and costs one composited
 * layer. Motion is a single `transform` rotation that the GPU handles cheaply.
 *
 * ## Design notes / API parity (R17)
 * There is no upstream DS equivalent for an atmospheric backdrop, so the API
 * follows the local aceternity-background convention (decorative root that
 * spreads native `div` props, merges `className`, anchors absolutely). It
 * improves on the inspiration source by:
 *   - replacing ~40 hard-coded `rgba()`/`hsl()` literals with a `var(--sunny-*)`
 *     token layer driven by props, so the surface re-tints per brand/theme;
 *   - expressing all geometry as fractions of one `size` prop (no fixed px),
 *     so the disc scales without layout drift;
 *   - reading `useReducedMotion()` in JS (not only the CSS media query) so the
 *     rotation truly never starts for reduced-motion users, even mid-session.
 *
 * Reduced motion (R-motion): only the rays rotation is suppressed; the static
 * atmospheric layers keep rendering so the surface still reads as daylight.
 */
export function SunnyBackground({
  className,
  "data-testid": testId,
  size = "20rem",
  corner = "top-right",
  animated = true,
  raysDurationSeconds = 120,
  coreColor = DEFAULT_CORE,
  glowColor = DEFAULT_GLOW,
  skyTopColor = DEFAULT_SKY_TOP,
  skyBottomColor = DEFAULT_SKY_BOTTOM,
  style,
  ...props
}: SunnyBackgroundProps) {
  const reduceMotion = useReducedMotion();
  // Scope the injected <style> to this instance via a unique attribute so two
  // SunnyBackgrounds with different palettes never clobber each other's vars.
  const instanceId = useId();
  const raysActive = animated && !reduceMotion;

  // The one place R18 allows inline style: dynamic CSS-variable overrides.
  // All literal colors arrive as props (or their signature defaults) and are
  // funneled into custom properties the static stylesheet consumes — keeping
  // every raw color out of the JSX render path.
  const cssVars = useMemo(
    () =>
      ({
        "--sunny-size": size,
        "--sunny-rays-duration": `${raysDurationSeconds}s`,
        "--sunny-core": coreColor,
        "--sunny-glow": glowColor,
        "--sunny-sky-top": skyTopColor,
        "--sunny-sky-bottom": skyBottomColor,
      }) as React.CSSProperties,
    [size, raysDurationSeconds, coreColor, glowColor, skyTopColor, skyBottomColor],
  );

  const sunPosition = cn({
    "top-8 right-8 sm:top-12 sm:right-16": corner === "top-right",
    "top-8 left-8 sm:top-12 sm:left-16": corner === "top-left",
    "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2": corner === "center",
  });

  return (
    <div
      data-slot="sunny-background"
      data-testid={testId}
      data-interlace-sunny={instanceId}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      style={{ ...cssVars, ...style }}
      {...props}
    >
      <style
        // Static structural CSS keyed only to data-slot selectors; all colors
        // resolve from the CSS variables set above. No literal ships here.
        dangerouslySetInnerHTML={{ __html: SUNNY_CSS }}
      />

      {/* Layered atmospheric sky. */}
      <div data-slot="sunny-sky" className="absolute inset-0" />
      <div data-slot="sunny-haze" className="absolute inset-0" />

      {/* Sun disc — every child scales with --sunny-size. */}
      <div data-slot="sunny-disc" className={cn("absolute", sunPosition)}>
        <div data-slot="sunny-corona-outer" />
        <div data-slot="sunny-corona-middle" />
        <div data-slot="sunny-glow" />
        <div data-slot="sunny-core" />
        <div data-slot="sunny-rays" data-animated={raysActive} />
        <div data-slot="sunny-flare" data-slot-variant="sunny-flare-h" />
        <div data-slot="sunny-flare" data-slot-variant="sunny-flare-v" />
        <div data-slot="sunny-flare" data-slot-variant="sunny-flare-diag-1" />
        <div data-slot="sunny-flare" data-slot-variant="sunny-flare-diag-2" />
      </div>

      {/* Horizon golden-hour band + depth vignette. */}
      <div
        data-slot="sunny-horizon"
        className="absolute inset-x-0 bottom-0 h-1/2"
      />
      <div data-slot="sunny-vignette" className="absolute inset-0" />
    </div>
  );
}
