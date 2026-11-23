'use client';

/**
 * @interlace/ui — Starfield
 *
 * A night sky behind a hero: still stars, a share of them breathing, an
 * occasional shooting star and a few slow meteors. Everything is painted on
 * ONE `<canvas>` driven by ONE animation frame loop, so the whole sky costs a
 * single layer and a single callback, whatever the star count.
 *
 * ## Why one canvas
 *
 * Stars, shooting stars and meteors are the same thing at different speeds:
 * points of light that move or do not. Drawing them on one surface means one
 * resize path, one device-pixel-ratio fix, one place that pauses, and no DOM
 * node per particle. The loop sleeps when the sky scrolls out of view or the
 * tab is hidden, so an idle page burns no frames.
 *
 * ## Colour from the cascade
 *
 * Canvas cannot read `var()`. Each colour prop is applied to the canvas as
 * its CSS `color` and read back through `getComputedStyle`, so a caller
 * passes `var(--hero-star)`, `oklch(…)` or a hex and all three work, and a
 * theme switch is picked up on the next resize.
 *
 * ## Motion
 *
 * Under `prefers-reduced-motion: reduce` the sky paints once and stops: the
 * stars stay, nothing moves, and no frame is requested. The canvas is
 * `aria-hidden` and `pointer-events-none`; it never carries meaning.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `canvas` props, minus children                        |
 * | R6   | data-slot               | `starfield`                                           |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R19  | Tokens only             | colours default to `--hero-*` tokens                  |
 * | R23  | CLS=0                   | `absolute inset-0`, never in flow                     |
 * | R25  | Client component        | canvas + animation frames need the DOM                |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

export interface StarfieldProps
  extends Omit<React.ComponentPropsWithoutRef<'canvas'>, 'children' | 'aria-hidden'> {
  /** Stars per square CSS pixel. @default 0.0002 */
  density?: number;
  /** Share of stars that breathe, 0 to 1. @default 0.7 */
  twinkle?: number;
  /** Slowest and fastest breath, in seconds per cycle. @default [2, 5] */
  twinkleDuration?: readonly [number, number];
  /** Seconds between shooting stars (shortest, longest). `false` turns them off. @default [3, 8] */
  shootingStars?: readonly [number, number] | false;
  /** Meteors in the sky at once. `0` turns them off. @default 2 */
  meteors?: number;
  /** Seconds a meteor takes to cross (shortest, longest). @default [6, 14] */
  meteorDuration?: readonly [number, number];
  /** Any CSS colour. @default 'var(--hero-star)' */
  starColor?: string;
  /** Colour of shooting-star and meteor heads. @default 'var(--hero-meteor)' */
  streakColor?: string;
}

interface Star {
  x: number;
  y: number;
  r: number;
  alpha: number;
  period: number;
  phase: number;
}

interface Streak {
  kind: 'meteor' | 'shot';
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  born: number;
  life: number;
}

const between = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Any CSS colour (a variable, `oklch()`, `color-mix()`…) as `rgb(r, g, b)`.
 * Computed styles keep modern colour spaces as written, so the colour is
 * painted on a one-pixel canvas and read back, which always yields sRGB.
 */
function resolveColor(canvas: HTMLCanvasElement, value: string): string {
  canvas.style.color = value;
  const computed = getComputedStyle(canvas).color || value;
  canvas.style.color = '';
  const probe = document.createElement('canvas');
  probe.width = 1;
  probe.height = 1;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (typeof ctx?.fillRect !== 'function' || typeof ctx.getImageData !== 'function') return computed;
  ctx.fillStyle = computed;
  ctx.fillRect(0, 0, 1, 1);
  const pixel = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${pixel[0] ?? 0}, ${pixel[1] ?? 0}, ${pixel[2] ?? 0})`;
}

/** `rgb(1, 2, 3)` (what `resolveColor` returns) → the same colour at `alpha`. */
function withAlpha(color: string, alpha: number): string {
  const [r, g, b] = color.match(/[\d.]+/g) ?? [];
  if (r === undefined || g === undefined || b === undefined) return color;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function Starfield({
  density = 0.0002,
  twinkle = 0.7,
  twinkleDuration = [2, 5],
  shootingStars = [3, 8],
  meteors = 2,
  meteorDuration = [6, 14],
  starColor = 'var(--hero-star)',
  streakColor = 'var(--hero-meteor)',
  className,
  ...props
}: StarfieldProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  const [twMin, twMax] = twinkleDuration;
  const shooting = shootingStars !== false;
  const shootMin = shootingStars ? shootingStars[0] : 0;
  const shootMax = shootingStars ? shootingStars[1] : 0;
  const [meteorMin, meteorMax] = meteorDuration;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let streaks: Streak[] = [];
    let star = '';
    let head = '';
    let frame = 0;
    let visible = true;
    let nextShot = 0;

    const spawnMeteor = (now: number): Streak => {
      const life = between(meteorMin, meteorMax) * 1000;
      const distance = Math.hypot(width, height) * 1.2;
      // Meteors fall from the upper edge toward the lower left, at a fixed
      // angle so several read as one shower rather than noise.
      return {
        kind: 'meteor',
        x: between(width * 0.2, width * 1.2),
        y: between(-height * 0.3, 0),
        vx: (-distance * 0.6) / life,
        vy: (distance * 0.8) / life,
        length: between(60, 120),
        born: now + between(0, life),
        life,
      };
    };

    const spawnShot = (now: number): Streak => {
      const life = between(700, 1200);
      const distance = between(width * 0.3, width * 0.6);
      return {
        kind: 'shot',
        x: between(0, width * 0.7),
        y: between(0, height * 0.5),
        vx: (distance * 0.9) / life,
        vy: (distance * 0.35) / life,
        length: between(80, 140),
        born: now,
        life,
      };
    };

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      star = resolveColor(canvas, starColor);
      head = resolveColor(canvas, streakColor);
      const count = Math.round(width * height * density);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: between(0.4, 1.3),
        alpha: between(0.35, 1),
        period: Math.random() < twinkle ? between(twMin, twMax) * 1000 : 0,
        phase: Math.random() * Math.PI * 2,
      }));
      const now = performance.now();
      streaks = reduced ? [] : Array.from({ length: Math.max(0, meteors) }, () => spawnMeteor(now));
    };

    const drawStreak = (s: Streak, t: number) => {
      const age = t - s.born;
      if (age < 0) return;
      const x = s.x + s.vx * age;
      const y = s.y + s.vy * age;
      const speed = Math.hypot(s.vx, s.vy) || 1;
      const tx = x - (s.vx / speed) * s.length;
      const ty = y - (s.vy / speed) * s.length;
      // Fade in over the first fifth of the life and out over the last.
      const p = age / s.life;
      const fade = Math.min(1, p * 5, (1 - p) * 5);
      const gradient = ctx.createLinearGradient(x, y, tx, ty);
      gradient.addColorStop(0, withAlpha(head, fade));
      gradient.addColorStop(1, withAlpha(head, 0));
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    };

    const paint = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        const breath = s.period && !reduced ? 0.55 + 0.45 * Math.sin((t / s.period) * Math.PI * 2 + s.phase) : 1;
        ctx.fillStyle = withAlpha(star, s.alpha * breath);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (reduced) return;
      streaks = streaks.map((s) => {
        if (t - s.born <= s.life) return s;
        // A finished meteor is replaced; a finished shooting star is dropped.
        return s.kind === 'meteor' ? spawnMeteor(t) : null;
      }).filter((s): s is Streak => s !== null);
      if (shooting && t >= nextShot) {
        streaks.push(spawnShot(t));
        nextShot = t + between(shootMin, shootMax) * 1000;
      }
      for (const s of streaks) drawStreak(s, t);
    };

    const loop = (t: number) => {
      paint(t);
      frame = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
    };

    const start = () => {
      if (reduced || frame) return;
      frame = requestAnimationFrame(loop);
    };

    layout();
    nextShot = performance.now() + between(shootMin, shootMax) * 1000;
    paint(performance.now());
    start();

    const resize = new ResizeObserver(() => {
      layout();
      paint(performance.now());
    });
    resize.observe(canvas);

    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true;
            if (visible) start();
          });
    io?.observe(canvas);

    const onVisibility = () => {
      if (!document.hidden) start();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      frame = 0;
      resize.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [
    density,
    twinkle,
    twMin,
    twMax,
    shooting,
    shootMin,
    shootMax,
    meteors,
    meteorMin,
    meteorMax,
    starColor,
    streakColor,
    reduced,
  ]);

  return (
    <canvas
      ref={canvasRef}
      data-slot="starfield"
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
      {...props}
      aria-hidden
    />
  );
}
