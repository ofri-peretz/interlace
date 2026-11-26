'use client';

/**
 * @interlace/ui — DrawOn
 *
 * A line drawing that draws itself as it scrolls into view: an illustration,
 * a diagram, an arrow that points at the next thing, a signature. Wrap any
 * inline SVG; every stroked shape inside traces its own line, one after
 * another in document order, and filled shapes fade in once the lines are
 * down. It is the motion of a pen on paper, so it suits a calm, editorial
 * page where line drawings stand in for photographs.
 *
 * ## Content first
 *
 * The server HTML holds the finished drawing, so a crawler, a reader without
 * scripts and a print stylesheet all get it. The browser hides the lines just
 * before the first paint and draws them as the drawing enters the viewport,
 * once. Nothing is added to or removed from the SVG, so its own `role`,
 * `aria-label` or `aria-hidden` stays exactly as you wrote it.
 *
 * ## Motion
 *
 * Each shape is measured with `getTotalLength()` and drawn by animating
 * `stroke-dashoffset` on the Web Animations API, so there are no keyframes to
 * add and no length to type by hand. When a line finishes, its dash styles are
 * removed, so the drawing ends exactly as authored (dashed strokes included).
 * Under `prefers-reduced-motion: reduce`, without IntersectionObserver, or
 * without `element.animate`, the drawing is simply there. Drawings already in
 * view on load draw straight away.
 *
 * ## Composition
 *
 *   DrawOn                              (div — data-slot="draw-on", data-drawn)
 *     └─ your <svg>                     (untouched: its own a11y attributes)
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `div` props                                          |
 * | R6   | data-slot per part      | draw-on                                              |
 * | R7   | cn + ...rest            | `cn(className)` + `{...props}`                       |
 * | R8   | Enums, not booleans     | `order`                                              |
 * | R25  | Client component        | the drawing runs in the browser                      |
 * | R26  | A11y from native el     | the SVG keeps its own semantics                      |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { motionEase } from '../lib/motion-token.js';

/** The SVG shapes that have a length to draw. */
const SHAPES = 'path, line, polyline, polygon, circle, ellipse, rect';


export type DrawOnOrder = 'sequence' | 'together';

export interface DrawOnProps extends React.ComponentPropsWithoutRef<'div'> {
  /** `sequence` draws one line after another in document order; `together` draws them all at once. @default 'sequence' */
  order?: DrawOnOrder;
  /** Milliseconds each line takes to draw. @default 1200 */
  duration?: number;
  /** Milliseconds between the start of one line and the next, for `order="sequence"`. @default 150 */
  stagger?: number;
  /** Milliseconds to wait after the drawing enters the viewport. @default 0 */
  delay?: number;
  /** How much of the drawing must be visible before it draws, from 0 to 1. @default 0.3 */
  amount?: number;
}

interface Stroke {
  el: SVGGeometryElement;
  length: number;
}

function isStroked(el: Element): boolean {
  const style = getComputedStyle(el);
  return style.stroke !== '' && style.stroke !== 'none' && parseFloat(style.strokeWidth || '1') > 0;
}

function isFilled(el: Element): boolean {
  const fill = getComputedStyle(el).fill;
  return fill !== '' && fill !== 'none' && fill !== 'transparent' && fill !== 'rgba(0, 0, 0, 0)';
}

/** Measure every shape inside and hide it, ready to draw. Returns what to animate. */
function hideShapes(root: HTMLElement): { strokes: Stroke[]; fills: SVGElement[] } {
  const strokes: Stroke[] = [];
  const fills: SVGElement[] = [];
  for (const el of root.querySelectorAll<SVGGeometryElement>(SHAPES)) {
    const length = isStroked(el) && typeof el.getTotalLength === 'function' ? el.getTotalLength() : 0;
    if (length > 0) {
      strokes.push({ el, length });
      el.style.strokeDasharray = `${length} ${length}`;
      el.style.strokeDashoffset = `${length}`;
      // A filled, stroked shape fades its fill in from halfway through its outline, so the two resolve together.
      if (isFilled(el)) el.style.fillOpacity = '0';
    } else if (isFilled(el)) {
      fills.push(el);
      el.style.opacity = '0';
    }
  }
  return { strokes, fills };
}

export function DrawOn({
  order = 'sequence',
  duration = 1200,
  stagger = 150,
  delay = 0,
  amount = 0.3,
  className,
  children,
  ...props
}: DrawOnProps) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);

  // Before paint: hide the lines, so they can draw instead of flashing.
  React.useLayoutEffect(() => {
    const root = ref.current;
    if (!root || reduced || typeof root.animate !== 'function') return;
    if (typeof IntersectionObserver === 'undefined') return;
    // Once drawn, a prop change (or a Fast Refresh) never draws it again.
    if (root.dataset.drawn) return;

    const { strokes, fills } = hideShapes(root);
    if (strokes.length === 0 && fills.length === 0) return;

    const clear = () => {
      for (const { el } of strokes) {
        el.style.strokeDasharray = '';
        el.style.strokeDashoffset = '';
        el.style.fillOpacity = '';
      }
      for (const el of fills) el.style.opacity = '';
    };

    let io: IntersectionObserver | undefined;
    const draw = (wait: number) => {
      if (root.dataset.drawn) return;
      root.dataset.drawn = 'true';
      io?.disconnect();
      const step = order === 'sequence' ? stagger : 0;
      const end = wait + (strokes.length > 0 ? (strokes.length - 1) * step + duration : 0);

      strokes.forEach(({ el, length }, i) => {
        const start = wait + i * step;
        const line = el.animate([{ strokeDashoffset: `${length}` }, { strokeDashoffset: '0' }], {
          duration,
          delay: start,
          easing: motionEase(el, 'move'),
          fill: 'both',
        });
        line.onfinish = () => {
          el.style.strokeDasharray = '';
          el.style.strokeDashoffset = '';
          line.cancel();
        };
        if (el.style.fillOpacity === '0') {
          el.style.fillOpacity = '';
          el.animate([{ fillOpacity: 0 }, { fillOpacity: 1 }], {
            duration: duration / 2,
            delay: start + duration / 2,
            easing: motionEase(el, 'move'),
            fill: 'backwards',
          });
        }
      });
      for (const el of fills) {
        el.style.opacity = '';
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: Math.min(duration, 600),
          delay: Math.max(wait, end - Math.min(duration, 600)),
          easing: motionEase(el, 'move'),
          fill: 'backwards',
        });
      }
    };

    // A focusable element inside (a link in a diagram) shows the drawing at once.
    const onFocus = () => {
      if (root.dataset.drawn) return;
      root.dataset.drawn = 'true';
      io?.disconnect();
      clear();
    };
    root.addEventListener('focusin', onFocus);

    io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) draw(delay);
      },
      { threshold: Math.min(1, Math.max(0, amount)) },
    );
    io.observe(root);

    return () => {
      io?.disconnect();
      root.removeEventListener('focusin', onFocus);
      for (const { el } of strokes) for (const a of el.getAnimations?.() ?? []) a.cancel();
      for (const el of fills) for (const a of el.getAnimations?.() ?? []) a.cancel();
      clear();
    };
  }, [reduced, order, duration, stagger, delay, amount]);

  return (
    <div ref={ref} data-slot="draw-on" data-order={order} className={cn(className)} {...props}>
      {children}
    </div>
  );
}
