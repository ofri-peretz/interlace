# Interlace DS — Breakpoint Philosophy

The Interlace DS ships a **4-tier breakpoint ladder** codified in
`packages/ui/styles/foundation.css` (Tailwind v4 `@theme { --breakpoint-* }`).
This doc explains the why, the inspiration, and the rules.

## The ladder

```css
--breakpoint-sm: 30rem;   /*  480 px — handheld */
--breakpoint-md: 48rem;   /*  768 px — tablet / large phone */
--breakpoint-lg: 64rem;   /* 1024 px — laptop */
--breakpoint-xl: 80rem;   /* 1280 px — desktop */
```

Generates Tailwind variants `sm:` / `md:` / `lg:` / `xl:`. **No `2xl:`** —
the DS doesn't support sections wider than 1280px (`Container size="wide"`)
so a `2xl:` variant has no DS meaning.

## Why these numbers

| Tier | Width | Reason |
|---|---|---|
| `(default)` | <480px | Mobile-first floor. Every primitive ships down to **320 CSS px** via the `MIN_VIEWPORT` contract. |
| `sm` | 480px | Larger phones (iPhone Pro Max, Android L), small handhelds. Matches our `MIN_VIEWPORT=480` primitive floor (Breadcrumb, PrevNextPost, DashboardTemplate). |
| `md` | 768px | iPad portrait, foldable phones unfolded, small laptops. Matches `MIN_VIEWPORT=768` (HoverCard — desktop-only by design). |
| `lg` | 1024px | Standard laptops, iPad landscape. Where sidebars + multi-column grids unlock. |
| `xl` | 1280px | Desktop. The maximum content width the DS supports (`Container size="wide"`). |

## Why **rem-based**, not px

Accessibility. A `px`-based breakpoint ignores the user's font-size
preference: a user who bumps their browser font from 16px → 20px (a 25%
larger root font, a legitimate WCAG SC 1.4.4 accommodation) gets nothing
back — layouts still snap at the same pixel widths.

A `rem`-based breakpoint scales WITH the user's font: at 20px root,
`--breakpoint-sm: 30rem` is now 600 CSS px, not 480. The layout adapts
to the user's preference automatically.

Adobe Spectrum, Shopify Polaris, and Adobe React Aria all use `rem`
breakpoints. Tailwind v4's defaults are `rem`, too — we just narrow the
ladder.

## Why **no `2xl:`**

The DS caps section width at `--container-wide: 80rem` (1280px). A
`2xl:` variant would only fire at `≥1536px`, which is `> 1280px = 100%
of the widest container`. Nothing in the DS layout grows past that
point — extra screen real estate is leftover whitespace by design.

If a consumer needs `≥1536px` styling for their own bespoke layout
(e.g. a `bg-` change), they can author their own `@custom-variant` in
their global.css. The DS doesn't bless it.

## How this interacts with `MIN_VIEWPORT`

Every primitive declares its `MIN_VIEWPORT` (320 / 480 / 768) — the
narrowest viewport at which it remains usable. The breakpoint ladder
is the **layout** lever (mobile-first responsive variants); `MIN_VIEWPORT`
is the **regression** lever (dev-mode dashed outline when a primitive
is mounted in a too-narrow container).

| `MIN_VIEWPORT` | Means | Matched Tailwind variant |
|---|---|---|
| `320` | "Works on every phone, including iPhone SE" | (default, mobile-first) |
| `480` | "Below this, consider a different surface" | `sm:` floor |
| `768` | "Desktop / tablet only" | `md:` floor |

A consumer rendering a `MIN_VIEWPORT=480` primitive inside a 350px
container in dev gets the dashed `data-interlace-dev` outline; the
`sm:` Tailwind variant is the layout API that lets them swap to a
narrower-friendly alternative below 480px.

## Inspiration

| DS | Breakpoints (px) | Tiers | Tracks `rem`? |
|---|---|---|---|
| Tailwind v4 (defaults) | 640 / 768 / 1024 / 1280 / 1536 | 5 | ✓ |
| **Vercel Geist** | 600 / 960 / 1280 / 1600 | 4 | ✗ |
| **Linear** | 768 / 1024 / 1280 | 3 | ✓ |
| **Adobe Spectrum** | 304 / 768 / 1280 / 1768 | 4 | ✓ |
| **Shopify Polaris** | 490 / 768 / 1040 / 1620 | 4 | ✓ |
| **Stripe Sail** | 768 / 1024 / 1280 / 1440 | 4 | ✗ |
| **Interlace** | **480 / 768 / 1024 / 1280** | **4** | **✓** |

Closest match: **Linear**, **Vercel Geist** (we add `sm` for handheld
floor), **Adobe Spectrum** (we drop the 1768 desktop-XL tier).

## Forbidden

- Ad-hoc `@media (width: ...)` queries in primitive / pattern / template
  source files. Use the `sm:` / `md:` / `lg:` / `xl:` Tailwind variants
  exclusively, so the ladder stays auditable and consistent.
- Custom `--breakpoint-*` keys outside the four declared above. If a
  consumer needs a different breakpoint for their own bespoke layout,
  they author it in their consumer global.css under their own variant
  name (`@custom-variant my-narrow`).

Enforced by a lock test in
`packages/ui/__tests__/breakpoints-lock.test.ts`.

## When to use which

| Need | Reach for |
|---|---|
| Show / hide on tablet | `md:block` / `hidden md:flex` |
| Single column on phone, 3-col on laptop | `grid-cols-1 lg:grid-cols-3` |
| Reduce padding on phone | `p-md md:p-lg` |
| Persistent sidebar on tablet+ | `flex-col md:flex-row` |
| Wide hero on desktop only | `hidden xl:block` |

Mobile-first always: start with the narrow-screen rule, override at the
breakpoint where the layout changes.
