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

Options: `--registry <url>` (install from a branch deploy or a mirror),
`--dry-run` (print the shadcn command instead of running it), `--help`,
`--version`.

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
