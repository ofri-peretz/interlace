---
name: interlace-craft
description: Build or review UI with the Interlace design system in its craft style (tokens, layout, type, motion, responsiveness, accessibility, theming). Use before writing any page, section or component that uses Interlace, and when reviewing one.
license: MIT
---

# Build UI in the Interlace craft

Interlace is a shadcn registry (https://ds.interlace.tools) of React components on Base UI and
Tailwind CSS v4. Components are copied into your tree, and every one publishes its contract.
This skill is the other half: how the pieces are meant to be put together, so that a page an
agent writes looks and behaves like one a careful person made.

Use it with the three catalogue skills at
https://ds.interlace.tools/.well-known/agent-skills/index.json: find a component by what it must
do, read its contract, install it. This skill says how to compose and brand what you installed.

## The stance

Seven commitments. Every rule below follows from one of them.

| Commitment | What it means on the page |
| --- | --- |
| Content first | The server HTML holds the whole page, fully visible. Scripts and motion only add to it. |
| Tokens, not values | Every colour, size, gap, radius, duration and easing comes from a CSS variable a brand can retune. |
| One accent | Neutral surfaces; the brand colour marks the one thing that matters in a view. |
| Motion is earned | It explains a change, a direction or an arrival. It never decorates and never blocks reading. |
| Accessible by construction | Measured contrast (AA floor, AAA aim for text), a visible focus ring, keyboard paths, RTL. |
| Composition over overrides | Props, variants and compound parts cover the real cases. Reaching for a class is a signal the component missed one. |
| Brand-neutral | Interlace ships no product's name, copy, colours or scripts. A consumer's brand arrives through tokens and props. |

The bar is the best product teams (Linear, Vercel, Stripe, Apple, Anthropic, Radix, shadcn,
Magic UI, Untitled UI). They are inspiration for the level of care, never a look to copy.

## Set up

```bash
npx shadcn@latest add https://ds.interlace.tools/r/interlace-base.json   # additive baseline
npx shadcn@latest add https://ds.interlace.tools/r/theme.json            # optional: the Interlace look
npx shadcn@latest add https://ds.interlace.tools/r/button.json           # any component
```

`interlace-base` adds motion tokens, the type scale, container widths, the `xs` breakpoint, radius
steps derived from `--radius`, the colour layers and `color-scheme`. It changes nothing the host
app already styles. `theme` is optional: components work with the host app's own shadcn theme.

## Brand it with tokens

The contract is the shadcn cssVar names. A brand is a set of values for them, declared unlayered
on `:root` and `.dark` in the app's global stylesheet, after the imports:

```css
:root {
  --primary: oklch(0.45 0.16 255);          /* the one accent */
  --primary-foreground: oklch(1 0 0);
  --background: oklch(0.985 0.006 85);      /* the page */
  --foreground: oklch(0.18 0.01 85);
  --card: oklch(1 0 0);                      /* sheets lift off the page */
  --muted-foreground: oklch(0.42 0.015 85); /* still AAA on --background */
  --radius: 0.75rem;                         /* every rounded-* follows */
  --highlight: oklch(0.88 0.15 92);          /* optional second voice: one hero action */
}
.dark { /* every token again, for the dark scheme */ }

@theme {
  --font-sans: "Your Sans", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Your Serif", ui-serif, Georgia, serif;
  --font-heading: var(--font-serif);         /* the editorial switch, see below */
}
```

Rules of the contract:

- A brand sets values. It does not restyle components, add selectors inside them, or fork a file.
- Light and dark are one axis (`.dark` or `[data-scheme='dark']`); which brand is a second axis
  (`[data-theme='name']`). Every token a theme sets, it sets for both schemes.
- Motion and rhythm retune the same way: `--duration-*`, `--ease-*` and `--spacing-section-*` are
  variables too.
- Every text pair is measured, not eyeballed. The floor, which the theme contract test enforces
  for Interlace's own themes, is WCAG AA: 4.5:1 for text, 3:1 for large text, icons, control
  borders (`--input`) and the focus ring (`--ring`). The aim for body text is 7:1 (AAA), which
  the default palette reaches in both schemes.
- More contrast (below) overrides your unlayered values on purpose, so a reader who asks for it
  always gets it. To keep your accent there, set `--contrast-primary` and
  `--contrast-primary-foreground` to a pair you measured at 7:1, and check the tinted surfaces
  built from it too (`text-primary` on `bg-primary/10`).
- The full token list is at https://ds.interlace.tools/semantics-catalog, and writing a full
  theme is at https://ds.interlace.tools/theme-authoring.

## The editorial look

The calm, research-paper register (warm paper, serif headlines, quiet chrome, sources as
footnotes) is a recipe on the tokens above, not a separate kit:

| Ingredient | How |
| --- | --- |
| Paper, not screen white | `--background` a warm off-white; `--card` and `--popover` white, so a card lifts like a sheet |
| Serif headlines, sans body | `--font-heading: var(--font-serif)`. Every Typography heading, CardTitle and pattern title follows. |
| One calm accent | `--primary` only on links, the primary action and the selected state |
| Long reading | `ReadingLayout` (text column plus a table of contents rail), `Typography variant="long"`, `Prose` |
| Receipts | `Citation` on the sentence that makes a claim; `Figure` for a captioned image or chart; `ArticleCard` for the index |
| Quiet bands | `Section` with `tone="muted"` and a `divider` instead of shadows and gradients |

Interlace is packaging this recipe as a `paper` theme and an opt-in editorial voice
(`data-voice="editorial"`: serif headings, softer heading tracking, roomier sections). Once those
are in the registry, use them instead of setting the pieces by hand.

Borders and spacing carry hierarchy; shadows stay small. Illustrations are line drawings in the
foreground or accent colour, never stock imagery.

## Layout and rhythm

- Width comes from `Container` with one of four sizes: `prose` (65ch), `content` (1024px),
  `wide` (1280px), `full`. They map to `max-w-prose`, `max-w-content`, `max-w-wide`.
- A page is a stack of `Section` bands. `spacing` is `tight`, `comfortable` (default) or
  `spacious`, each a fluid token (`--spacing-section-*`, 48 to 128px) that grows on one curve from
  a phone to a laptop. `tone` is `default`, `muted`, `inset` or `brand`; `divider` and `overlap`
  handle the seams.
- Gaps come from `Stack` and `Grid` (`gap` = `xs` 8, `sm` 16, `md` 24, `lg` 40, `xl` 64,
  `2xl` 96 px). On raw elements the same six steps are `gap-2 / 4 / 6 / 10 / 16 / 24`.
- `SectionHeader` opens a band: `eyebrow`, `title`, `tagline`, `align` (`center` or `start`),
  `size` (`default` or `display`). It renders an h2; the page's one h1 belongs to the hero.

## Type

- `Typography` renders every row of the scale with one `variant`: `h1`-`h6`, `body`, `long`,
  `ui`, `ui-sm`, `caption`, `code`; `tone` is `default`, `muted`, `primary`, `destructive`; `as`
  fixes the outline without changing the look (`variant="h2" as="h3"`).
- Display end is fluid: `text-display` (44 to 64px), `text-h1` (40 to 56), `text-section`
  (28 to 40), `text-h2`, `text-h3`. Body stays fixed at 16px (17px for long reads), because text
  that resizes while you read it is harder to read.
- Measure: 65 to 75 characters for any paragraph. Line height 1.6 to 1.7 for body.
- Hierarchy is size, then weight (400, 500, 600, 700). Headlines use `text-balance`.
- Copy is plain and specific: what it does, in the reader's words. No hype, no exclamation marks,
  no emoji as decoration, no fake urgency. A number beats an adjective, and a source beats both.

## Responsiveness

- Mobile first. Base classes describe the narrowest screen; breakpoints add room, never take it
  away. The ladder is Tailwind's (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536) plus
  `xs` at 480, all in rem so zoom moves them.
- Collections size to their container, not the viewport. FeatureGrid, StatGroup,
  ArticleListGrid, PricingTable, Testimonial, RelatedPosts and Timeline query their own width
  (`@container`), so the same grid works in a sidebar, a card or a full page. A new collection
  does the same: `@container` on the root, `@md:` and `@4xl:` on the tracks.
- Page chrome (navigation, Container padding, Section rhythm) stays on the viewport ladder.
- Each component declares `MIN_VIEWPORT` (320, 480 or 768). Below it the layout should swap to
  a narrower alternative instead of squeezing the component.
- Touch targets are at least 24 by 24 px (44 for primary actions on phones). Nothing scrolls
  sideways at 320px.
- Check every page at 320, 390, 768, 1024, 1440 and 1920 wide, in both schemes.

## Motion

Motion explains what changed and where it went. Three questions before adding any: does it show
a change of state; is the page harder to understand without it; does it leave the layout still?
If any answer is no, leave it out.

| Token | Value | Use |
| --- | --- | --- |
| `--duration-fast` | 100ms | Hover, focus, press |
| `--duration-base` | 150ms | Small state changes, overlay enter |
| `--duration-medium` | 250ms | Sheets, larger surfaces |
| `--duration-slow` | 400ms | Continuity between views |
| `--ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | Anything appearing (`ease-enter`) |
| `--ease-exit` | `cubic-bezier(0.5, 0, 0.75, 0)` | Anything leaving (`ease-exit`) |
| `--ease-move` | `cubic-bezier(0.65, 0, 0.35, 1)` | Moving between two resting places (`ease-move`) |

Written as `duration-(--duration-fast) ease-enter`, so a brand can retune all of it on `:root`.

The budget:

- Entry animations take 200ms or less and have no delay; first paint belongs to content.
  A stagger spends 150ms in total across all items, not per item.
- Popups (dialog, popover, menu, tooltip) enter from opacity 0 with a slight scale, driven by
  Base UI's `data-starting-style` and `data-ending-style`, so exit animates as well as entry.
- Animate `transform`, `opacity` and `filter` only. Height to `auto` is done with
  `grid-template-rows: 0fr` to `1fr`. Layout shift stays at zero: reserve space for anything that
  loads (`aspect-*`, `min-h-*`, the component's own `loading` state).
- Under `prefers-reduced-motion: reduce` the reader sees the end state at once. CSS motion goes
  behind `motion-safe:`; JS motion reads `useReducedMotion()` and skips the animation, not the
  content. A drawn line or a counted number lands at its final state rather than vanishing.
- Off the table: parallax tied to scroll, auto-advancing carousels, cursor-following glows,
  infinite loops on content, and adding another animation library.

The effects tier is a set of finished, tested motion pieces. Each one keeps its content in the
server HTML, hides decoration from assistive tech, and does nothing under reduced motion. Pick by
intent, and spend them: at most one ambient backdrop and one headline effect per view.

| Intent | Reach for |
| --- | --- |
| A block that should be noticed arriving | `Reveal` (`effect` = `fade`, `rise`, `blur`, `scale`) |
| One headline line with a moment of attention | `SplitText` (`by` = `word` or `letter`) |
| A list whose order matters | `StaggerList` |
| One key number | `CountUp` |
| One word that changes in a headline | `RotatingText` |
| The one action or card a page most wants pressed | `Sheen`, `EdgeGlow`, `SheenText` |
| A row of logos or quotes | `Scroller` (has a pause control) |
| A quiet backdrop behind a hero or band | `GridField`, `GradientMesh`, `LightBeam`, `SkyBackdrop`, `Starfield` |
| A question that turns into its answer | `FlipCard`, `GuessReveal` |

Interlace's own brand gestures (`ThreadLines`, `WeaveTexture`, `HeroStrand`, `InterlaceWeave`,
`DecodeText`, `ThreadMark`) express the Interlace identity. On another brand's site, choose from
the neutral rows above.

## Accessibility

- WCAG 2.2 AA is the floor and AAA the aim for text (see the contrast rules above). Colour is never the only signal; pair it with text, an icon or shape.
- Every interactive element shows the focus ring (2px `--ring`, 2px offset). For a custom
  clickable surface, wrap it in `FocusRing`. The ring sits outside the element and never covers
  its text; give scrolling or clipping containers room (`p-1 -m-1`) so it is not cut off.
- More contrast is an AAA reading mode on every theme. It turns on from the system preference
  (`prefers-contrast: more`) or from `data-contrast="more"` on `<html>`; `data-contrast="normal"`
  opts a page out of the system path. The page-set mode also draws focus as a 3px outline.
- `data-density="comfortable"` on `<html>` or a region gives touch-sized controls (44px default,
  `--spacing-control`) and 44px hit areas for small targets.
- Keyboard behaviour comes from Base UI. Composites (menus, tabs, comboboxes, dialogs) are built
  on the existing primitives, never on hand-rolled focus traps or roving tabindex.
- Icons are lucide-react, outlined, sized to the text (`size-4`, `size-5`, `size-6`), and always
  paired with a label or `aria-label`.
- Landmarks and a `SkipLink` on every page; one h1; headings in order.
- RTL works because direction is logical: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`,
  `text-start`, `text-end`, and `rtl:` only for mirrored icons. Dates, numbers and plurals go
  through the Intl APIs. Test every new layout with `dir="rtl"` and a long translation.

## Components: compose, do not override

- Reach for a prop first: `variant`, `size`, `tone`, `align`, `loading`, `disabled`. Button
  variants are `default`, `highlight`, `secondary`, `outline`, `ghost`, `link`, `destructive`;
  sizes are `xs`, `sm`, `default`, `lg` and the `icon` set.
- Then composition: compound parts (`Card`, `CardHeader`, `CardTitle`, `CardContent`) and the
  Base UI `render` prop to change the element (`<Button render={<Link href="/start" />}>`).
- `className` is accepted for shadcn interop, but needing it means the component missed a case.
  In Interlace itself, add the prop. In an app, keep it to layout placement, and raise the gap.
- Absence is a state, not a null check: use the component's state union and its `loading`
  skeleton, and give every empty, loading and error case real words.
- Every part carries `data-slot`, so tests and analytics select by slot, not by class.
- A flow (phases an app adopts whole: a live room, a booking, a sign-in) is one namespace:
  `LiveRoom.Lobby`, `LiveRoom.Countdown`. Keep its state in your app, pass it in, and handle
  every event it sends; its file's `## Flow` map lists each phase and the part that shows it.
- Server components by default; `"use client"` only where there is state or a browser API.

## Do and don't

```tsx
// Do: tokens, primitives, one accent, a source behind the claim
<Section spacing="comfortable" tone="muted" divider="top">
  <SectionHeader eyebrow="Method" title="How we check a claim" align="start" />
  <Grid cols={3} gap="md">…</Grid>
  <Typography variant="long">
    <Citation sources={sources}>Most readers check one source or none.</Citation>
  </Typography>
</Section>

// Don't: raw values, ad-hoc widths, a second accent, a viewport-keyed grid
<div className="mx-auto max-w-5xl px-[18px] py-20 bg-[#f5f0e8]">
  <h2 className="text-[34px] font-black text-purple-600">How we check a claim</h2>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-[22px]">…</div>
</div>
```

```tsx
// Do: motion that respects the reader and leaves the content in the HTML
<Reveal effect="rise"><Figure … /></Reveal>
<a href="/method" className="transition-colors duration-(--duration-fast) ease-enter hover:text-primary">Method</a>

// Don't: long entry fades, per-item delays, animation that ignores the OS setting
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: i * 0.2 }} />
```

## Review checklist

- [ ] No raw colour, pixel size or duration in the diff; every value is a token or a scale step.
- [ ] One accent per view; status colours only for status.
- [ ] Width from `Container`, bands from `Section`, gaps from the six steps.
- [ ] Renders at 320px without sideways scroll; collections keyed to their container.
- [ ] Works in light, dark and `dir="rtl"`; contrast measured, not assumed.
- [ ] Keyboard only: every action reachable, focus visible, Escape closes what opened.
- [ ] Reduced motion: same content, no animation; entries 200ms or less; layout shift zero.
- [ ] No product name, copy or colour inside an Interlace component.
- [ ] Copy is plain, specific and sourced.

## Read more

- Principles and per-area charters:
  https://github.com/ofri-peretz/interlace/blob/main/DESIGN_PRINCIPLES.md and
  https://github.com/ofri-peretz/interlace/tree/main/docs/philosophies
- What the CSS baseline installs, layer by layer: https://ds.interlace.tools/css-contract
- Every component, with its contract and live states: https://ds.interlace.tools/llms.txt
