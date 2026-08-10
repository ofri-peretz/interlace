# Follow-up: `animate-pulse` ignores `prefers-reduced-motion`

**Status: RESOLVED, 2026-08-10** — `.animate-pulse` (plus `.animate-meteor`
and `.animate-meteor-effect`, the other two bare utilities the DS emitted
without listing) is now in the `tokens.css` allowlist, and
`packages/ui/__tests__/motion-contract-lock.test.ts` fails if any bare
`animate-*` utility in `packages/ui/src` is missing from it.

**Correction to the severity below.** The stated impact — "a user with
`reduce` set gets the full 2s infinite opacity pulse on every skeleton" —
was wrong. `packages/ui/styles/preflight.css` carries a universal
`@media (prefers-reduced-motion: reduce) { *, *::before, *::after {
animation-duration: 0.01ms !important; animation-iteration-count: 1
!important; … } }`, and `styles/index.css` — the canonical single import —
pulls it in. Measured in Chrome against the real stylesheets, a
`.animate-pulse` element under `reduce` computes
`animation-duration: 1e-05s, animation-iteration-count: 1`. No skeleton
in any app importing `index.css` has ever pulsed for a `reduce` user.

The real defect was narrower and still worth fixing: every stylesheet is a
separate `exports` entry, so a consumer can import `tokens.css` +
`theme.css` and skip `preflight.css` — the case `index.css` was written to
prevent, and the case where the allowlist is the entire contract. It also
matters that Storybook's reset was blamed for hiding this: the reset that
was actually doing the work ships in the package, and the audit's
recommendation to remove the Storybook one would have changed nothing.

**Type:** code bug (not a doc bug — the doc is right, the code isn't)
**Found:** while reconciling `docs/philosophies/*` against source, 2026-08-10
**Severity:** ~~WCAG 2.3.3 / motion-sensitivity contract breach, on every
skeleton the DS renders~~ — see the correction above; the shipped default
import path was never affected.

## The contract

`docs/philosophies/LOADING_PHILOSOPHY.md` §2 ("Skeletons breathe with
one pulse, not many"):

> Under `prefers-reduced-motion: reduce`: no pulse. Static dimmed
> placeholder.

The same doc's own implementation example (§"A data-bound component")
writes `motion-safe:animate-pulse`. The contract is unambiguous.

## What ships

`packages/ui/src/primitives/skeleton.tsx` emits a **bare**
`animate-pulse`:

- `skeleton.tsx:173` — `'animate-pulse bg-muted'`
- `skeleton.tsx:210` — `'animate-pulse bg-muted'`

And the reduced-motion block in `packages/ui/styles/tokens.css:155-175`
is a **16-class allowlist**, not a wildcard:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-shimmer-slide,
  .animate-spin-around,
  /* … 14 more … */
  .animate-scale-in {
    animation: none !important;
    transition: none !important;
  }
}
```

`.animate-pulse` is not in it. A user with `reduce` set gets the full
2s infinite opacity pulse on every skeleton in the design system.

## Why nobody noticed

`apps/storybook/.storybook/preview.css:62-71` ships a global
reduce-everything reset (`*, *::before, *::after { animation-duration:
0.001ms !important; … }`). Storybook is where these components get
looked at, and Storybook silently satisfies the contract that the
shipped CSS does not. Consumer apps get no such reset.

## Every affected call site

`grep -rn 'animate-pulse' packages/ui/src apps/*/src` — none of them
are `motion-safe:`-gated:

| Site | Note |
| --- | --- |
| `packages/ui/src/primitives/skeleton.tsx:173` | Skeleton |
| `packages/ui/src/primitives/skeleton.tsx:210` | Skeleton (second render path) |
| `apps/storybook/src/stories/primitives/DataState.stories.tsx:238` | story-local placeholder |
| `apps/registry/src/components/story-preview.tsx:81` | app code |

## Recommended fix

**Add `.animate-pulse` to the `tokens.css` allowlist.** One line, and
it covers all four sites above plus every future consumer that reaches
for Tailwind's `animate-pulse` — including app code the DS doesn't
own.

The alternative, `motion-safe:animate-pulse` at each call site, fixes
only the sites you remember to edit and leaves the next one to
reintroduce the bug. Prefer it only if some caller genuinely needs the
pulse under `reduce`, which nothing here does.

Whichever lands, it needs a lock test — the current allowlist has no
test asserting membership, which is why a class could go missing from
it unnoticed. A test that renders `<Skeleton>` and asserts the class
set, or a CSS-source assertion in the style of
`packages/ui/__tests__/breakpoints-lock.test.ts`, closes it.

Consider also whether the Storybook global reset should be removed once
this is fixed: it is currently hiding exactly this class of defect from
the surface where components are reviewed.
