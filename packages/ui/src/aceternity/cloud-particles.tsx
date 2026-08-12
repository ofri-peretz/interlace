"use client";

/**
 * @interlace/ui — CloudParticles
 *
 * Volumetric drifting clouds as a decorative backdrop. Each cloud is a
 * radial-gradient ellipse pushed through a five-pass SVG turbulence filter —
 * body, cool underside, soft shadow, deep shadow — and translated across
 * `130vw`.
 *
 * It is an `absolute inset-0` overlay: `aria-hidden`, `pointer-events-none`,
 * and reserving no flow space, so the consumer owns the positioned ancestor.
 *
 * ## Provenance
 *
 * No MUI or shadcn analogue exists for an atmospheric layer, so the shape
 * follows the local `aceternity/` convention (`StarsBackground`, `Meteors`).
 * Against the effect this was adapted from, what is ours: every `floodColor`
 * is a prop defaulting to a CSS custom property instead of a baked `rgb()`
 * literal; the filter id comes from `useId()` rather than one global id that
 * two mounted instances would collide on; and the reduced-motion frame below.
 *
 * ## Anatomy
 *
 *   CloudParticles                   (div — data-slot="cloud-particles",
 *                                     aria-hidden, pointer-events-none)
 *     ├─ style                       (per-instance `{filterId}-drift` keyframe)
 *     ├─ svg                         (data-slot="cloud-particles-filter" —
 *     │                               2× feTurbulence, then 4 displaced layers
 *     │                               composited through feMerge)
 *     └─ div ×count                  (data-slot="cloud-particles-cloud")
 *         └─ div                     (data-slot="cloud-particles-shape")
 *
 * Layout is a deterministic golden-ratio walk (`buildClouds`), not
 * `Math.random()`, so server and client agree and the same props always
 * produce the same field. `count` is clamped to `mobileCount` below
 * `mobileBreakpoint`. Both the keyframe and the clouds render only after
 * mount, so SSR emits the filter and nothing else.
 *
 * ## Motion
 *
 * A CSS keyframe, gated three ways. The drift class is written
 * `motion-safe:animate-[var(--cloud-animation)]` and is only added when
 * `!reducedMotion`; the `--cloud-animation` variable itself is set to `none`
 * under `reduce`; and the wildcard in `styles/preflight.css` would clamp it
 * regardless. Note that the keyframe is injected by this component under a
 * per-instance name, so it is NOT in the `animation: none` list in
 * `styles/tokens.css` — the `motion-safe` variant is what does the work.
 *
 * Under `reduce` the clouds stay on screen, scaled and still (`transform:
 * scale(...)` replaces the animation), because the atmosphere is the point and
 * the drift is decoration on top of it.
 *
 * ## Why `bodyColor` is NOT `currentColor`
 *
 * It was `var(--cloud-body-color, currentColor)`, and since the DS declares no
 * `--cloud-body-color`, `currentColor` WAS the shipped default: the cloud body
 * painted in whatever text colour the overlay happened to inherit. Over a dark
 * hero that is near-white and looks deliberate, which is why it survived
 * review; over a light hero it is `--foreground` (`#0d0b09`) and the field
 * renders as a near-black smear. Only a browser shows it — jsdom has no
 * cascade and the token is syntactically valid either way.
 *
 * `currentColor` is a good default for a STROKE or a glyph: a line or an icon
 * is a mark on top of text and should read as part of it. A volumetric fill is
 * not a mark, it is a material — it stands in for the light scattering off
 * water vapour — and no material's colour is a function of the paragraph it
 * happens to sit near. Inheriting there means the fill inverts with the theme
 * while the thing it depicts does not.
 *
 * The default is now `var(--scrim-foreground)`: the DS's "light by intent, not
 * by mode" token, `#ffffff` in BOTH schemes (its partner `--scrim` is the
 * matching always-dark one). A cloud is lit from above in daylight and lit
 * from below at night; in neither case does it invert to near-black. The
 * underside and shadow layers keep reading `--muted-foreground`, which DOES
 * invert — that is correct, because those are shading, and shading is relative
 * to the surface behind it.
 *
 * Note the failure mode if a fork ships neither property: `var()` with no
 * usable substitution makes the whole `background` declaration invalid at
 * computed-value time, so the cloud paints nothing. Invisible beats a black
 * smear.
 */

import { ComponentPropsWithoutRef, useEffect, useId, useState } from "react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

interface CloudMeta {
  id: number;
  /** Horizontal start, in % of the container width. */
  x: number;
  /** Vertical position, in % of the container height. */
  y: number;
  /** Per-cloud scale multiplier (1 = native 320×140px). */
  scale: number;
  /** Per-cloud opacity. */
  opacity: number;
  /** Drift duration, in seconds. */
  speed: number;
  /** Stagger delay, in seconds. */
  delay: number;
}

interface CloudParticlesProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Number of cloud particles to render. On viewports narrower than
   * `mobileBreakpoint` this is clamped to `mobileCount` to protect the GPU
   * budget on phones.
   * @default 3
   */
  count?: number;
  /**
   * Maximum cloud count on viewports narrower than `mobileBreakpoint`.
   * @default 2
   */
  mobileCount?: number;
  /**
   * Viewport width (px) below which `mobileCount` applies.
   * @default 768
   */
  mobileBreakpoint?: number;
  /**
   * Slowest drift duration, in seconds (each cloud picks a value in
   * `[minSpeed, maxSpeed]`). Larger = slower.
   * @default 150
   */
  minSpeed?: number;
  /**
   * Fastest drift duration, in seconds.
   * @default 250
   */
  maxSpeed?: number;
  /**
   * Smallest cloud scale (1 = native 320×140px).
   * @default 0.5
   */
  minScale?: number;
  /**
   * Largest cloud scale.
   * @default 0.9
   */
  maxScale?: number;
  /**
   * Main cloud-body color. Any CSS color is valid; defaults resolve through a
   * CSS custom property so the design system owns the palette.
   *
   * Defaults to `--scrim-foreground` — white in both schemes — because a
   * volumetric fill is a material, not a mark, and must not invert with the
   * surrounding text colour. Pass `currentColor` explicitly if you genuinely
   * want the clouds to track the inherited foreground; see the file header for
   * why that is the wrong default.
   * @default "var(--cloud-body-color, var(--scrim-foreground))"
   */
  bodyColor?: string;
  /**
   * Cool underside tint that reads as light-from-above. Falls back to the
   * theme's muted-foreground token.
   * @default "var(--cloud-underside-color, var(--muted-foreground, currentColor))"
   */
  undersideColor?: string;
  /**
   * Soft drop-shadow color beneath each cloud.
   * @default "var(--cloud-shadow-color, var(--muted-foreground, currentColor))"
   */
  shadowColor?: string;
  /**
   * Opacity of the underside tint layer (0–1).
   * @default 0.08
   */
  undersideOpacity?: number;
  /**
   * Opacity of the soft-shadow layer (0–1).
   * @default 0.12
   */
  shadowOpacity?: number;
  /**
   * Opacity of the deep-shadow layer (0–1).
   * @default 0.08
   */
  deepShadowOpacity?: number;
  /**
   * Stable selector for E2E tests. Required at the type level so consumers
   * never ship an untested overlay; there is intentionally no runtime default.
   */
  "data-testid": string;
}

const PHI = 1.618033988749;
const NATIVE_WIDTH = 320;
const NATIVE_HEIGHT = 140;

/**
 * Deterministic golden-ratio layout — same input always yields the same cloud
 * field, so server and client render identically (no hydration mismatch).
 */
function buildClouds(
  count: number,
  minSpeed: number,
  maxSpeed: number,
  minScale: number,
  maxScale: number,
): CloudMeta[] {
  return Array.from({ length: Math.max(0, count) }, (_, idx) => {
    const seed = (idx * PHI) % 1;
    const seed2 = ((idx + 1) * PHI * 0.7) % 1;
    const seed3 = ((idx + 2) * PHI * 0.5) % 1;
    return {
      id: idx,
      x: -15 + seed * 30,
      y: 6 + seed2 * 16,
      scale: minScale + seed3 * (maxScale - minScale),
      opacity: 0.85 + seed * 0.15,
      speed: minSpeed + seed2 * (maxSpeed - minSpeed),
      delay: idx * 25,
    };
  });
}

/**
 * CloudParticles — see file header for the visual model and deviations.
 *
 * Layout (CLS=0): a `pointer-events-none absolute inset-0` decorative overlay.
 * It reserves no flow space and is `aria-hidden`, so it never shifts content or
 * reaches assistive tech. The consumer owns the positioned ancestor.
 */
export function CloudParticles({
  count = 3,
  mobileCount = 2,
  mobileBreakpoint = 768,
  minSpeed = 150,
  maxSpeed = 250,
  minScale = 0.5,
  maxScale = 0.9,
  bodyColor = "var(--cloud-body-color, var(--scrim-foreground))",
  undersideColor = "var(--cloud-underside-color, var(--muted-foreground, currentColor))",
  shadowColor = "var(--cloud-shadow-color, var(--muted-foreground, currentColor))",
  undersideOpacity = 0.08,
  shadowOpacity = 0.12,
  deepShadowOpacity = 0.08,
  className,
  "data-testid": testId,
  ...props
}: CloudParticlesProps) {
  const reducedMotion = useReducedMotion();
  // Per-instance filter id — stable across SSR/CSR, collision-free across mounts.
  const rawId = useId();
  const filterId = `cloud-filter-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const [effectiveCount, setEffectiveCount] = useState(count);
  // Mount flag: the keyframe stylesheet and clouds are injected client-side so
  // the deterministic field never fights React hydration.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const apply = () => {
      const mobile = window.innerWidth < mobileBreakpoint;
      setEffectiveCount(mobile ? Math.min(count, mobileCount) : count);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [count, mobileCount, mobileBreakpoint]);

  const clouds = buildClouds(
    effectiveCount,
    minSpeed,
    maxSpeed,
    minScale,
    maxScale,
  );

  // Drift is the only animated property. Scoped to this instance's filter id so
  // multiple overlays on one page never collide on the keyframe name either.
  const keyframes = `
    @keyframes ${filterId}-drift {
      0% { transform: translateX(0) scale(var(--cloud-scale, 1)); }
      100% { transform: translateX(130vw) scale(var(--cloud-scale, 1)); }
    }
  `;

  return (
    <div
      data-slot="cloud-particles"
      data-testid={testId}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      {...props}
    >
      {mounted && (
        <style suppressHydrationWarning>{keyframes}</style>
      )}

      {/* Volumetric cloud filter — fractal noise displaced into fluffy edges,
          then merged back-to-front: deep shadow, soft shadow, cool underside,
          white body. Colors flow in from props (no baked literals). */}
      <svg
        data-slot="cloud-particles-filter"
        className="absolute h-0 w-0"
        aria-hidden
      >
        <defs>
          <filter
            id={filterId}
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012"
              numOctaves={5}
              seed={15}
              result="noiseDetail"
            />
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.0096"
              numOctaves={2}
              seed={42}
              result="noiseBroad"
            />

            {/* Layer 1 — main body. */}
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation={18}
              result="bodyBlur"
            />
            <feDisplacementMap
              in="bodyBlur"
              in2="noiseDetail"
              scale={90}
              xChannelSelector="R"
              yChannelSelector="G"
              result="layerBody"
            />

            {/* Layer 2 — cool underside tint. */}
            <feFlood
              floodColor={undersideColor}
              floodOpacity={undersideOpacity}
              result="undersideFlood"
            />
            <feOffset in="SourceGraphic" dx={-8} dy={35} result="undersideOffset" />
            <feGaussianBlur in="undersideOffset" stdDeviation={18} result="undersideBlur" />
            <feDisplacementMap
              in="undersideBlur"
              in2="noiseDetail"
              scale={85}
              xChannelSelector="R"
              yChannelSelector="G"
              result="undersideShape"
            />
            <feComposite
              in="undersideFlood"
              in2="undersideShape"
              operator="in"
              result="layerUnderside"
            />

            {/* Layer 3 — soft shadow. */}
            <feFlood
              floodColor={shadowColor}
              floodOpacity={shadowOpacity}
              result="softFlood"
            />
            <feOffset in="SourceGraphic" dx={15} dy={50} result="softOffset" />
            <feGaussianBlur in="softOffset" stdDeviation={25} result="softBlur" />
            <feDisplacementMap
              in="softBlur"
              in2="noiseBroad"
              scale={70}
              xChannelSelector="R"
              yChannelSelector="G"
              result="softShape"
            />
            <feComposite
              in="softFlood"
              in2="softShape"
              operator="in"
              result="layerSoftShadow"
            />

            {/* Layer 4 — deep shadow for depth. */}
            <feFlood
              floodColor={shadowColor}
              floodOpacity={deepShadowOpacity}
              result="deepFlood"
            />
            <feOffset in="SourceGraphic" dx={18} dy={60} result="deepOffset" />
            <feGaussianBlur in="deepOffset" stdDeviation={28} result="deepBlur" />
            <feDisplacementMap
              in="deepBlur"
              in2="noiseBroad"
              scale={80}
              xChannelSelector="R"
              yChannelSelector="G"
              result="deepShape"
            />
            <feComposite
              in="deepFlood"
              in2="deepShape"
              operator="in"
              result="layerDeepShadow"
            />

            <feMerge>
              <feMergeNode in="layerDeepShadow" />
              <feMergeNode in="layerSoftShadow" />
              <feMergeNode in="layerUnderside" />
              <feMergeNode in="layerBody" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {mounted &&
        clouds.map((cloud) => (
          <div
            key={`cloud-${cloud.id}`}
            data-slot="cloud-particles-cloud"
            className={cn(
              "absolute will-change-transform",
              !reducedMotion &&
                "motion-safe:animate-[var(--cloud-animation)]",
            )}
            style={{
              left: `${cloud.x}%`,
              top: `${cloud.y}%`,
              width: NATIVE_WIDTH,
              height: NATIVE_HEIGHT,
              opacity: cloud.opacity,
              // CSS custom properties drive the per-cloud keyframe; all of these
              // are computed, not static, so inline style is the correct home.
              ["--cloud-scale"]: String(cloud.scale),
              ["--cloud-animation"]: reducedMotion
                ? "none"
                : `${filterId}-drift ${cloud.speed}s linear ${cloud.delay}s infinite`,
              transform: reducedMotion
                ? `scale(${cloud.scale})`
                : undefined,
            } as React.CSSProperties}
          >
            <div
              data-slot="cloud-particles-shape"
              className="h-full w-full rounded-full"
              style={{
                background: `radial-gradient(ellipse 55% 45% at 50% 45%, ${bodyColor} 0%, ${bodyColor} 30%, transparent 100%)`,
                filter: `url(#${filterId})`,
              }}
            />
          </div>
        ))}
    </div>
  );
}
