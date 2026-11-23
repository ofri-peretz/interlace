# Where Interlace stands: a gap matrix

_Last checked: 2026-11-23._

This page compares Interlace with four libraries people reach for when they build a React product site: **shadcn/ui** (the base we build on), **Untitled UI React** (deep application and marketing UI), **Magic UI** and **Aceternity UI** (animated pieces). It names what we lack by **capability**, never by another library's component or API. It is for deciding what to build next. It is not a copy list: no code, names, visuals or copy come from these libraries into Interlace.

## Sources and confidence

| Library        | How it was read                                                                                                                                                                                                    | Confidence                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| shadcn/ui      | `ui.shadcn.com/llms.txt` and `/blocks`                                                                                                                                                                             | Read from the pages           |
| Untitled UI    | `untitledui.com/react`, its components index, and the buttons, theming and RTL docs                                                                                                                                | Read from the pages           |
| Magic UI       | Not fetched this round: the fetch was blocked. Known only at category level (animated text, backgrounds, borders, reveals, marquees, device mockups)                                                               | Category level, not verified  |
| Aceternity UI  | Not fetched this round: the fetch was blocked. Known only at category level (3D and parallax cards, spotlights and beams, scroll-linked hero sections)                                                              | Category level, not verified  |

Rows marked "category level" should be checked against the live catalogs before anyone quotes them.

## Headline

Interlace is already **deeper on quality** than all four. It has keyboard, focus, RTL, 320px and reduced-motion locks enforced in CI, an agent-readable registry, and data-state and reading primitives the others lack. It is **thinner on breadth** in three places:

1. **Motion vocabulary.** We have 18 effects, mostly ambient backdrops. We lack the everyday motion verbs: reveal on scroll, scroll-linked progress and text, pointer-reactive surfaces, text that enters by word or letter, typing, connectors that draw between nodes, and shared-element transitions.
2. **Application inputs.** We have no date picker or calendar, one-time code input, file uploader, multi-select, input or button groups, toggle group, tree view, or resizable panes.
3. **Application shells.** We have no sidebar navigation, navigation menu, menubar, steps, or a notification centre. There are no dashboard or settings page examples.

## Matrix

✓ = has it, ◐ = partial, ✗ = missing, n/a = not that library's scope.

### Motion (the pillar Ofri named first)

| Capability                                              | Interlace                                          | shadcn | Untitled | Magic UI (cat.) | Aceternity (cat.) |
| ------------------------------------------------------- | -------------------------------------------------- | ------ | -------- | --------------- | ----------------- |
| Numbers that count                                      | ✓ CountUp                                          | ✗      | ◐        | ✓               | ◐                 |
| Word swap in a headline                                 | ✓ RotatingText                                     | ✗      | ✗        | ✓               | ✓                 |
| Scramble or decode text                                 | ✓ DecodeText                                       | ✗      | ✗        | ✓               | ◐                 |
| Travelling gradient text and sheen                      | ✓ SheenText, Sheen                                 | ✗      | ✗        | ✓               | ✓                 |
| Text that enters by word or letter                      | ✗                                                  | ✗      | ✗        | ✓               | ✓                 |
| Typing or terminal text                                 | ✗                                                  | ✗      | ✗        | ✓               | ✓                 |
| Reveal on scroll (fade, rise, blur in)                  | ◐ StaggerList only, for lists                      | ✗      | ✗        | ✓               | ✓                 |
| Scroll-linked progress and text that fills as you read  | ◐ ReadingStrand (progress only)                    | ✗      | ✗        | ✓               | ✓                 |
| Marquee of logos or cards                               | ✓ Scroller                                         | ✗      | ◐        | ✓               | ✓                 |
| Ambient backgrounds (grid, dots, stars, mesh, beams)    | ✓ GridField, Starfield, GradientMesh, LightBeam, … | ✗      | ✗        | ✓               | ✓                 |
| Edge light around a card or button                      | ✓ EdgeGlow                                         | ✗      | ✗        | ✓               | ✓                 |
| Pointer-following spotlight on a surface                | ✗                                                  | ✗      | ✗        | ✓               | ✓                 |
| Tilt or depth on hover                                  | ◐ StrandField (data only)                          | ✗      | ✗        | ◐               | ✓                 |
| Animated connector between nodes                        | ✗                                                  | ✗      | ✗        | ✓               | ◐                 |
| Shared-element or layout transitions (tabs, expanding)  | ✗                                                  | ✗      | ✗        | ◐               | ✓                 |
| Press and hover micro-motion on controls                | ✓ Button scale, motion tokens                      | ◐      | ◐        | ✓               | ◐                 |
| Reduced-motion fallback enforced in CI                  | ✓ motion-contract-lock                             | ✗      | ✗        | ✗ (not claimed) | ✗ (not claimed)   |

### Inputs and forms

| Capability                       | Interlace                   | shadcn | Untitled |
| -------------------------------- | --------------------------- | ------ | -------- |
| Button sizes, variants, loading  | ✓ (loading in review)       | ✓      | ✓        |
| Button group, input group        | ✗                           | ✓      | ✓        |
| Field wrapper (label, hint, error) | ◐ Form                     | ✓      | ✓        |
| Select, combobox                 | ✓                           | ✓      | ✓        |
| Multi-select with tags           | ✗                           | ◐      | ✓        |
| Number field, slider, switch     | ✓                           | ◐      | ✓        |
| One-time code input              | ✗                           | ✓      | ✓        |
| Date picker, calendar            | ✗                           | ✓      | ✓        |
| File uploader                    | ✗                           | ✗      | ✓        |
| Toggle group                     | ✗                           | ✓      | ◐        |
| Rich text editor                 | ◐ CodeEditor (code only)    | ✗      | ✓        |

### Navigation and shells

| Capability                         | Interlace               | shadcn | Untitled |
| ---------------------------------- | ----------------------- | ------ | -------- |
| Top bar with menu                  | ✓ Topbar, TopbarMenu    | ✓      | ✓        |
| Sidebar navigation (collapsible)   | ✗                       | ✓      | ✓        |
| Menubar                            | ✗                       | ✓      | ✗        |
| Toolbar                            | ✓ (in review)           | ✗      | ✗        |
| Tabs, breadcrumb, pagination       | ✓                       | ✓      | ✓        |
| Progress steps                     | ◐ ThreadSteps           | ✗      | ✓        |
| Tree view                          | ✗                       | ✗      | ✓        |
| Resizable panes                    | ✗                       | ✓      | ✗        |
| Command palette                    | ✓                       | ✓      | ✓        |
| Table of contents                  | ✓ Toc                   | ✗      | ✗        |

### Overlays and feedback

| Capability                       | Interlace          | shadcn | Untitled |
| -------------------------------- | ------------------ | ------ | -------- |
| Dialog, alert dialog, sheet      | ✓                  | ✓      | ✓        |
| Drawer with swipe and snap       | ✓ (merged today)   | ✓      | ✓        |
| Popover, tooltip, hover card     | ✓                  | ✓      | ✓        |
| Toast                            | ✓                  | ✓      | ✓        |
| Spinner as its own part          | ◐ inside Button    | ✓      | ✓        |
| Empty state                      | ✓                  | ✓      | ✓        |
| Notification centre or feed      | ✗                  | ✗      | ✓        |

### Display and data

| Capability                     | Interlace                                    | shadcn | Untitled |
| ------------------------------ | -------------------------------------------- | ------ | -------- |
| Table and data table           | ✓ DataTable                                  | ✓      | ✓        |
| Charts                         | ✓ TimeSeries, Distribution, Sparkline, …     | ✓      | ✓        |
| Carousel                       | ✗                                            | ✓      | ✓        |
| Avatar, badge, tag, kbd        | ✓                                            | ✓      | ✓        |
| Activity feed or timeline      | ✓ Timeline                                   | ✗      | ✓        |
| Code block with copy           | ✓                                            | ✗      | ✓        |
| Reading primitives (prose, reading time, citation) | ✓                       | ◐      | ✗        |

### Page examples

| Capability                                    | Interlace                       | shadcn | Untitled |
| --------------------------------------------- | ------------------------------- | ------ | -------- |
| Marketing sections (hero, features, pricing, FAQ, testimonials, footer, CTA, newsletter) | ✓ | ✗ | ✓ |
| Auth pages (sign in, sign up, reset)          | ◐ SignInForm                    | ✓      | ✓        |
| Dashboard and settings examples               | ✗                               | ✓      | ✓        |
| 404 and empty pages                           | ◐ EmptyState                    | ✗      | ✓        |

### Platform

| Capability                                  | Interlace                                                 | shadcn | Untitled |
| ------------------------------------------- | --------------------------------------------------------- | ------ | -------- |
| shadcn registry install                     | ✓                                                         | ✓      | ✗ (own CLI) |
| Theming through CSS variables               | ✓                                                         | ✓      | ✓        |
| Dark mode                                   | ✓                                                         | ✓      | ✓        |
| RTL, checked per component                  | ✓ RTL story per primitive                                 | ◐ Direction provider | ✓ logical properties, migrate command |
| Keyboard, focus and 320px locks in CI       | ✓                                                         | ✗      | ✗        |
| Agent-readable surface (llms.txt, skills, MCP) | ✓ llms.txt, agent skills                               | ✓      | ◐        |
| Size scale                                  | ◐ Button sm/default/lg/icon                               | ◐      | ✓ xs to xl on most parts |

## What to build next

Ordered by what Ofri asked for (motion first), then by how often a product site needs the piece. Each is its own PR, built from Interlace's own tokens, original, brand-neutral, with a reduced-motion fallback and the existing locks.

**Motion, first wave**

1. **Reveal**: any block fades, rises or sharpens as it enters the viewport. Uses CSS scroll-driven animation (`animation-timeline: view()`) where supported, with an observer fallback. It shows instantly under reduced motion.
2. **Split text entrance**: a heading enters by word or letter, with stagger from the motion tokens. Screen readers get the whole string once.
3. **Scroll-linked text**: a paragraph whose words fill in as it crosses the viewport, and a page progress bar. Pure CSS where supported.
4. **Pointer spotlight**: a surface that lights up under the pointer, with a keyboard-focus equivalent. Nothing happens on touch or under reduced motion.
5. **Typing text**: a line that types itself out, with a cursor. It is announced once, and the whole line shows at once under reduced motion.
6. **Connector**: an animated line that draws between two elements, for flows and diagrams.
7. **Shared-element transitions**: tab indicators and expanding cards through the View Transitions API, falling back to an instant change.

**Breadth, second wave**

8. Date picker and calendar.
9. Sidebar navigation (collapsible, with icon rail).
10. Field, input group and button group.
11. One-time code input, toggle group, spinner as its own part.
12. File uploader, multi-select.
13. Carousel (swipe, keys, snap).
14. A dashboard example and a settings example built only from Interlace parts.
