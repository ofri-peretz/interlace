"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import { cn } from "../lib/cn.js";
import { useReducedMotion } from "../lib/use-reduced-motion.js";

/**
 * ## API parity
 *
 * Re-authored from the MagicUI `Particles` (https://magicui.design/docs/components/particles).
 * Deviations from upstream, each deliberate:
 *
 * 1. **Token-driven color.** Upstream defaults `color="#ffffff"` and converts
 *    hex → rgb at runtime. Raw hex literals fork the design system (R19), so
 *    this version paints in the element's resolved `currentColor`: the wrapper
 *    carries a Tailwind text token (default `text-fd-foreground`) and the
 *    canvas reads `getComputedStyle(el).color` at mount. Consumers retint by
 *    passing `className="text-fd-primary"` — no color prop, no literal.
 * 2. **Reduced-motion contract.** Upstream animates unconditionally. This
 *    version reads `useReducedMotion()` and paints a single static frame
 *    instead of running `requestAnimationFrame`, honoring WCAG 2.3.3 / the
 *    Interlace motion budget.
 * 3. **Consumer-agnostic root.** Extends `React.ComponentPropsWithoutRef<"div">`,
 *    forwards `ref` to the wrapper, spreads `...props`, and merges `className`
 *    via `cn` — same shape as `Marquee`. No app/next/blog imports.
 * 4. **Pointer tracking is local + opt-out.** Upstream attaches a global
 *    `window` mousemove listener even when `staticity` makes it a no-op. This
 *    version listens on the wrapper itself (pointermove, passive) and skips the
 *    listener entirely when `interactive={false}`.
 *
 * The component is purely decorative chrome: it renders `aria-hidden` and
 * `pointer-events-none`, so it never enters the a11y tree or steals clicks.
 */

/** Imperative handle for forcing a fresh particle field (e.g. on route change). */
export interface ParticlesHandle {
  /** Clear and regenerate the particle field at the current canvas size. */
  refresh: () => void;
}

interface ParticlesProps extends React.ComponentPropsWithoutRef<"div"> {
  /**
   * Optional CSS class name. Set a Tailwind text token here to recolor the
   * particles (they paint in the resolved `currentColor`), e.g.
   * `className="text-fd-primary"`.
   */
  className?: string;
  /**
   * Number of particles to render.
   * @default 100
   */
  quantity?: number;
  /**
   * Resistance to the pointer — higher values make particles drift less
   * toward the cursor. Has no effect when `interactive` is `false`.
   * @default 50
   */
  staticity?: number;
  /**
   * Easing factor for pointer-follow interpolation — higher values make the
   * drift slower and smoother.
   * @default 50
   */
  ease?: number;
  /**
   * Base particle radius in CSS pixels. Each particle adds 0–2px of jitter
   * on top of this floor.
   * @default 0.4
   */
  size?: number;
  /**
   * Horizontal ambient drift applied to every particle each frame.
   * @default 0
   */
  vx?: number;
  /**
   * Vertical ambient drift applied to every particle each frame.
   * @default 0
   */
  vy?: number;
  /**
   * Whether particles drift toward the pointer as it moves over the field.
   * Turn off for a purely ambient backdrop (also skips the listener).
   * @default true
   */
  interactive?: boolean;
}

type Circle = {
  x: number;
  y: number;
  translateX: number;
  translateY: number;
  size: number;
  alpha: number;
  targetAlpha: number;
  dx: number;
  dy: number;
  magnetism: number;
};

/**
 * Reads the canvas wrapper's resolved text color and returns its RGB channels.
 *
 * `getComputedStyle().color` always serializes to `rgb()` / `rgba()`, so we can
 * parse the channels directly without ever embedding a color literal in source.
 * Falls back to opaque white channels if parsing fails (e.g. `transparent`),
 * keeping the canvas visible against a dark backdrop.
 */
function readRgbChannels(el: HTMLElement | null): [number, number, number] {
  const fallback: [number, number, number] = [255, 255, 255];
  if (!el || typeof window === "undefined") return fallback;
  const resolved = window.getComputedStyle(el).color;
  const match = resolved.match(/\d+(\.\d+)?/g);
  if (!match || match.length < 3) return fallback;
  return [Number(match[0]), Number(match[1]), Number(match[2])];
}

function remapValue(
  value: number,
  start1: number,
  end1: number,
  start2: number,
  end2: number,
): number {
  const remapped =
    ((value - start1) * (end2 - start2)) / (end1 - start1) + start2;
  return remapped > 0 ? remapped : 0;
}

/**
 * Particles — an ambient, token-driven particle field for hero and section
 * backdrops. Decorative-only: `aria-hidden` and `pointer-events-none`, so it
 * never reaches the accessibility tree or intercepts input.
 *
 * Motion control: respects `prefers-reduced-motion: reduce` — when set, it
 * paints one static frame instead of animating, so reduced-motion users still
 * see the texture without the movement.
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <Particles
 *     data-testid="hero-particles"
 *     className="absolute inset-0 text-fd-primary"
 *     quantity={120}
 *   />
 * </div>
 * ```
 */
export const Particles = forwardRef<ParticlesHandle, ParticlesProps>(
  function Particles(
    {
      className,
      quantity = 100,
      staticity = 50,
      ease = 50,
      size = 0.4,
      vx = 0,
      vy = 0,
      interactive = true,
      ...props
    },
    handleRef,
  ) {
    const reducedMotion = useReducedMotion();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const context = useRef<CanvasRenderingContext2D | null>(null);
    const circles = useRef<Circle[]>([]);
    const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
    const rgb = useRef<[number, number, number]>([255, 255, 255]);
    const rafId = useRef<number | null>(null);

    const circleParams = useCallback((): Circle => {
      const x = Math.floor(Math.random() * canvasSize.current.w);
      const y = Math.floor(Math.random() * canvasSize.current.h);
      const pSize = Math.floor(Math.random() * 2) + size;
      const targetAlpha = Number((Math.random() * 0.6 + 0.1).toFixed(1));
      const dx = (Math.random() - 0.5) * 0.1;
      const dy = (Math.random() - 0.5) * 0.1;
      const magnetism = 0.1 + Math.random() * 4;
      return {
        x,
        y,
        translateX: 0,
        translateY: 0,
        size: pSize,
        alpha: 0,
        targetAlpha,
        dx,
        dy,
        magnetism,
      };
    }, [size]);

    const drawCircle = useCallback(
      (circle: Circle, dpr: number, push = true) => {
        const ctx = context.current;
        if (!ctx) return;
        const { x, y, translateX, translateY, size: pSize, alpha } = circle;
        ctx.translate(translateX, translateY);
        ctx.beginPath();
        ctx.arc(x, y, pSize, 0, 2 * Math.PI);
        const [r, g, b] = rgb.current;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (push) circles.current.push(circle);
      },
      [],
    );

    // One effect owns the entire canvas lifecycle: sizing, drawing, the
    // animation loop, pointer tracking, and resize handling. Re-runs when a
    // tuning prop that affects the field changes. `refresh` is exposed
    // imperatively rather than as a re-render trigger.
    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      context.current = ctx;

      const dpr =
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      rgb.current = readRgbChannels(container);

      const clear = () =>
        ctx.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h);

      const seed = () => {
        circles.current = [];
        for (let i = 0; i < quantity; i++) {
          drawCircle(circleParams(), dpr);
        }
      };

      const resize = () => {
        canvasSize.current.w = container.offsetWidth;
        canvasSize.current.h = container.offsetHeight;
        canvas.width = canvasSize.current.w * dpr;
        canvas.height = canvasSize.current.h * dpr;
        canvas.style.width = `${canvasSize.current.w}px`;
        canvas.style.height = `${canvasSize.current.h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        seed();
      };

      const tick = () => {
        clear();
        circles.current.forEach((circle, i) => {
          const edges = [
            circle.x + circle.translateX - circle.size,
            canvasSize.current.w - circle.x - circle.translateX - circle.size,
            circle.y + circle.translateY - circle.size,
            canvasSize.current.h - circle.y - circle.translateY - circle.size,
          ];
          const closestEdge = edges.reduce((a, b) => Math.min(a, b));
          const remapped = Number(remapValue(closestEdge, 0, 20, 0, 1).toFixed(2));
          if (remapped > 1) {
            circle.alpha += 0.02;
            if (circle.alpha > circle.targetAlpha) {
              circle.alpha = circle.targetAlpha;
            }
          } else {
            circle.alpha = circle.targetAlpha * remapped;
          }
          circle.x += circle.dx + vx;
          circle.y += circle.dy + vy;
          circle.translateX +=
            (mouse.current.x / (staticity / circle.magnetism) -
              circle.translateX) /
            ease;
          circle.translateY +=
            (mouse.current.y / (staticity / circle.magnetism) -
              circle.translateY) /
            ease;

          drawCircle(circle, dpr, false);

          if (
            circle.x < -circle.size ||
            circle.x > canvasSize.current.w + circle.size ||
            circle.y < -circle.size ||
            circle.y > canvasSize.current.h + circle.size
          ) {
            circles.current.splice(i, 1);
            drawCircle(circleParams(), dpr);
          }
        });
        rafId.current = window.requestAnimationFrame(tick);
      };

      resize();

      if (reducedMotion) {
        // Reduced motion: paint a single static frame at full target alpha so
        // the texture is present without any movement.
        clear();
        circles.current.forEach((circle) => {
          circle.alpha = circle.targetAlpha;
          drawCircle(circle, dpr, false);
        });
      } else {
        tick();
      }

      const onPointerMove = (event: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        const { w, h } = canvasSize.current;
        const x = event.clientX - rect.left - w / 2;
        const y = event.clientY - rect.top - h / 2;
        if (x < w / 2 && x > -w / 2 && y < h / 2 && y > -h / 2) {
          mouse.current.x = x;
          mouse.current.y = y;
        }
      };

      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      const onResize = () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
      };

      const trackPointer = interactive && !reducedMotion;
      if (trackPointer) {
        container.addEventListener("pointermove", onPointerMove, {
          passive: true,
        });
      }
      window.addEventListener("resize", onResize);

      return () => {
        if (rafId.current != null) window.cancelAnimationFrame(rafId.current);
        if (resizeTimer) clearTimeout(resizeTimer);
        if (trackPointer) {
          container.removeEventListener("pointermove", onPointerMove);
        }
        window.removeEventListener("resize", onResize);
      };
    }, [
      quantity,
      staticity,
      ease,
      vx,
      vy,
      interactive,
      reducedMotion,
      circleParams,
      drawCircle,
    ]);

    useImperativeHandle(
      handleRef,
      (): ParticlesHandle => ({
        refresh: () => {
          const container = containerRef.current;
          const ctx = context.current;
          if (!container || !ctx) return;
          const dpr =
            typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
          rgb.current = readRgbChannels(container);
          ctx.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h);
          circles.current = [];
          for (let i = 0; i < quantity; i++) {
            drawCircle(circleParams(), dpr);
          }
        },
      }),
      [quantity, circleParams, drawCircle],
    );

    return (
      <div
        ref={containerRef}
        data-slot="particles"
        aria-hidden="true"
        className={cn(
          "pointer-events-none text-fd-foreground",
          className,
        )}
        {...props}
      >
        <canvas ref={canvasRef} className="size-full" />
      </div>
    );
  },
);
