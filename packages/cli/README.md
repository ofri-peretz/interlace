# interlace-ui

The command line front door to the [Interlace design system](https://ds.interlace.tools).

```bash
npx interlace-ui list
npx interlace-ui add button card
```

## What it is

Interlace ships as a [shadcn](https://ui.shadcn.com) registry: every component
is a registry item at `ds.interlace.tools/r/<name>.json`, and installing one
copies real source into your project rather than adding a dependency.

That already works with the shadcn CLI. This package adds the two things a
third-party registry cannot get from it:

- **a shorter install** — `interlace-ui add button` instead of
  `npx shadcn@latest add https://ds.interlace.tools/r/button.json`
- **a way to browse** — `list` and `info` answer "what is in here" and "what
  will this pull in", which the shadcn CLI has no command for.

It is a front door, not a lock-in. `add` and `init` delegate to the shadcn CLI;
this package never writes component files itself.

## Commands

| Command | What it does |
| --- | --- |
| `init` | Runs `shadcn init`, then registers `@interlace` in your `components.json` |
| `add <name...>` | Installs one or more components |
| `list`, `ls` | Lists every item in the registry, grouped by kind |
| `info <name>` | Shows a component's dependencies, files and install command |
| `check` | Tells whether the components you copied still match a release |

Options: `--registry <url>` (install from a branch deploy or a mirror),
`--dry-run` (print the shadcn command instead of running it), `--help`,
`--version`.

### Check that your copies still match

Components are copied into your tree, so they can drift: edited in place, reformatted, or
copied from a branch that was never released. `check` reads your `components.json`, finds every
file that came from the registry, fetches the released items from the registry and says, for
each file:

| Status | Meaning |
| --- | --- |
| matches a release | the bytes equal the current release (line endings are ignored, nothing else) |
| behind the release | its banner names an older release. Only the current release is published, so this cannot be checked byte for byte. **It does not fail the check by default**; pass `--strict` to make it fail |
| modified locally | its banner names the current release, or it has none, and the bytes differ |
| ahead of any release | its banner names a release the registry does not have: copied from a branch or an unreleased pull request |
| missing | the component is installed (one of its files is here) and this file is not |

```bash
npx interlace-ui check
npx interlace-ui check --json              # for CI and for agents
npx interlace-ui check --allow components/ui/card.tsx
```

It exits `0` when there is no drift, `1` when a file is modified, ahead or missing (and, with
`--strict`, behind), and `2` when it could not check (no `components.json`, an unreadable allow
list, the registry unreachable). Files may be in the project root or under `src/`, and wherever the
`aliases` in your `components.json` put them.

A file that is different on purpose goes in the allow list: `--allow <file>` (repeatable), or a
`.interlace-check.json` in the project (or `--config <file>`):

```json
{ "allow": { "components/ui/card.tsx": "taken from interlace#227, delete when released" } }
```

An allowed file is reported but never fails the check, and once it matches a release again the
check tells you to remove it from the list. Options: `--json`, `--strict`, `--allow <file>`,
`--cwd <dir>`, `--config <file>`, `--item <name>` (only that component, repeatable), `--registry <url>`.

In CI:

```yaml
- name: Interlace components still match a release
  run: npx interlace-ui check
```

### Any flag it does not recognise goes to shadcn

```bash
npx interlace-ui add button --overwrite --cwd ./apps/web
```

### One command can span registries

A bare name — or the `@interlace/` form — resolves against this registry.
Anything else is somebody else's namespace and is passed through untouched:

```bash
npx interlace-ui add button @shadcn/input https://other.dev/r/thing.json
```

## You are not locked in

`interlace-ui init` writes this into your `components.json`:

```json
{
  "registries": {
    "@interlace": "https://ds.interlace.tools/r/{name}.json"
  }
}
```

From then on the plain shadcn CLI installs our components just as well:

```bash
npx shadcn@latest add @interlace/button
```

Both commands fetch the same registry item and produce the same files. If this
package ever stops being useful to you, delete it and keep the alias.

## Requirements

Node 20.11+. No runtime dependencies — `npx` downloads this package and nothing
else, and the shadcn CLI is fetched at the moment you run `add` or `init`, at
whatever version your project would have used anyway.

## License

MIT
