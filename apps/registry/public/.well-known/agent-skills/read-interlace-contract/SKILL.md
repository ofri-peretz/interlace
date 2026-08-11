---
name: read-interlace-contract
description: Read one Interlace component’s full contract — props, state union, keyboard path, ARIA, minimum viewport, version history — before generating code against it. Use whenever an item has been picked but its API is not yet known.
license: MIT
---

# Read one component's contract

## Two fetches, in this order

```bash
# 1. the contract summary — cheap, already parsed
curl -sfL https://ds.interlace.tools/data/agent-index.json | jq '.items[] | select(.name=="<name>")'

# 2. the item itself — the exact source that will land in the tree
curl -sfL https://ds.interlace.tools/r/<name>.json | jq '{name, dependencies, registryDependencies, files: [.files[].target]}'
```

The item's `files[].content` is the shipped source. Its leading JSDoc block is
the authoritative contract: the anatomy, the rules table, the `MIN_VIEWPORT`
rationale, and — for anything that models absence — what each state is entitled
to claim. Read it before writing props; the props table on
`https://ds.interlace.tools/c/<name>` is parsed from that same source.

## What to read, and what each field commits you to

- `rendering` — `client` means the file has `"use client"`. Importing it from a
  Server Component is fine; rendering it *as* one is not.
- `minViewport` — the narrowest viewport in CSS px it is designed for. `null`
  means it adds no floor. If your layout is narrower than the number, the
  component is not the thing that is wrong.
- `states` — the union a caller must satisfy. Where the union is a precedence
  ladder, **array order is the precedence, lowest index wins**. Two states can
  co-occur; a resolver that returns one name silently drops the second fact.
- `keyboard.baseUi` — the Base UI primitive that owns focus, roving tabindex and
  dismissal. If it is set, do not re-implement key handling on top.
- `keyboard.keys` — the key values this file branches on itself. This is the
  behaviour a static a11y scan cannot see, so it is the behaviour to test.
- `a11y.reducedMotion` — the component gates its animation on the OS setting.
- `version` / `since` / `deprecated` — the file you install is stamped with
  `version`; an upgrade diff reads it out of the banner.

## Live render of any documented state

`https://ds.interlace.tools/data/story-map.json` maps each item to its Storybook story ids.
`https://storybook.interlace.tools/iframe.html?id=<storyId>` renders one — the
same render the accessibility gate asserts against, including the loading and
dark variants.

## Worked example — `metric-table`

```
rendering    client
minViewport  320
keyboard     none of its own
states       ANNOTATION_KINDS = publish | release | action
             Direction = up | down | flat
exports      ANNOTATION_KINDS, MIN_VIEWPORT, MetricTable
```

The roic.ai row: metric name, values across time, sparkline, delta. Click a row to promote it into whatever chart the caller renders above.

## The rule

Never describe a component's behaviour from its name or its screenshot. Every
sentence you write about it should be traceable to a field above or to the
source header. If the contract does not say it, do not claim it.
