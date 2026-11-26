# Design — interlace.tools front door

The design for [intent.md](intent.md): the rule every product front page follows, what this page
must do, what is out of scope, and the defaults taken for the open decisions.

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
