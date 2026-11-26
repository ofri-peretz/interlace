---
'interlace-ui': minor
---

check: tell whether your copied components still match a release. `interlace-ui check` reads your components.json, finds every file that came from the registry and compares it, byte for byte after line endings, with the released item: matches a release, behind, modified locally, ahead of any release, or missing. It exits 1 on drift (`--strict` counts files behind the release too), 2 when it could not check, takes an allow list (`--allow`, or `.interlace-check.json` with a reason per file; it says when an allowed file matches a release again) and prints JSON with `--json` for CI and agents.

Fix: `add button --cwd ./web` (and `-c`, `--path`, `-p`) passes the folder to shadcn instead of reading it as a component name.
