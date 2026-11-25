---
name: verify
description: Run a changed Interlace component where a consumer meets it, the registry site, Storybook or a shadcn install into a fresh app, and read what renders. Use before committing a change.
---

# Verify a change by running it

Whatever we ship runs in someone else's app, so the check is that app: the component installed
from the registry and rendered, not only its unit test. Paste the command and what it showed into
the commit's `Verified-by:` receipt.

## Boot

- Registry site: `npm run dev -w registry` serves <http://localhost:4178> (it builds the registry
  JSON first; `npm run registry:build` after a source change).
- Landing: `npm run dev -w @interlace/landing` serves <http://localhost:3002>.
- Storybook: `npm run build-storybook -w @interlace/storybook`, then serve `storybook-static` on 6006.

Ready means the URL answers 200 and the component's page or story renders.

## Drive and inspect

Open the component's page in a browser tool at 390px and at desktop width, in light and dark,
and use it as a user would: click, type, tab through it. Read back the page text, the focus order
and the console. A change to how a component installs runs
`node apps/registry/scripts/e2e-install.mjs --only <name>`, which scaffolds a Next.js app,
`shadcn add`s the item and runs `next build`.

## Feature map

| Feature                       | Reach it by                                                               | Working means                                                    |
| ----------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| A component's docs page       | <http://localhost:4178/c/name>                                            | demo renders, light and dark, no layout break at 390px           |
| Registry JSON                 | <http://localhost:4178/r/name.json>                                       | 200, the files the item declares                                 |
| Install into a fresh app      | `node apps/registry/scripts/e2e-install.mjs --only <name>`                | `shadcn add` and `next build` exit 0                             |
| Stories and their a11y checks | `npm run test-storybook:ci -w @interlace/storybook`                       | every story passes                                               |
| `interlace-ui` CLI            | `npm run build -w interlace-ui && node packages/cli/dist/index.js --help` | exit 0, lists its commands                                       |
| Landing                       | <http://localhost:3002>                                                   | sections render; `npm run e2e:a11y -w @interlace/landing` passes |

## When it fails

Fix the component or the token, not this skill. A row that no longer runs is fixed in its own
commit. After three failed rounds, stop and show the person the output.
