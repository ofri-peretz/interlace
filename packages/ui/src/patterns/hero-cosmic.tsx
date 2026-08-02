'use client';

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Container } from '../primitives/container.js';
import {
  StarsBackground,
  ShootingStars,
  Meteors,
} from '../aceternity/stars-background.js';

/** Smallest viewport this pattern is laid out for. */
export const MIN_VIEWPORT = 320 as const;

/**
 * Brand tokens the decorative layer paints with, in `--custom-property`
 * form. See `styles/interlace-theme.css` (`@layer interlace.brand`).
 *
 * These are read at runtime instead of passed as `var(--hero-star)`
 * because the vendored effect components concatenate an alpha suffix onto
 * the value (`${meteorColor}80`) before handing it to `<canvas>` /
 * `linear-gradient()`. A `var()` reference can't carry that suffix, and
 * canvas ignores the cascade entirely — so the component resolves the
 * computed value once and passes concrete colours down. Keeping the hex
 * exclusively in CSS is what lets a consumer fork the hero's palette
 * without patching this file (R19).
 */
const EFFECT_TOKENS = ['--hero-star', '--hero-trail', '--hero-meteor'] as const;

type EffectColors = { star: string; trail: string; meteor: string };

/**
 * Resolve the three effect tokens against the mounted DOM.
 *
 * Returns `null` until resolution completes. Callers render no decorative
 * layer while it is null — that is deliberate rather than a flash-guard
 * hack: the effects are `<canvas>` + animation that cannot paint during
 * SSR anyway, so gating them on the tokens costs nothing visually and
 * removes any need for a hard-coded fallback colour in this file.
 */
function useEffectColors(): EffectColors | null {
  const [colors, setColors] = React.useState<EffectColors | null>(null);

  React.useEffect(() => {
    const computed = getComputedStyle(document.documentElement);
    const [star, trail, meteor] = EFFECT_TOKENS.map((token) =>
      computed.getPropertyValue(token).trim(),
    );
    // A consumer that imported the components but not the stylesheet gets
    // empty strings. Skip the decorative layer rather than painting an
    // arbitrary colour on top of their brand.
    if (star && trail && meteor) setColors({ star, trail, meteor });
  }, []);

  return colors;
}

export interface HeroCosmicCTA {
  label: React.ReactNode;
  href: string;
  /** Render any element as the button (e.g. `<Link>`, `<ShimmerButton>`). Falls back to a plain anchor. */
  render?: React.ReactElement<Record<string, unknown>>;
}

/** Tuning knobs for the decorative starfield layer. */
export interface HeroCosmicEffects {
  /** Stars per square pixel. @default 0.0002 */
  starDensity?: number;
  /** Share of stars that twinkle, 0–1. @default 0.8 */
  twinkleProbability?: number;
  /** Slowest twinkle cycle, seconds. @default 0.4 */
  minTwinkleSpeed?: number;
  /** Fastest twinkle cycle, seconds. @default 1.2 */
  maxTwinkleSpeed?: number;
  /** Slowest shooting-star travel speed. @default 10 */
  shootingMinSpeed?: number;
  /** Fastest shooting-star travel speed. @default 35 */
  shootingMaxSpeed?: number;
  /** Shortest gap between shooting stars, ms. @default 600 */
  shootingMinDelay?: number;
  /** Longest gap between shooting stars, ms. @default 2500 */
  shootingMaxDelay?: number;
  /** Meteors on screen at once. @default 3 */
  meteorCount?: number;
  /** Shortest meteor traversal, seconds. @default 12 */
  meteorMinDuration?: number;
  /** Longest meteor traversal, seconds. @default 30 */
  meteorMaxDuration?: number;
}

export interface HeroCosmicProps
  extends Omit<React.ComponentProps<'div'>, 'children' | 'title'> {
  /** Eyebrow content rendered above the headline (e.g. a trust chip). */
  eyebrow?: React.ReactNode;
  /** Main headline. Pass JSX (`<>foo<br/>bar</>`) for multi-line headlines with gradient spans. */
  headline: React.ReactNode;
  /** Sub-headline / tagline. */
  tagline?: React.ReactNode;
  /** Primary CTA. */
  primaryCta?: HeroCosmicCTA;
  /** Secondary CTA. */
  secondaryCta?: HeroCosmicCTA;
  /** Additional content rendered below CTAs (e.g. trust badges). */
  footer?: React.ReactNode;
  /**
   * Tuning knobs for the decorative starfield. Colours are NOT part of this
   * bag — they come from the `--hero-*` brand tokens so the effect can't
   * drift from the palette. @default {}
   */
  effects?: HeroCosmicEffects;
  /**
   * Stable selector hook for E2E tests. Sub-parts derive from it
   * (`{value}-headline`, `{value}-effects`). Required — no default (R5).
   */
  'data-testid': string;
}

function renderCta(cta: HeroCosmicCTA | undefined) {
  if (!cta) return null;
  if (cta.render) {
    return React.cloneElement(cta.render, { href: cta.href }, cta.label);
  }
  return (
    <a
      href={cta.href}
      data-slot="hero-cosmic-cta"
      className="inline-flex items-center gap-2 rounded-lg border-2 border-hero-foreground/20 bg-hero-foreground/10 px-md py-sm font-semibold text-hero-foreground backdrop-blur-sm transition-all hover:border-hero-foreground/30 hover:bg-hero-foreground/20"
    >
      {cta.label}
    </a>
  );
}

const EFFECT_DEFAULTS: Required<HeroCosmicEffects> = {
  starDensity: 0.0002,
  twinkleProbability: 0.8,
  minTwinkleSpeed: 0.4,
  maxTwinkleSpeed: 1.2,
  shootingMinSpeed: 10,
  shootingMaxSpeed: 35,
  shootingMinDelay: 600,
  shootingMaxDelay: 2500,
  meteorCount: 3,
  meteorMinDuration: 12,
  meteorMaxDuration: 30,
};

/**
 * Cosmic landing-hero preset: starfield + shooting stars + meteors over a
 * deep gradient. Drop-in replacement for a hand-rolled hero — pass
 * headline / tagline / CTAs and you're done.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                     | Where in this file                                     |
 * | ---- | --------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el + JSDoc   | `Omit<React.ComponentProps<'div'>, 'children'\|'title'>` |
 * | R5   | testid required, no default | `'data-testid': string` + derived part ids             |
 * | R6   | data-slot on every part     | `hero-cosmic` / `-effects` / `-headline` / `-cta` / …  |
 * | R7   | className + rest + ref      | `cn(...)`, `{...props}`, `ref` on the root             |
 * | R19  | Tokens only                 | effect colours resolve from `--hero-*` (no hex here)   |
 * | R21  | Layout primitive            | `<Container size="content">`, not open-coded `mx-auto` |
 * | R22  | Mobile-first ladder         | `py-lg md:py-xl lg:py-2xl`, `text-4xl` → `lg:text-7xl` |
 * | R23  | CLS=0                       | effects are `absolute` + `aria-hidden`; copy never moves |
 * | R25  | Client component            | `'use client'` — canvas + token resolution need the DOM  |
 */
export const HeroCosmic = React.forwardRef<HTMLDivElement, HeroCosmicProps>(
  function HeroCosmic(
    {
      eyebrow,
      headline,
      tagline,
      primaryCta,
      secondaryCta,
      footer,
      className,
      effects,
      'data-testid': testId,
      ...props
    },
    ref,
  ) {
    const e = { ...EFFECT_DEFAULTS, ...effects };
    const colors = useEffectColors();

    return (
      <div
        ref={ref}
        data-slot="hero-cosmic"
        data-min-viewport={String(MIN_VIEWPORT)}
        data-testid={testId}
        className={cn('relative', className)}
        // Dynamic-only inline style (R18 exception): `contain` and
        // `clip-path: inset(0)` have no Tailwind utility, and both are
        // load-bearing — they stop the absolutely-positioned canvas layers
        // from painting outside the hero and forcing a page-wide repaint.
        style={{ contain: 'paint', clipPath: 'inset(0)' }}
        {...props}
      >
        {/* The hero owns its surface in BOTH colour schemes — see the
            `--hero-*` token block in interlace-theme.css for why these
            don't invert. `text-hero-foreground` here is what every nested
            slot inherits, so the copy stays 16.4:1 in light mode too. */}
        <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/20 via-hero-surface to-hero-surface-deep text-hero-foreground">
          {colors ? (
            <div
              aria-hidden
              data-slot="hero-cosmic-effects"
              data-testid={`${testId}-effects`}
              className="pointer-events-none absolute inset-0"
            >
              <StarsBackground
                starDensity={e.starDensity}
                allStarsTwinkle
                twinkleProbability={e.twinkleProbability}
                minTwinkleSpeed={e.minTwinkleSpeed}
                maxTwinkleSpeed={e.maxTwinkleSpeed}
              />
              <ShootingStars
                minSpeed={e.shootingMinSpeed}
                maxSpeed={e.shootingMaxSpeed}
                minDelay={e.shootingMinDelay}
                maxDelay={e.shootingMaxDelay}
                starColor={colors.star}
                trailColor={colors.trail}
                starWidth={10}
                starHeight={1}
              />
              <Meteors
                number={e.meteorCount}
                meteorColor={colors.meteor}
                minDuration={e.meteorMinDuration}
                maxDuration={e.meteorMaxDuration}
              />
            </div>
          ) : null}

          <Container
            size="content"
            data-slot="hero-cosmic-body"
            className="relative z-10 py-lg text-center md:py-xl lg:py-2xl"
          >
            {eyebrow ? (
              <div
                data-slot="hero-cosmic-eyebrow"
                className="mb-md inline-flex"
              >
                {eyebrow}
              </div>
            ) : null}

            <h1
              data-slot="hero-cosmic-headline"
              data-testid={`${testId}-headline`}
              className="mb-sm text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
            >
              {headline}
            </h1>

            {tagline ? (
              <p
                data-slot="hero-cosmic-tagline"
                className="mx-auto mb-xl max-w-prose text-base leading-relaxed text-hero-foreground/90 drop-shadow sm:text-lg md:text-xl"
              >
                {tagline}
              </p>
            ) : null}

            {(primaryCta || secondaryCta) && (
              <div
                data-slot="hero-cosmic-actions"
                className="flex flex-col items-center justify-center gap-sm sm:flex-row"
              >
                {renderCta(primaryCta)}
                {renderCta(secondaryCta)}
              </div>
            )}

            {footer ? (
              <div data-slot="hero-cosmic-footer" className="mt-md">
                {footer}
              </div>
            ) : null}
          </Container>
        </div>
      </div>
    );
  },
);
