import { ArrowRight, Terminal } from "lucide-react";

import numbers from "@/data/interlace-numbers.json";

// Plain words only: what it is, one measured number, where to go next. The
// slogan hero ("Tools that interlock") told a visitor nothing — 85% bounced
// (PostHog, 30 days to 2026-10-11). See docs/intents/landing-gateway.
//
// Static on purpose: the old full-screen animated gradient pushed every
// product below the fold, animated outside the brand's two verbs (draw /
// decode, BRAND_PHILOSOPHY §2) and used the green status hue as decoration
// (§3). Theme tokens carry contrast in both modes, so no client theme hook.
export function LandingHero({ downloads }: { downloads: string | null }) {
  const proof = [
    downloads && `${downloads} npm downloads`,
    `${numbers.plugins.total} ESLint plugins`,
    `${numbers.rules.total} rules`,
    "MIT licensed",
  ].filter(Boolean);

  return (
    <section className="relative overflow-hidden border-b border-fd-border px-6 pt-16 pb-14 md:pt-24 md:pb-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-radial-[at_50%_0%] from-fd-primary/15 to-transparent to-70%"
      />
      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-fd-muted-foreground">
          Open source · by Ofri Peretz
        </p>

        <h1 className="text-4xl font-bold tracking-tight text-balance md:text-6xl">
          Ship JavaScript with{" "}
          <span className="text-fd-primary">fewer bugs and less busywork</span>
        </h1>

        <p className="max-w-2xl text-lg text-pretty text-fd-muted-foreground md:text-xl">
          ESLint plugins that catch security bugs, including the ones AI
          assistants write. burgee, a framework for building Node.js CLIs.
          Plugins that keep Serverless Framework projects clean on AWS.
        </p>

        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-sm text-fd-foreground">
          {proof.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://eslint.interlace.tools/?utm_source=interlace&utm_medium=hero"
            className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-6 py-3 text-sm font-semibold text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
          >
            Explore the ESLint plugins
            <ArrowRight className="size-4" />
          </a>
          <a
            href="https://burgee.interlace.tools/?utm_source=interlace&utm_medium=hero"
            className="inline-flex items-center gap-2 rounded-lg border border-fd-border bg-fd-card px-6 py-3 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
          >
            <Terminal className="size-4" />
            Explore burgee
          </a>
        </div>
      </div>
    </section>
  );
}
