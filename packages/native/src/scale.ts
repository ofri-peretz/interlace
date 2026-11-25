/**
 * The non-colour scales, in points: space, corners, type, motion and touch targets.
 *
 * They mirror the web scales (packages/ui/styles/structure/*.css and the type ramp) in the units
 * a phone reads. Type starts at 17pt body, the iOS reading default, because a phone held at arm's
 * length is not a laptop: the same ratio, one step larger. Motion is the web budget exactly
 * (MOTION_PHILOSOPHY.md): 100ms press feedback, 150ms state, 250ms surfaces, 400ms continuity.
 */

/** Gaps and padding on a 4pt grid. Names match the web `Stack gap` names. */
export const SPACE = {
  none: 0,
  '3xs': 2,
  '2xs': 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;
export type Space = keyof typeof SPACE;

/** Corners, derived from a theme's base radius so a consumer's `radius` override moves them all. */
export function radii(base: number) {
  return {
    none: 0,
    sm: Math.max(0, Math.round(base * 0.5)),
    md: Math.max(0, Math.round(base * 0.75)),
    lg: base,
    xl: Math.round(base * 1.5),
    full: 9999,
  } as const;
}
export type Radius = keyof ReturnType<typeof radii>;

/** The type roles. `display`, `heading` and `title` read the display font; the rest the text font. */
export const TYPE = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.4, font: 'display' },
  heading: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.3, font: 'display' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.2, font: 'display' },
  lead: { fontSize: 19, lineHeight: 28, fontWeight: '400', letterSpacing: 0, font: 'text' },
  body: { fontSize: 17, lineHeight: 26, fontWeight: '400', letterSpacing: 0, font: 'text' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0, font: 'text' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0, font: 'text' },
  numeral: { fontSize: 44, lineHeight: 52, fontWeight: '700', letterSpacing: -0.5, font: 'display' },
} as const;
export type TypeRole = keyof typeof TYPE;

/**
 * Dynamic Type and Android font scale grow text up to this multiple. Uncapped, a 3.5x setting
 * breaks a game board; capped at 2, body text still reaches 34pt.
 */
export const MAX_FONT_SCALE = 2;

/** Motion budget in milliseconds, and the curves, as cubic-bezier control points. */
export const MOTION = {
  duration: { instant: 0, fast: 100, base: 150, medium: 250, slow: 400 },
  easing: {
    enter: [0.16, 1, 0.3, 1],
    exit: [0.5, 0, 0.75, 0],
    move: [0.65, 0, 0.35, 1],
  },
  /** Press feedback: how far a pressed surface sinks. Transform only, so it stays on the UI thread. */
  pressScale: 0.97,
} as const;

/** The smallest touch target: 44pt (Apple HIG; WCAG 2.5.5 AAA). Android's 48dp is met by `lg`. */
export const CONTROL = { sm: 44, md: 48, lg: 56 } as const;
export type ControlSize = keyof typeof CONTROL;
