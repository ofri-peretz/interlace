# Interlace: agent guide

Interlace is an open-source shadcn registry (ds.interlace.tools): React components on Base UI and
Tailwind CSS v4, copied into the consumer's tree. Whatever we ship runs in someone else's app, so
every change is judged there.

## The craft

The `interlace-craft` skill holds the design rules (tokens, theming, layout, type, motion,
accessibility). It is also what consumers' agents read, so a change to it ships.

## Standing rules

- Interlace stays [brand-neutral](packages/ui/__tests__/brand-neutral-lock.test.ts): a consumer
  brands through cssVars and props, never with its copy, colours or fonts in a component.
- Benchmark against the best teams (Linear, Vercel, Stripe, Apple, Anthropic, Radix, shadcn,
  Magic UI, Untitled UI) for the level of care. Take inspiration, never copy a look, asset or
  layout.
- Prefer props, variants and compound parts over asking consumers for a class. A consumer who
  needs a class to get a reasonable case has found a gap in the component.
- Motion is earned: it explains a change. Aim for AAA contrast on body text; the locks hold AA.

## Where the rules live

| Need                                                        | Read                                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| How to compose, brand and animate                           | the craft skill above                                                                    |
| The principles behind Interlace's own surfaces              | [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md), [BRAND_PHILOSOPHY.md](BRAND_PHILOSOPHY.md) |
| One area in depth (motion, layout, colour, a11y, i18n)      | [docs/philosophies/](docs/philosophies/)                                                 |
| Component API shape and naming                              | [packages/ui/CONVENTIONS.md](packages/ui/CONVENTIONS.md)                                 |
| The five layers and the CSS import order                    | [packages/ui/DESIGN_SYSTEM_LAYERS.md](packages/ui/DESIGN_SYSTEM_LAYERS.md)               |
| What a new component PR contains                            | [CONTRIBUTING.md](CONTRIBUTING.md)                                                       |
| How an AI-authored PR is verified, and the review checklist | [docs/AI_SDLC.md](docs/AI_SDLC.md)                                                       |

DESIGN_PRINCIPLES and BRAND_PHILOSOPHY describe the Interlace house brand (burnt orange, the
thread). They govern interlace.tools surfaces, not what a consumer's site must look like.

## Checks

Most design rules are lock tests in `packages/ui/__tests__/` (motion, contrast, container scale,
breakpoints, theme contract, effects). When one fails, fix the component or the token, not the
test.
