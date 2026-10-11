"use client";

import { ArrowRight, Terminal } from "lucide-react";
import {
  ThemedHeroGradient,
  useHeroTextStyles,
} from "#interlace/components/home/themed-hero-gradient";

// Plain words only: what it is, one measured number, where to go next. The
// slogan hero ("Tools that interlock") told a visitor nothing — 85% bounced
// (PostHog, 30 days to 2026-10-11). See docs/intents/landing-gateway.
export function LandingHero({ downloads }: { downloads: string | null }) {
  // Every text/control element below pulls its classes from the hook so
  // contrast tracks the active gradient. Hardcoding `text-white` would
  // disappear in light mode (the bug `apps/baseline-storybook` catches via
  // axe-core).
  const text = useHeroTextStyles();

  return (
    <ThemedHeroGradient>
      <section className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-6 py-24 text-center md:py-36">
        <h1
          className={`max-w-4xl text-4xl font-bold tracking-tight md:text-6xl ${text.headline}`}
        >
          Open-source tools for{" "}
          <span className={text.headlineGradient}>JavaScript developers</span>
        </h1>

        <p className={`max-w-2xl text-lg md:text-xl ${text.subheadline}`}>
          ESLint plugins that find bugs in AI-written code. burgee, a CLI
          framework for Node.js. Serverless Framework plugins.
        </p>

        {downloads && (
          <p className={`text-base font-semibold md:text-lg ${text.subheadlineAccent}`}>
            {downloads} npm downloads
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <a
            href="https://eslint.interlace.tools/?utm_source=interlace&utm_medium=hero"
            className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all ${text.ctaPrimary}`}
          >
            ESLint plugins
            <ArrowRight className="size-4" />
          </a>
          <a
            href="https://burgee.interlace.tools/?utm_source=interlace&utm_medium=hero"
            className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-colors ${text.ctaSecondary}`}
          >
            <Terminal className="size-4" />
            burgee CLI framework
          </a>
        </div>

        <p className={`mt-2 text-xs ${text.muted}`}>
          Free and MIT-licensed · built in the open by Ofri Peretz
        </p>
      </section>
    </ThemedHeroGradient>
  );
}
