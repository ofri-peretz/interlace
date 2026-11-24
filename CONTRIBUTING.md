# Contributing to Interlace

Thanks for helping. Interlace is a shadcn registry: what we ship is source code that lands in
someone else's repo, so every change is judged by what it does in **their** app.

## Before you start

- Read [`DESIGN_PRINCIPLES.md`](./DESIGN_PRINCIPLES.md). The 14 principles are the spec.
- Read the charter for the area you touch in [`docs/philosophies/`](./docs/philosophies/)
  (for example `A11Y_PHILOSOPHY.md` or `FORM_PHILOSOPHY.md`).
- For a new component or a behaviour change, open an issue first so we can agree on the API.

## Set up

```bash
git clone https://github.com/ofri-peretz/interlace.git
cd interlace
npm install          # also installs the lefthook git hooks
npm run dev          # every workspace in parallel
```

Node 24 is required (see `.nvmrc`).

## Adding a component

A new primitive lands as one PR with:

1. `packages/ui/src/primitives/<name>.tsx`, the component. Use `button.tsx` or `dialog.tsx` as
   the template for the header comment.
2. `apps/storybook/src/stories/primitives/<Pascal>.stories.tsx`, covering every state.
3. An entry in `PRIMITIVES` in `packages/ui/__tests__/primitives-min-viewport-lock.test.tsx`.
4. The export entry in `packages/ui/package.json`.
5. A category in `apps/registry/registry-categories.json`.
6. The rebuilt registry output: `npm run registry:build`, then commit `apps/registry/public/r/`.
7. A changeset: `npm run changeset`.

Patterns, templates and charts follow the same shape in their own folders.

## Checks

```bash
npm run ci:local
```

This runs exactly what the pre-push hook and CI run: typecheck, tests (including the lock
tests that turn the design rules into checks) and build. CI also validates every registry item
against the official shadcn schemas, installs every item into a scratch Next.js app, and runs
axe and visual snapshots against every story.

Never push with `--no-verify`. The hooks are the gate. The full path from change to merge, and
the checklist a reviewer uses, is in [`docs/AI_SDLC.md`](./docs/AI_SDLC.md).

## Commits and pull requests

- Branch as `<type>/<slug>`, for example `feat/date-picker`.
- Commit as `<type>(<scope>): <subject>`. The scope is a workspace folder (`ui`, `registry`,
  `storybook`, `landing`, `cli`) or one of `ci`, `deps`, `release`, `docs`, `workspace`.
- Fill in the pull request template. Screenshots help for anything visual.

## Code of conduct

By taking part you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

Do not open a public issue for a vulnerability. See [`SECURITY.md`](./SECURITY.md).
