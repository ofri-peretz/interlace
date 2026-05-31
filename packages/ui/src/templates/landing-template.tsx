/**
 * @interlace/ui — LandingTemplate
 *
 * Marketing landing page surface. Composes Topbar + Hero +
 * (optional) FeatureGrid + (optional) TestimonialGrid + (optional)
 * PricingTable + (optional) FAQ + CTASection + Footer — each in its own
 * SectionBoundary so the page streams section-by-section.
 *
 * Every section is optional via props; pass only what you need. The
 * Topbar + Footer are required (every landing page has them).
 *
 * ## MIN_VIEWPORT — 320
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { SectionBoundary } from '../primitives/section-boundary.js';
import { Topbar } from '../patterns/topbar.js';
import { Footer } from '../patterns/footer.js';

export const MIN_VIEWPORT = 320 as const;

interface LandingTemplateProps extends React.ComponentProps<'div'> {
  /** Topbar props. */
  topbar: React.ComponentProps<typeof Topbar>;
  /** Hero section (consumer-supplied — pass the configured Hero pattern). */
  hero: React.ReactNode;
  /** Optional features section. */
  features?: React.ReactNode;
  /** Optional testimonials section. */
  testimonials?: React.ReactNode;
  /** Optional pricing section. */
  pricing?: React.ReactNode;
  /** Optional FAQ section. */
  faq?: React.ReactNode;
  /** Optional CTA section before the footer. */
  cta?: React.ReactNode;
  /** Footer props. */
  footer: React.ComponentProps<typeof Footer>;
  /** Extra arbitrary sections — rendered between hero and features. */
  children?: React.ReactNode;
}

function LandingTemplate({
  topbar,
  hero,
  features,
  testimonials,
  pricing,
  faq,
  cta,
  footer,
  children,
  className,
  ...props
}: LandingTemplateProps) {
  return (
    <div
      data-slot="landing-template"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('bg-background text-foreground', className)}
      {...props}
    >
      <Topbar {...topbar} />

      <SectionBoundary name="landing-hero" skeletonVariant="page-header">
        {hero}
      </SectionBoundary>

      {children}

      {features ? (
        <SectionBoundary
          name="landing-features"
          skeletonVariant="article-card"
        >
          {features}
        </SectionBoundary>
      ) : null}

      {testimonials ? (
        <SectionBoundary
          name="landing-testimonials"
          skeletonVariant="article-card"
        >
          {testimonials}
        </SectionBoundary>
      ) : null}

      {pricing ? (
        <SectionBoundary name="landing-pricing" skeletonVariant="card">
          {pricing}
        </SectionBoundary>
      ) : null}

      {faq ? (
        <SectionBoundary name="landing-faq" skeletonVariant="card">
          {faq}
        </SectionBoundary>
      ) : null}

      {cta ? (
        <SectionBoundary name="landing-cta" skeletonVariant="card">
          {cta}
        </SectionBoundary>
      ) : null}

      <Footer {...footer} />
    </div>
  );
}
LandingTemplate.displayName = 'LandingTemplate';

export { LandingTemplate };
export type { LandingTemplateProps };
