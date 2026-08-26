#!/usr/bin/env node
/**
 * `interlace-ui` — the I/O edge. Everything decidable lives in `plan.ts` and
 * `render.ts`; this file only fetches, spawns, writes and exits.
 *
 * See `plan.ts` for why this delegates to the shadcn CLI instead of installing
 * files itself.
 */

import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { ensureRegistryAlias } from './components-json.js';

import { planFromArgv, SHADCN_SPEC, type Plan } from './plan.js';
import {
  renderHelp,
  renderInfo,
  renderList,
  type IndexItem,
  type RegistryItem,
} from './render.js';

const require = createRequire(import.meta.url);

const readVersion = (): string => {
  const pkg = require('../package.json') as { version?: string };
  return pkg.version ?? '0.0.0';
};

const fail = (message: string): never => {
  process.stderr.write(`interlace-ui: ${message}\n`);
  process.exit(1);
};

const getJson = async (url: string): Promise<unknown> => {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    return fail(`could not reach ${url} (${(error as Error).message})`);
  }
  if (!response.ok) {
    // 404 on an item is the overwhelmingly common case and deserves the
    // pointer, not a bare status line.
    const hint = response.status === 404 ? `\n  run \`interlace-ui list\` to see what exists` : '';
    return fail(`${url} responded ${response.status}${hint}`);
  }
  try {
    return (await response.json()) as unknown;
  } catch {
    return fail(`${url} did not return JSON`);
  }
};

const runShadcn = (argv: readonly string[]): Promise<number> =>
  new Promise((resolve) => {
    const child = spawn('npx', ['-y', SHADCN_SPEC, ...argv], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', (error) => {
      process.stderr.write(`interlace-ui: could not run npx (${error.message})\n`);
      resolve(1);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });

export const run = async (argv: readonly string[]): Promise<number> => {
  const plan: Plan = planFromArgv(argv);

  switch (plan.kind) {
    case 'error':
      process.stderr.write(`interlace-ui: ${plan.message}\n\n${renderHelp()}`);
      return 1;

    case 'help':
      (plan.exitCode === 0 ? process.stdout : process.stderr).write(renderHelp());
      return plan.exitCode;

    case 'version':
      process.stdout.write(`${readVersion()}\n`);
      return 0;

    case 'list': {
      const index = (await getJson(`${plan.registry}/r/index.json`)) as { items?: IndexItem[] };
      process.stdout.write(`${renderList(index.items ?? [])}\n`);
      return 0;
    }

    case 'info': {
      const item = (await getJson(
        `${plan.registry}/r/${plan.name}.json`,
      )) as RegistryItem;
      process.stdout.write(`${renderInfo(item, plan.registry)}\n`);
      return 0;
    }

    case 'shadcn': {
      if (plan.dryRun) {
        process.stdout.write(`npx -y ${SHADCN_SPEC} ${plan.argv.join(' ')}\n`);
        return 0;
      }
      const code = await runShadcn(plan.argv);
      if (code === 0 && plan.alias) {
        const result = await ensureRegistryAlias(process.cwd(), plan.registry);
        if (result.status === 'added') {
          process.stdout.write('\ninterlace-ui: registered @interlace in components.json\n');
          process.stdout.write('  npx shadcn@latest add @interlace/button   # now works too\n');
        } else if (result.status === 'unparsable') {
          process.stderr.write('interlace-ui: components.json is not valid JSON; left it alone\n');
        }
      }
      return code;
    }
  }
};

/**
 * Is this module the process entry point?
 *
 * `realpathSync` is the load-bearing call. npm installs a bin as a SYMLINK at
 * `node_modules/.bin/interlace-ui`, and `npx` runs that symlink — so
 * `process.argv[1]` is the link while `import.meta.url` is the file it points
 * at. Comparing them without resolving the link makes this false for the one
 * invocation the package exists to serve, and the CLI exits 0 having printed
 * nothing. `pathToFileURL` rather than a `file://` template for the same class
 * of reason: it is what correctly encodes a path containing spaces, and a
 * Windows drive letter.
 *
 * Covered by `__tests__/bin.test.ts`, which runs the built file through a real
 * symlink — no other test in this package can observe this.
 */
const isEntry = (() => {
  const argv1 = process.argv[1];
  if (argv1 === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(argv1)).href;
  } catch {
    return false;
  }
})();

if (isEntry) {
  process.exitCode = await run(process.argv.slice(2));
}
