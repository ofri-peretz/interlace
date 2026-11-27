# Intent — interlace.tools is the front door to all of Ofri's open source

**Status:** shipped · **Opened:** `2026-10-11` · **Owner:** `@ofri-peretz`

Accepted by Ofri 2026-10-11 ("lets apply the changes") and built in the same PR. The design is
[spec.md](spec.md).

## What is wanted

interlace.tools becomes the one link Ofri shares everywhere (LinkedIn, GitHub, Dev.to,
talks). A visitor who lands there should, within 10 seconds, know:

1. **What this is** — open-source JavaScript tools, in plain words.
2. **That people use it** — one real number (npm downloads across all packages).
3. **Where to go next** — one click to the product that fits them.

Plain language only. No "Tools that interlock", no "TypeScript-native developer tools",
no startup-speak. Every sentence says what a thing does.

## Why now

- LinkedIn and GitHub profiles are being rewritten to point here as the gateway.
- Measured 2026-10-11 (PostHog project 428927, last 30 days, `$host = interlace.tools`):
  **13 visitors, 15 views, 85% bounce, 9 s average session.** eslint.interlace.tools `/`
  had 136 visitors over the same window. The gateway is currently the weakest page in the
  family, not the strongest.
- The page is out of date: burgee is labelled **"Coming soon"** and links to GitHub, but
  burgee 1.0 and all 9 family packages are published on npm and burgee.interlace.tools
  is live. The ESLint card says "30 plugins"; the generated manifest says 32.

## The three front pages today (walked 2026-10-11)

| Site | Opens with | What works | What fails |
| :-- | :-- | :-- | :-- |
| interlace.tools | "Tools that interlock" (animated word) | values are short | no plain "what is this"; no number; burgee "Coming soon" |
| eslint.interlace.tools | "Enterprise-Grade Security for JavaScript · Secure your code, your style." | 32 / 486 from the manifest; install + config snippet; three CWE examples with code | slogan hero; "Two Pillars of Excellence", "Ready to Level Up?"; "Trusted by developers" heads a DEV tweet, not users |
| burgee.interlace.tools | logo + canonical pitch + "Read the floor" | the pitch is locked (`pitch-lock.test.ts`) | near-empty home: no install command, no package list, no proof; "the floor" is internal jargon |

Burgee's own research (`.sdlc/research/docs-traffic-2026-10.md`) already says discovery, not
docs, is the bottleneck: 155 views across ten sites in 30 days, Google 0.

## Constraints

- Plain language only: every sentence says what a thing does. No slogans, no "enterprise-grade".
- Numbers on the page are read from `interlace-numbers.json` or the ratchet, never hand-typed.
- The positioning rule holds: values and what we build. Benchmarks and comparisons stay on the
  product sites.
- Mobile-first: the hero and the first product card read at 375 px.

## Success criteria

The Maintain band:

- Baseline: 13 visitors / 30 d, 85% bounce, product-click rate unknown.
- Target after 30 days live: bounce < 60%, product-card click-through ≥ 30% of visitors.
- Breach → new intent.
