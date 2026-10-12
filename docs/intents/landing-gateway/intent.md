# Intent: interlace.tools is the front door to all of Ofri's open source

Status: accepted by Ofri 2026-10-11 ("lets apply the changes") — built in the same PR

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

## One rule for all three front pages

Above the fold, every product front page shows, in this order:
1. What it is, in one plain sentence.
2. One measured number (from its existing source: manifest, README "Measured" table, ratchet).
3. One install command.
4. One button to the next step.

No slogans, no "enterprise-grade", no "level up". This intent changes interlace.tools; the
eslint and burgee heroes get their own intents in their own repos, held to the same rule.

## What the page must do (acceptance)

- Hero names the products in plain words and shows the total-downloads number, read from
  the ratchet / numbers manifest — never hand-typed.
- burgee appears as **Shipping**, linking to burgee.interlace.tools.
- Every product card has one action: "Go to <product> →" (its own site). Secondary: npm, GitHub.
- Product counts render from `interlace-numbers.json` (existing lock test pattern).
- Outbound product-card clicks are captured in PostHog so conversion = card clicks / visitors
  is measurable. Today it is not.
- Stays within the positioning rule: values + what we build. No benchmarks or comparisons
  on this site — those live on the product sites.
- Mobile-first: the hero and the first product card are readable at 375 px without scrolling
  past a badge pill.

## Success measure (Maintain band)

- Baseline: 13 visitors / 30 d, 85% bounce, product-click rate unknown.
- Target after 30 days live: bounce < 60%, product-card click-through ≥ 30% of visitors.
- Breach → new intent.

## Out of scope

- Traffic acquisition (LinkedIn/Dev.to posting) — separate work.
- Redesigning product sites.
- The design system (ds.interlace.tools) as a headline product — it stays listed, lower
  on the page, because it serves builders of these sites more than users of the tools.

## Open decisions for Ofri

1. Order of products on the page. Default: ESLint plugins, burgee, Serverless, Design system.
2. Whether the download number is one total or per product. Default: one total in the hero.
3. Whether the "Built by Ofri Peretz" footer becomes a short "Who builds this" block with a
   link to ofriperetz.dev. Default: yes — a person behind it converts better than a brand.
