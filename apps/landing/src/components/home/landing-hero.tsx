"use client";

import Link from "next/link";
import { ArrowRight, Code2, Sparkles } from "lucide-react";
import {
  ThemedHeroGradient,
  useHeroTextStyles,
} from "#interlace/components/home/themed-hero-gradient";
import { FlipWords } from "#interlace/components/ui/flip-words";

const heroWords = ["interlock", "measure", "compose", "just work"];

export function LandingHero() {
  // Every text/control element below pulls its classes from the hook so
  // contrast tracks the active gradient. Hardcoding `text-white` would
  // disappear in light mode (the bug `apps/baseline-storybook` catches via
  // axe-core).
  const text = useHeroTextStyles();

  return (
    <ThemedHeroGradient>
      <section className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-6 py-24 text-center md:py-36">
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm ${text.badgeContainer} ${text.badge}`}
        >
          <Sparkles className="size-3.5" />
          <span>A family of TypeScript-native developer tools</span>
        </div>

        <h1
          className={`max-w-4xl text-4xl font-bold tracking-tight md:text-6xl ${text.headline}`}
        >
          Tools that
          <br />
          <FlipWords words={heroWords} className={text.headlineGradient} />
        </h1>

        <p className={`max-w-2xl text-lg md:text-xl ${text.subheadline}`}>
          ESLint plugins. Serverless plugins. Every claim measured. Every
          dependency justified.{" "}
          <span className={text.subheadlineAccent}>
            Same baseline everywhere.
          </span>
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="#products"
            className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all ${text.ctaPrimary}`}
          >
            Browse the products
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/docs/concepts/what-is-interlace"
            className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-colors ${text.ctaSecondary}`}
          >
            <Code2 className="size-4" />
            What is Interlace?
          </Link>
        </div>

        <p className={`mt-2 text-xs ${text.muted}`}>
          MIT-licensed · independent · built in the open
        </p>
      </section>
    </ThemedHeroGradient>
  );
}
