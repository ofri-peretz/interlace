/**
 * The motion tokens, read where JavaScript starts an animation.
 *
 * A Tailwind class like `ease-enter` follows the brand's `--ease-enter`, but a
 * Web Animations call takes a plain string, so a curve typed into it stays the
 * same when a brand retunes the CSS. These read the token from the element the
 * animation runs on, so the brand's value (and any value scoped to a subtree)
 * wins. The fallbacks are Interlace's defaults, used before the stylesheet
 * loads or where no token is defined.
 */

const EASE = {
  enter: 'cubic-bezier(0.16, 1, 0.3, 1)',
  exit: 'cubic-bezier(0.5, 0, 0.75, 0)',
  move: 'cubic-bezier(0.65, 0, 0.35, 1)',
} as const;

const DURATION = { fast: 100, base: 150, medium: 250, slow: 400 } as const;

export type MotionEase = keyof typeof EASE;
export type MotionDuration = keyof typeof DURATION;

/** Called where an animation starts, which is always in the browser. */
const read = (el: Element, name: string): string => getComputedStyle(el).getPropertyValue(name).trim();

/** The brand's `--ease-{name}` on `el`, for a Web Animations `easing`. */
export function motionEase(el: Element, name: MotionEase): string {
  return read(el, `--ease-${name}`) || EASE[name];
}

/** The brand's `--duration-{name}` on `el`, in milliseconds. */
export function motionDuration(el: Element, name: MotionDuration): number {
  const value = read(el, `--duration-${name}`);
  const match = /^(\d+(?:\.\d+)?|\.\d+)(ms|s)$/.exec(value);
  if (!match) return DURATION[name];
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
}
