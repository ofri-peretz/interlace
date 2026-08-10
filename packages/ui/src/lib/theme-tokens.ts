/**
 * @interlace/ui — the theme contract.
 *
 * `THEME_TOKENS` enumerates every `--interlace-*` custom property a theme
 * MUST define, for BOTH colour schemes. `THEMES` is the registry of themes
 * that claim to satisfy it.
 *
 * ─── Why this exists as data rather than as CSS ───────────────────
 *
 * A missing token does not throw. CSS has no such thing as "undeclared" at
 * this level — the value simply resolves from whatever rule of lower
 * specificity matched, which for a theme file is the PREVIOUS theme in the
 * cascade. So a theme that forgets `--interlace-card` renders one surface
 * in the other brand's colour, on a page that is otherwise perfect, and
 * nobody files a bug because nobody can name what is wrong. That is the
 * failure this manifest exists to make impossible: it is the input to
 * `__tests__/theme-contract-lock.test.ts`, which fails on a theme missing
 * a token, on a theme inventing one outside the list (a typo is silent for
 * exactly the same reason), and on any theme × scheme whose measured
 * contrast drops below the WCAG 2.2 floors.
 *
 * ─── Provenance ──────────────────────────────────────────────────
 *
 * The list is DERIVED, not hand-typed: it is the `--interlace-*`
 * declarations of the `:root` block in `styles/interlace-theme.css`, in
 * source order. The lock re-derives it from that file on every run and
 * fails if the two disagree — so adding a token to the default theme
 * without adding it here (or vice versa) is a red test, not a discovery
 * six months later.
 *
 * ─── The two axes ────────────────────────────────────────────────
 *
 *   scheme  →  light | dark              (`.dark` / `[data-scheme='dark']`)
 *   theme   →  interlace | harbor | …    (`[data-theme='<name>']`)
 *
 * See the header of `styles/interlace-theme.css` for the selector matrix.
 */

/**
 * Every `--interlace-*` token a theme must declare, in both schemes.
 * The `--interlace-` prefix is omitted; `'primary'` means
 * `--interlace-primary`.
 */
export const THEME_TOKENS = [
  'primary',
  'primary-hover',
  'primary-active',
  'primary-foreground',
  'primary-subtle',
  'primary-subtle-foreground',
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'muted',
  'muted-foreground',
  'border',
  'input',
  'ring',
  'accent',
  'accent-foreground',
  'secondary',
  'secondary-foreground',
  'destructive',
  'destructive-foreground',
  'success',
  'success-foreground',
  'warning',
  'warning-foreground',
  'info',
  'info-foreground',
  'caution',
  'caution-foreground',
  'scrim',
  'scrim-foreground',
  'hero-star',
  'hero-trail',
  'hero-meteor',
  'hero-surface',
  'hero-surface-deep',
  'hero-foreground',
  'window-control-close',
  'window-control-minimize',
  'window-control-zoom',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'viz-grid',
  'viz-axis',
  'viz-edge',
  'radius-sm',
  'radius-md',
  'radius-lg',
  'brand-mark-bar-o',
  'brand-mark-bar-g',
] as const;

/** A token name from the manifest, without the `--interlace-` prefix. */
export type ThemeToken = (typeof THEME_TOKENS)[number];

/** The colour-scheme axis. Orthogonal to the theme axis. */
export const SCHEMES = ['light', 'dark'] as const;
export type Scheme = (typeof SCHEMES)[number];

/**
 * The theme registry.
 *
 * `name` is the literal written to `<html data-theme="…">` — except for the
 * default, which writes NO attribute at all (`:root` is Interlace, so an
 * attribute would be redundant and would make "no preference" and "chose the
 * default" indistinguishable in the DOM).
 */
export const THEMES = [
  {
    name: 'interlace',
    label: 'Interlace',
    /** Burnt orange + brand green, warm neutrals. `styles/interlace-theme.css`. */
    description: 'Warm burnt orange — the Interlace brand.',
    default: true,
  },
  {
    name: 'harbor',
    label: 'Harbor',
    /** Deep harbour blue on cool slate. `styles/themes/harbor.css`. */
    description: 'Deep harbour blue on cool slate.',
    default: false,
  },
] as const;

/** A registered theme name. */
export type ThemeName = (typeof THEMES)[number]['name'];

/** The theme that `:root` already is — written as no attribute at all. */
export const DEFAULT_THEME: ThemeName = 'interlace';

/** Narrow an arbitrary string to a registered theme name. */
export function isThemeName(value: unknown): value is ThemeName {
  return (
    typeof value === 'string' &&
    THEMES.some((theme) => theme.name === value)
  );
}

/** Narrow an arbitrary string to a colour scheme. */
export function isScheme(value: unknown): value is Scheme {
  return value === 'light' || value === 'dark';
}
