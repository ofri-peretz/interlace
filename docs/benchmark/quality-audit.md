# Quality audit: each component against the best

_Started 2026-11-24. Kept current by the PR that closes each row._

[landscape.md](landscape.md) asks what Interlace lacks. This page asks how well what it has
behaves, measured against the care shown by shadcn/ui, Radix, Base UI, Linear, Vercel, Stripe and
Apple. They set the bar for behaviour; nothing here copies a look, an asset or an API.

Each row is one gap, found by reading the source. A row is closed by a PR that fixes it for every
component at once and, where a computer can check it, adds a lock so it stays fixed.

## The dimensions

| Dimension | The bar |
| --- | --- |
| Right-to-left | Every side is logical (`ps-*`, `border-s`, `start-*`). Arrows and chevrons that mean "next" mirror. Keyboard arrows follow the reading direction. |
| Keyboard | Every action reachable without a pointer, in the order a reader expects, with the keys the WAI-ARIA pattern names. |
| Focus | One ring everywhere: the `--ring` colour at full strength, outside the control, never over text, 3:1 against what it sits on. |
| Text size | At 150% text on a 320px phone nothing clips, overlaps or scrolls sideways. |
| Dark and more contrast | Every token pair holds AA in both schemes; `prefers-contrast: more` reaches AAA on text. |
| Motion | Every duration and easing is a token a brand can retune; nothing moves under reduced motion. |
| Responsive | Collections answer to their container; chrome answers to the viewport. |

## Open and closed

| # | Dimension | Gap | Where | Status |
| --- | --- | --- | --- | --- |
| 1 | Right-to-left | Physical sides (`pl-8`, `border-l-4`, `right-2`, `ml-auto`) put check marks, accent bars, quote rules, close buttons and toasts on the wrong edge in Hebrew and Arabic | 28 files: menus, select, combobox, callout, prose, toast, dialog and sheet close buttons, number field, pagination, templates | Closed: logical sides, plus `inline-direction-logical-lock` |
| 2 | Right-to-left | "Next" arrows and chevrons pointed the wrong way, the switch thumb slid out of its track, toasts entered from the wrong edge | pagination, breadcrumb, prev-next post, submenu trigger, switch, toast | Closed with row 1 |
| 3 | Right-to-left, keyboard | No direction provider, so Base UI's sliders, tabs, toolbars, radio groups and submenus keep left-to-right arrow keys in an RTL page | every Base UI composite | Closed: `DirectionProvider` sets `dir` and Base UI's direction from one prop; Storybook's RTL decorator uses it |
| 4 | Motion | Hard-coded durations and easings (`duration-150`, `duration-[180ms]`, `ease-out`) that a brand cannot retune | toast, select, combobox, command palette, progress, flip card, guess reveal, social sign-in, focus grid, article card | Closed: tokens everywhere, plus `motion-token-lock` |
| 5 | Focus | Four ring recipes (`ring-ring/50`, `ring-ring/60`, `ring-2` with offset, `outline-2`), two of them at partial strength that may fall under 3:1 | inputs, tabs, accordion, dialog close, buttons | Closed: one 2px full-strength ring with a 2px gap, plus `focus-ring-strength-lock` |
| 6 | Right-to-left | Sheet and drawer only open from a physical edge; no `start` or `end` side that follows the page | sheet, drawer | Closed: `start` and `end` resolve from `DirectionProvider`, pinned by `logical-edge.test` |
| 7 | Text size | At 150% text on a 390px phone, fixed rem widths (`w-80`, `max-w-80`, `w-11` boxes, `px-10`) grew past the screen and the page scrolled sideways | hover card, OTP field, scorecard row, dashboard and scorecard templates, Storybook's centered stage | Closed: widths cap at the space available; 14 entries left `a11y-known.json`. Stat strip and charts remain, with the data components work |

## Out of scope here

Charts and the timeline map plot along an axis that runs left to right in every script; their
direction belongs to the data components work, not this audit. Screenshot and accessibility test
coverage for every component is its own track.
