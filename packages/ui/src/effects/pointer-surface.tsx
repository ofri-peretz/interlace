'use client';

/**
 * @interlace/ui — PointerSurface
 *
 * A surface that answers the pointer: a soft light that follows it across a
 * card, a slight tilt toward it, or both. It is the feel of picking a card up
 * off a table, for a grid of choices a reader is weighing (plans, sessions,
 * topics), not for every box on a page.
 *
 * ## Content first
 *
 * The children render as they are, in the server HTML. The light is a
 * separate `aria-hidden` wash over the content, faint enough to leave text
 * contrast alone, that never takes the pointer, so links and buttons inside work as usual and nothing is read
 * twice. The tilt is a transform on the surface itself and moves no text in
 * the reading order.
 *
 * ## Motion
 *
 * Only on a device with a fine pointer that can hover, and never under
 * `prefers-reduced-motion: reduce`: a touch screen or a reader who asked for
 * less motion gets a still surface. The pointer position is written to two
 * CSS variables (`--pointer-x`, `--pointer-y`) and the light and tilt are
 * computed from them in CSS, so a move costs one style write and no React
 * render. The tilt eases back to flat when the pointer leaves. Keyboard focus
 * inside lights the surface from its centre, so a keyboard reader sees the
 * same lift.
 *
 * ## Tokens
 *
 * The light is `--primary` mixed toward transparent; set `--pointer-light`
 * to retune it. The tilt is `max` degrees at the edge (default 4).
 *
 * ## Composition
 *
 *   PointerSurface                      (div — data-slot="pointer-surface", data-effect, data-active)
 *     ├─ light                          (aria-hidden, pointer-events-none — data-slot="pointer-surface-light")
 *     └─ children
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `div` props                                          |
 * | R6   | data-slot per part      | pointer-surface / -light                             |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                    |
 * | R8   | Enums, not booleans     | `effect`                                             |
 * | R19  | Tokens only             | `--primary`, `--duration-*`, `--ease-*`              |
 * | R25  | Client component        | pointer tracking                                     |
 * | R26  | A11y                    | decorative layer hidden; focus lights it too         |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

export type PointerSurfaceEffect = 'light' | 'tilt' | 'both';

export interface PointerSurfaceProps extends React.ComponentPropsWithoutRef<'div'> {
  /** What follows the pointer: a soft `light`, a slight `tilt`, or `both`. @default 'light' */
  effect?: PointerSurfaceEffect;
  /** The tilt at the edge of the surface, in degrees. Kept small on purpose. @default 4 */
  max?: number;
}

const FINE_POINTER = '(hover: hover) and (pointer: fine)';

export function PointerSurface({
  effect = 'light',
  max = 4,
  className,
  style,
  children,
  onPointerMove,
  onPointerLeave,
  onFocus,
  onBlur,
  ...props
}: PointerSurfaceProps) {
  const reduced = useReducedMotion();
  const [fine, setFine] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(FINE_POINTER);
    const update = () => setFine(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  const live = fine && !reduced;
  const light = effect !== 'tilt';
  const tilt = effect !== 'light';

  const place = (x: number, y: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--pointer-x', `${x}`);
    el.style.setProperty('--pointer-y', `${y}`);
  };

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    if (!live || event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    place((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
    if (!active) setActive(true);
  };

  const handleLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(event);
    place(0.5, 0.5);
    setActive(false);
  };

  const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    if (!live) return;
    place(0.5, 0.5);
    setActive(true);
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    onBlur?.(event);
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActive(false);
  };

  return (
    <div
      ref={ref}
      data-slot="pointer-surface"
      data-effect={effect}
      data-active={live && active ? '' : undefined}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={{ '--pointer-x': 0.5, '--pointer-y': 0.5, '--pointer-max': `${max}deg`, ...style } as React.CSSProperties}
      className={cn(
        'group/pointer relative isolate',
        tilt &&
          live &&
          'transition-transform duration-(--duration-slow) ease-(--ease-enter) [transform:perspective(60rem)_rotateX(0deg)_rotateY(0deg)] data-[active]:[transform:perspective(60rem)_rotateX(calc((0.5_-_var(--pointer-y))*var(--pointer-max)*2))_rotateY(calc((var(--pointer-x)_-_0.5)*var(--pointer-max)*2))] data-[active]:duration-(--duration-fast)',
        className,
      )}
      {...props}
    >
      {light && live ? (
        <span
          aria-hidden="true"
          data-slot="pointer-surface-light"
          className="pointer-events-none absolute inset-0 z-raised rounded-[inherit] opacity-0 transition-opacity duration-(--duration-medium) ease-(--ease-move) [--pointer-light:color-mix(in_oklch,var(--primary)_10%,transparent)] [background:radial-gradient(28rem_circle_at_calc(var(--pointer-x)*100%)_calc(var(--pointer-y)*100%),var(--pointer-light),transparent_60%)] group-data-[active]/pointer:opacity-100"
        />
      ) : null}
      {children}
    </div>
  );
}
