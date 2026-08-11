---
name: discover-interlace-components
description: Find a component in the Interlace design system by what it must DO — server-safe, keyboard-operable, has a loading state, models an absence — rather than by name. Use before writing any UI against this registry.
license: MIT
---

# Discover Interlace components by contract

## When to use this

The visitor described a behaviour, not a component name: "something that shows a
metric that might not have been measured", "a menu that works from the keyboard",
"a card I can render on the server". Names will not get you there. The contract
will.

## The one file you need

`GET https://ds.interlace.tools/data/agent-index.json`

140 items, each with `tier`, `categories`, `summary`, `topics`,
`rendering`, `minViewport`, `loadingState`, `keyboard`, `states`, `a11y`,
`exports`, `version` and `install`. It is a flat array — filter it directly.

## Filters that answer real questions

```bash
# usable inside a React Server Component, with its own skeleton
jq '.items[] | select(.rendering=="server" and .loadingState) | .name' agent-index.json
# → article-list-grid, author-byline, card, cta-section

# owns its own key handling (not just inherited from Base UI)
jq '.items[] | select(.keyboard.keys | length > 0) | {name, keys: .keyboard.keys}' agent-index.json
# → context-menu, distribution, network-graph, time-series

# models an explicit state union — i.e. absence is a value, not a null check
jq '.items[] | select(.states | length > 0) | {name, states: [.states[].name]}' agent-index.json
# → 24 item(s)

# safe down to a 320px viewport
jq '.items[] | select(.minViewport == null or .minViewport <= 320) | .name' agent-index.json
```

## The vocabulary that matters here

- `meta.tier` — Which DS layer the item belongs to: theme, lib, primitive, pattern, template, effects, charts. Composition runs upward only — a primitive never imports a pattern.
- `meta.client` — true when the installed file carries the "use client" directive. false means it is safe inside a React Server Component with no boundary.
- `meta.minViewport` — The narrowest viewport in CSS px this component is designed to render correctly at, declared in source as `export const MIN_VIEWPORT`. null means it inherits the min-viewport of whatever it renders and introduces no floor of its own.
- `meta.loading` — true when the component accepts `loading?: boolean` and renders its own skeleton — the DS-wide opt-in, so a caller never hand-rolls a placeholder.
- `meta.version` — The component's own semver, derived from its git history and stamped into the banner of the file you install.
- `meta.since` — The @interlace/ui release the component first shipped in.
- `meta.deprecated` — Present only when the item is on its way out. Carries `removedIn` (a real release, never "eventually") and `replacement`.
- `keyboard` — Observed evidence only. `baseUi` names the Base UI primitive that owns focus and dismissal; `keys` lists the UI Events key values this file branches on itself; `handled` is the disjunction. An item with handled:false is not asserted to be inaccessible — it is asserted to add no keyboard behaviour of its own.
- `states` — The string unions a caller has to satisfy, read from the source. Where a union is a precedence ladder (DATA_STATES) the array order IS the precedence, lowest index wins.
- `a11y` — ARIA roles and attributes written literally in the shipped file, what drives its motion (a CSS driver is clamped by our preflight; a JS driver is out of reach of it), whether the file references prefers-reduced-motion at all, and whether it opts into the WCAG 2.2 SC 2.4.13 focus ring.

## Worked example

> "I need to show a number that might never have been measured."

1. Filter for a state union that distinguishes *no run* from *measured zero*:
   `jq '.items[] | select(.states[]?.values[]? | test("not-counted|first-measurement"))'`
2. That returns data-state-model, data-state, meter, stat-strip.
3. Read its `summary` and `topics` before installing — the header prose says
   what each state is *entitled to claim*, which the union alone does not.

## What NOT to conclude

`keyboard.handled: false` means the file adds no key handling of its own. It is
not a claim that the component is inaccessible — a `<button>` needs none. Never
report an item as failing accessibility on the strength of this field.

## Next

- To read one item in full: `read-interlace-contract`.
- To install: `install-interlace-component`.
