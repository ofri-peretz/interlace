"use client";

import { ComponentPropsWithoutRef, useEffect, useId, useState } from "react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

/**
 * CloudParticles — volumetric, drifting fluffy clouds rendered as a decorative
 * backdrop.
 *
 * ## API parity
 *
 * No MUI / shadcn analogue exists for a decorative atmospheric layer, so the
 * shape follows the local aceternity convention (`StarsBackground`, `Meteors`):
 * a single self-contained `<div>` overlay that extends the native element, is
 * `aria-hidden` + `pointer-events-none`, and exposes its visual knobs as props.
 *
 * ## Ecosystem (R13)
 *
 * The volumetric look is a five-pass SVG filter (`feTurbulence` →
 * `feDisplacementMap` → `feMerge`) rather than a reinvented canvas particle
 * system — SVG filters are the browser-native primitive for fractal-noise
 * cloud shapes, GPU-composited and zero-JS-per-frame. Drift is a pure CSS
 * keyframe (no rAF loop, no animation library) so the only runtime work is the
 * initial deterministic layout pass.
 *
 * ## Deviations from the inspiration source
 *
 * - **No hard-coded colors.** The original baked `rgb(...)` literals into every
 *   `floodColor`. Every color is now a prop whose default resolves through a
 *   CSS custom property, so the design system owns the palette and the
 *   `no-raw-color-literal` floor passes.
 * - **No product-specific filter ID.** The original pinned a global
 *   `blog-cloud-filter` id (collision risk when two instances mount). We derive
 *   a stable per-instance id from `useId()`.
 * - **Reduced motion renders static clouds** rather than removing them — the
 *   atmosphere is still present, just not drifting, matching the rest of the
 *   aceternity family (`StarsBackground` paints once under reduced motion).
 */

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
   * CSS custom property so the design system owns the palette. Use
   * `currentColor` to inherit from the parent's text color.
   * @default "var(--cloud-body-color, currentColor)"
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
  bodyColor = "var(--cloud-body-color, currentColor)",
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
