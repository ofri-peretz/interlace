/**
 * AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Source: apps/interlace-docs-baseline/ in the agents repo.
 * Edit there, then run `npm run sync` to redistribute.
 * Local edits will be overwritten on next sync (or refused without --force).
 */
'use client';

/**
 * Theme-aware hero gradient — wraps `<BackgroundGradientAnimation>` (Aceternity)
 * with light/dark color sets and a matching `useHeroTextStyles()` hook so
 * landing-page text always meets WCAG AA contrast against the live gradient.
 *
 * Brand defaults follow the line-wide Interlace palette (burnt orange, hue
 * ~22°). Override `darkColors` / `lightColors` per-site for product-specific
 * accents — but keep the overall burnt-orange family so cross-product visits
 * still feel familiar.
 *
 * Tailwind utilities + CSS variables only — no inline color styles in the
 * children's text. Use `useHeroTextStyles()` to get the right Tailwind class
 * for the current theme.
 *
 * Peer deps required in the consuming app:
 *   - `next-themes` (already a transitive of `fumadocs-ui`)
 *   - `@base-ui-components/react` (not used here directly, listed for the wider baseline)
 */

import { useTheme } from 'next-themes';
import { useEffect, useState, type ReactNode } from 'react';
import { BackgroundGradientAnimation } from '#interlace/components/ui/background-gradient-animation';

export interface HeroGradientColors {
  gradientBackgroundStart: string;
  gradientBackgroundEnd: string;
  firstColor: string;
  secondColor: string;
  thirdColor: string;
  fourthColor: string;
  fifthColor: string;
  pointerColor: string;
}

/**
 * Every visible text/control element in a `<ThemedHeroGradient>` gets a
 * theme-adaptive class so contrast tracks the active gradient. Hardcoding
 * `text-white` (the previous bug) renders the badge/CTA invisible against the
 * light-mode gradient — never use raw `text-white` inside the hero; always
 * pick the matching slot from `useHeroTextStyles()`.
 */
export interface HeroTextStyleSet {
  /** Top-level title — the largest, most contrast-critical element. */
  headline: string;
  /** Gradient run inside the headline (e.g. `<FlipWords>`). */
  headlineGradient: string;
  /** Tagline / subhead — smaller body text below the headline. */
  subheadline: string;
  /** Inline emphasized snippet within the subheadline. */
  subheadlineAccent: string;
  /** Above-the-fold context badge ("A family of TypeScript-native developer tools"). */
  badge: string;
  /** Border + background for the badge container. */
  badgeContainer: string;
  /** Primary CTA (filled button) — full surface + label classes. */
  ctaPrimary: string;
  /** Secondary CTA (outlined / ghost button) — full surface + label classes. */
  ctaSecondary: string;
  /** Any muted helper text rendered inside the hero (e.g. install command, footnote). */
  muted: string;
}

// Brand palettes — burnt orange + bottle green (see `css/brand.css`). The
// text-style sets below are AA-verified against these exact gradients: the
// dark set assumes orange-900 → stone-950, the light set orange-100 →
// amber-200. Changing a background here requires re-checking the paired
// text classes.
const DEFAULT_DARK_COLORS: HeroGradientColors = {
  gradientBackgroundStart: 'rgb(124, 45, 18)', // orange-900
  gradientBackgroundEnd: 'rgb(12, 10, 9)', // stone-950
  firstColor: '244, 121, 74', // brand orange (dark pair)
  secondColor: '13, 148, 96', // brand green (dark pair)
  thirdColor: '251, 185, 154', // pale burnt orange
  fourthColor: '10, 125, 82', // deep bottle green
  fifthColor: '168, 76, 36', // mid burnt orange
  pointerColor: '244, 121, 74',
};

const DEFAULT_LIGHT_COLORS: HeroGradientColors = {
  gradientBackgroundStart: 'rgb(255, 237, 213)', // orange-100
  gradientBackgroundEnd: 'rgb(253, 230, 138)', // amber-200
  firstColor: '168, 76, 23', // brand orange (light pair)
  secondColor: '10, 107, 71', // brand green (light pair)
  thirdColor: '124, 45, 18', // orange-900
  fourthColor: '10, 125, 82', // deep bottle green
  fifthColor: '120, 53, 15', // amber-900
  pointerColor: '168, 76, 23',
};

const DEFAULT_TEXT_STYLES: { dark: HeroTextStyleSet; light: HeroTextStyleSet } = {
  // Dark gradient (orange-900 → stone-950): white-family text passes 4.5:1.
  dark: {
    headline: 'text-white',
    headlineGradient:
      'bg-gradient-to-r from-orange-300 via-amber-300 to-orange-400 bg-clip-text text-transparent',
    subheadline: 'text-orange-100',
    subheadlineAccent: 'text-white font-semibold',
    badge: 'text-white',
    badgeContainer: 'border-white/30 bg-white/15 backdrop-blur-sm',
    ctaPrimary:
      'bg-white text-orange-950 hover:bg-orange-50 shadow-lg hover:shadow-xl',
    ctaSecondary:
      'border border-white/40 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25',
    muted: 'text-orange-100/80',
  },
  // Light gradient (orange-100 → amber-200): MUST use deep orange-950/800
  // family text — `text-white` here is invisible (4.5:1 fails by miles).
  light: {
    headline: 'text-orange-950',
    headlineGradient:
      'bg-gradient-to-r from-orange-700 via-amber-700 to-orange-800 bg-clip-text text-transparent',
    subheadline: 'text-orange-900',
    subheadlineAccent: 'text-orange-950 font-semibold',
    badge: 'text-orange-950',
    badgeContainer: 'border-orange-800/30 bg-white/60 backdrop-blur-sm',
    // orange-700 + white text is ~4.0:1 (AA-fail). orange-900 hits ~7:1.
    ctaPrimary:
      'bg-orange-900 text-white hover:bg-orange-950 shadow-lg hover:shadow-xl',
    ctaSecondary:
      'border border-orange-800/40 bg-white/70 text-orange-950 backdrop-blur-sm hover:bg-white/90',
    muted: 'text-orange-900/80',
  },
};

export interface ThemedHeroGradientProps {
  children: ReactNode;
  className?: string;
  darkColors?: HeroGradientColors;
  lightColors?: HeroGradientColors;
  /** Pointer interactivity. Default true (cursor influences the gradient). */
  interactive?: boolean;
  /** Container size pass-through. Default `80%`. */
  size?: string;
  /** SSR fallback theme. Default `dark` (matches the production hero feel). */
  ssrDefault?: 'dark' | 'light';
}

/**
 * Read the current theme synchronously from `<html class="dark">` (the
 * convention used by `next-themes`, `@storybook/addon-themes`, and any other
 * Tailwind dark-mode setup). Falls back to the `ssrDefault` during SSR (no
 * window) to avoid hydration mismatch.
 */
function readDomTheme(ssrDefault: 'dark' | 'light'): 'dark' | 'light' {
  if (typeof document === 'undefined') return ssrDefault;
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemedHeroGradient({
  children,
  className,
  darkColors = DEFAULT_DARK_COLORS,
  lightColors = DEFAULT_LIGHT_COLORS,
  interactive = true,
  size = '80%',
  ssrDefault = 'dark',
}: ThemedHeroGradientProps) {
  const { resolvedTheme } = useTheme();
  // `useState` initializer reads the DOM once on first render so the very
  // first paint matches the active theme — fixes axe-core color-contrast
  // checks that capture markup before `useEffect` runs.
  const [theme, setTheme] = useState<'dark' | 'light'>(() => readDomTheme(ssrDefault));

  useEffect(() => {
    if (resolvedTheme === 'dark' || resolvedTheme === 'light') {
      setTheme(resolvedTheme);
      return;
    }
    setTheme(readDomTheme(ssrDefault));
  }, [resolvedTheme, ssrDefault]);

  const palette = theme === 'dark' ? darkColors : lightColors;

  return (
    <BackgroundGradientAnimation
      gradientBackgroundStart={palette.gradientBackgroundStart}
      gradientBackgroundEnd={palette.gradientBackgroundEnd}
      firstColor={palette.firstColor}
      secondColor={palette.secondColor}
      thirdColor={palette.thirdColor}
      fourthColor={palette.fourthColor}
      fifthColor={palette.fifthColor}
      pointerColor={palette.pointerColor}
      size={size}
      blendingValue="hard-light"
      interactive={interactive}
      containerClassName={`!h-auto min-h-screen ${className || ''}`}
    >
      {children}
    </BackgroundGradientAnimation>
  );
}

/**
 * Theme-aware text classes for hero copy. Use these on text rendered
 * inside `<ThemedHeroGradient>` so contrast tracks the active gradient.
 *
 * Override the defaults by passing your own `dark` / `light` style sets.
 */
export function useHeroTextStyles(overrides?: {
  dark?: Partial<HeroTextStyleSet>;
  light?: Partial<HeroTextStyleSet>;
  ssrDefault?: 'dark' | 'light';
}): HeroTextStyleSet {
  const { resolvedTheme } = useTheme();
  const ssrDefault = overrides?.ssrDefault ?? 'dark';
  // Same DOM-class read as ThemedHeroGradient so the very first render
  // (before any effect) returns classes matching the active theme.
  const [theme, setTheme] = useState<'dark' | 'light'>(() => readDomTheme(ssrDefault));

  useEffect(() => {
    if (resolvedTheme === 'dark' || resolvedTheme === 'light') {
      setTheme(resolvedTheme);
      return;
    }
    setTheme(readDomTheme(ssrDefault));
  }, [resolvedTheme, ssrDefault]);

  const isDark = theme === 'dark';
  const base = isDark ? DEFAULT_TEXT_STYLES.dark : DEFAULT_TEXT_STYLES.light;
  const overlay = isDark ? overrides?.dark : overrides?.light;

  return { ...base, ...overlay };
}

export const heroDefaultColors = {
  dark: DEFAULT_DARK_COLORS,
  light: DEFAULT_LIGHT_COLORS,
};

export const heroDefaultTextStyles = DEFAULT_TEXT_STYLES;
