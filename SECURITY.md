# Security

## Reporting a vulnerability

Email **ofriperetzdev@gmail.com** (do not file a public GitHub issue). We aim to acknowledge within 48 hours and to land a fix within 14 days for high-severity reports.

## Credential policy

This is a **public** repo. Secrets never live in source. Three valid homes for credentials, in priority order:

| Where | What goes there | Notes |
|---|---|---|
| **Local dev** (`.env.local`, OS keychain, `~/.config/<tool>/auth.json`) | The developer's own dev keys, CLI tokens (Vercel, gh, npm), DB connection strings for local instances. | `.env.local` (and all `.env.*.local` variants) are gitignored by default. Never check them in. |
| **Vercel project env vars** ([Project → Settings → Environment Variables](https://vercel.com/docs/projects/environment-variables)) | Anything needed at build- or runtime by a deployed app (`apps/landing`, `apps/storybook`). Mark every entry **Sensitive**. Scope each to the right targets (production / preview / dev). | This is how `NEXT_PUBLIC_POSTHOG_KEY`, `STORYBOOK_POSTHOG_KEY`, etc. are injected during Vercel builds. |
| **GitHub Actions repo secrets** ([`Settings → Secrets and variables → Actions`](https://github.com/ofri-peretz/interlace/settings/secrets/actions)) | Anything CI itself needs (npm publish token, Codecov token, deploy hooks, etc.). | Currently **empty** — CI does typecheck/test/build only. Add a secret only when CI needs to authenticate to something. |

## What never goes anywhere

- Private API keys hardcoded in source — even commented out.
- `.env` files with real values committed to git.
- Personal SaaS tokens (Notion, Slack, Linear) in the repo, in stories, or in MDX.
- Long-lived `_TOKEN=…` env defaults in `next.config.mjs`, `vercel.json`, or any workflow file.
- Sample data that doxes a real user or organization (use `o***@example.com`, `user-123`, etc.).

## Per-workspace env-var contracts

Each app workspace ships a `.env.example` listing the variables it reads, with stub values and a one-line description. Mirror it to `.env.local` for local dev; mirror to Vercel for prod.

- [`apps/landing/.env.example`](./apps/landing/.env.example)
- [`apps/storybook/.env.example`](./apps/storybook/.env.example)

`packages/ui` is a pure library and reads no env vars.

## CI authentication today

`.github/workflows/ci.yml` runs:

- `npm ci` (uses the public npm registry, no auth)
- `turbo run typecheck` / `test` / `build` (no network beyond npm)

No secrets are referenced. If you add a step that needs one — `npm publish`, `codecov upload`, `vercel deploy` — wire it through `${{ secrets.<NAME> }}` and add the secret in Settings, never inline.

## Tooling that helps

- [gitleaks](https://github.com/gitleaks/gitleaks) — pre-commit + CI scan for committed credentials.
- [Vercel's "Sensitive" toggle](https://vercel.com/docs/projects/environment-variables/sensitive-environment-variables) — values are write-only after creation (cannot be read back via API/dashboard).
- GitHub's [secret scanning + push protection](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning) — enabled on public repos by default; blocks pushes containing known token shapes.
