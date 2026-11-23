'use client';

/**
 * @interlace/ui — HeroCosmic
 *
 * The cosmic landing hero: a full-height gradient surface carrying a twinkling
 * starfield, shooting stars and meteors behind an eyebrow / headline / tagline
 * / two-CTA column. A preset, not a kit — pass copy and CTAs and the decorative
 * layer is already wired.
 *
 * ## Anatomy
 *
 *   HeroCosmic                       (div — data-slot="hero-cosmic", min-viewport 320)
 *     └─ div                         (min-h-screen gradient, text-hero-foreground)
 *         ├─ div aria-hidden         (data-slot="hero-cosmic-effects")
 *         │   └─ Starfield           (one canvas: stars, shooting stars, meteors)
 *         └─ Container size=content  (data-slot="hero-cosmic-body")
 *             ├─ eyebrow / h1 / tagline
 *             ├─ actions             (primaryCta + secondaryCta)
 *             └─ footer
 *
 * ## Colours
 *
 * The sky paints with the `--hero-star` and `--hero-meteor` brand tokens.
 * `Starfield` resolves them through the cascade itself, so a theme or a
 * forked palette changes the stars with no prop here.
 *
 * ## Motion
 *
 * This file contains no `useReducedMotion` call: `Starfield` reads the
 * preference itself. Under `prefers-reduced-motion: reduce` it paints the
 * stars once, with no twinkle, shooting stars or meteors, and requests no
 * animation frame.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The copy column is a `<Container size="content">` on a mobile-first ladder
 * (`py-10 md:py-16 lg:py-24`, `text-4xl` → `lg:text-7xl`) and the CTAs stack
 * vertically below `sm`, so the hero reads on the narrowest phone.
 *
 * | Rule | Concept                     | Where in this file                                     |
 * | ---- | --------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el           | `Omit<React.ComponentProps<'div'>, 'children'\|'title'>` |
 * | R5   | testid required, no default | `'data-testid': string` + derived part ids             |
 * | R6   | data-slot on every part     | `hero-cosmic` / `-effects` / `-headline` / `-cta` / …  |
 * | R7   | className + rest + ref      | `cn(...)`, `{...props}`, `ref` on the root             |
 * | R10  | Composition seam            | `HeroCosmicCTA.render` clones any element as the button |
 * | R19  | Tokens only                 | Starfield paints `--hero-star` / `--hero-meteor`        |
 * | R21  | Layout primitive            | `<Container size="content">`, not open-coded `mx-auto` |
 * | R23  | CLS=0                       | effects are `absolute` + `aria-hidden`; copy never moves |
 * | R25  | Client component            | Starfield's canvas needs the DOM                       |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Container } from '../primitives/container.js';
import { Starfield } from '../effects/starfield.js';

/** Smallest viewport this pattern is laid out for. */
export const MIN_VIEWPORT = 320 as const;

export interface HeroCosmicCTA {
  label: React.ReactNode;
  href: string;
  /** Render any element as the button (e.g. a router `<Link>`). Falls back to a plain anchor. */
  render?: React.ReactElement<Record<string, unknown>>;
}

/** Tuning knobs for the decorative starfield layer. */
export interface HeroCosmicEffects {
  /** Stars per square pixel. @default 0.0002 */
  starDensity?: number;
  /** Share of stars that twinkle, 0 to 1. @default 0.8 */
  twinkleProbability?: number;
  /** Seconds between shooting stars (shortest, longest), or `false`. @default [2, 6] */
  shootingStars?: readonly [number, number] | false;
  /** Meteors in the sky at once. @default 3 */
  meteorCount?: number;
  /** Seconds a meteor takes to cross (shortest, longest). @default [12, 30] */
  meteorDuration?: readonly [number, number];
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
      className="inline-flex items-center gap-2 rounded-xl border-2 border-hero-foreground/20 bg-hero-foreground/10 px-6 py-4 font-semibold text-hero-foreground backdrop-blur-sm transition-[background-color,border-color] duration-(--duration-fast) hover:border-hero-foreground/30 hover:bg-hero-foreground/20"
    >
      {cta.label}
    </a>
  );
}

const EFFECT_DEFAULTS: Required<HeroCosmicEffects> = {
  starDensity: 0.0002,
  twinkleProbability: 0.8,
  shootingStars: [2, 6],
  meteorCount: 3,
  meteorDuration: [12, 30],
};

/**
 * Cosmic landing-hero preset — see the file header for the effect layer, the
 * token-resolution gate, and the reduced-motion behaviour.
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
            `--hero-*` token block in brand/interlace.css for why these
            don't invert. `text-hero-foreground` here is what every nested
            slot inherits, so the copy stays 16.4:1 in light mode too. */}
        <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/20 via-hero-surface to-hero-surface-deep text-hero-foreground">
          <div
            aria-hidden
            data-slot="hero-cosmic-effects"
            data-testid={`${testId}-effects`}
            className="pointer-events-none absolute inset-0"
          >
            <Starfield
              density={e.starDensity}
              twinkle={e.twinkleProbability}
              shootingStars={e.shootingStars}
              meteors={e.meteorCount}
              meteorDuration={e.meteorDuration}
              starColor="var(--hero-star)"
              streakColor="var(--hero-meteor)"
            />
          </div>

          <Container
            size="content"
            data-slot="hero-cosmic-body"
            className="relative z-10 py-10 text-center md:py-16 lg:py-24"
          >
            {eyebrow ? (
              <div
                data-slot="hero-cosmic-eyebrow"
                className="mb-6 inline-flex"
              >
                {eyebrow}
              </div>
            ) : null}

            <h1
              data-slot="hero-cosmic-headline"
              data-testid={`${testId}-headline`}
              className="mb-4 font-heading text-4xl font-extrabold tracking-tight xs:text-5xl md:text-6xl lg:text-7xl"
            >
              {headline}
            </h1>

            {tagline ? (
              <p
                data-slot="hero-cosmic-tagline"
                className="mx-auto mb-16 max-w-prose text-base leading-relaxed text-hero-foreground/90 drop-shadow xs:text-lg md:text-xl"
              >
                {tagline}
              </p>
            ) : null}

            {(primaryCta || secondaryCta) && (
              <div
                data-slot="hero-cosmic-actions"
                className="flex flex-col items-center justify-center gap-4 xs:flex-row"
              >
                {renderCta(primaryCta)}
                {renderCta(secondaryCta)}
              </div>
            )}

            {footer ? (
              <div data-slot="hero-cosmic-footer" className="mt-6">
                {footer}
              </div>
            ) : null}
          </Container>
        </div>
      </div>
    );
  },
);
