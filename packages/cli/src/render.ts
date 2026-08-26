/**
 * `interlace-ui` — output formatting. Pure; takes data, returns a string.
 *
 * Kept apart from the I/O in `index.ts` for one reason: the shape of what we
 * print IS the product for `list` and `info`. Those two commands exist because
 * the shadcn CLI cannot browse a third-party registry — it can install a URL
 * you already know, but it has no `list`. So "what does this registry hold"
 * is the one question only we can answer, and it is worth a test that reads
 * the rendered text rather than a mock that asserts we called console.log.
 */

import { DEFAULT_REGISTRY } from './plan.js';

export type IndexItem = {
  name: string;
  type: string;
  title?: string;
  description?: string;
};

export type RegistryFile = { path: string; target?: string; type?: string };

export type RegistryItem = {
  name: string;
  type: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: RegistryFile[];
};

/**
 * Human labels for the registry's `type` discriminator, in the order we want
 * them listed. Order is intentional and not alphabetical: a newcomer needs the
 * theme before anything else compiles, and the starter bundles before they
 * start picking primitives one at a time.
 */
const TYPE_ORDER: ReadonlyArray<readonly [string, string]> = [
  ['registry:style', 'Theme'],
  ['registry:lib', 'Utilities'],
  ['registry:ui', 'Components'],
  ['registry:block', 'Blocks'],
];

const pad = (s: string, width: number) => s + ' '.repeat(Math.max(0, width - s.length));

export const renderList = (items: readonly IndexItem[]): string => {
  if (items.length === 0) return 'This registry is empty.';

  const seen = new Set<string>();
  const groups: Array<{ label: string; rows: IndexItem[] }> = [];

  for (const [type, label] of TYPE_ORDER) {
    const rows = items.filter((i) => i.type === type);
    if (rows.length === 0) continue;
    rows.forEach((r) => seen.add(r.name));
    groups.push({ label, rows });
  }
  // Anything whose type we do not have a label for still gets listed. A
  // registry that grows a new item type should not silently drop it from the
  // only command that can enumerate it.
  const rest = items.filter((i) => !seen.has(i.name));
  if (rest.length > 0) groups.push({ label: 'Other', rows: rest });

  const width = Math.min(24, Math.max(...items.map((i) => i.name.length)));

  const body = groups
    .map(({ label, rows }) => {
      const lines = rows
        .map((r) => `  ${pad(r.name, width)}  ${r.title ?? ''}`.trimEnd())
        .join('\n');
      return `${label} (${rows.length})\n${lines}`;
    })
    .join('\n\n');

  return `${body}\n\n${items.length} items. Install one with:  interlace-ui add <name>`;
};

export const renderInfo = (item: RegistryItem, registry: string): string => {
  const lines: string[] = [`${item.title ?? item.name}  (${item.name})`];
  if (item.description) lines.push(item.description);
  lines.push('');
  lines.push(`type                  ${item.type}`);

  if (item.dependencies?.length) {
    lines.push(`npm dependencies      ${item.dependencies.join(', ')}`);
  }
  if (item.registryDependencies?.length) {
    // These install automatically — worth saying, because the list can be long
    // and it otherwise reads as extra work the consumer has to do by hand.
    lines.push(
      `registry dependencies ${item.registryDependencies
        .map((d) => d.replace(`${registry}/r/`, '').replace(/\.json$/, ''))
        .join(', ')}  (installed for you)`,
    );
  }
  if (item.files?.length) {
    lines.push('');
    lines.push('files');
    for (const f of item.files) lines.push(`  ${f.target ?? f.path}`);
  }

  lines.push('');
  lines.push(`install               interlace-ui add ${item.name}`);
  // The equivalent shadcn command is printed on purpose. Someone evaluating
  // the registry should be able to see they are not being locked into our CLI
  // before they install anything.
  lines.push(`  or                  npx shadcn@latest add ${registry}/r/${item.name}.json`);

  return lines.join('\n');
};

export const renderHelp = (): string => `
interlace-ui — install components from the Interlace design system

Usage
  npx interlace-ui <command> [options]

Commands
  init                 set up shadcn in this project and register @interlace
  add <name...>        install one or more components
  list, ls             list every component in the registry
  info <name>          show a component's dependencies, files and install command

Options
  --registry <url>     registry origin (default ${DEFAULT_REGISTRY})
  --dry-run            print the shadcn command instead of running it
  -h, --help           show this help
  -v, --version        print the version

Examples
  npx interlace-ui list
  npx interlace-ui add button card
  npx interlace-ui add @interlace/theme
  npx interlace-ui add button --overwrite      # unknown flags go to shadcn

This CLI is a front door, not a lock-in. Every component is a plain shadcn
registry item, so the equivalent command always works too:

  npx shadcn@latest add ${DEFAULT_REGISTRY}/r/button.json
`.trimStart();
