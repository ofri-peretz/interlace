/**
 * The one thing this CLI writes into a consumer's repository.
 *
 * Everything else it does is delegated to shadcn or is read-only, so this file
 * is where the whole "do not surprise people" budget is spent. Three rules,
 * each of which is a test below:
 *
 *  1. Never overwrite an existing `@interlace` entry. Someone who has pointed
 *     it at a fork, a mirror or a preview deploy means it, and silently
 *     restoring production would be the worst kind of helpful.
 *  2. Never fail the command. `init` succeeding and then blowing up on a
 *     missing or malformed components.json would undo a successful install for
 *     a cosmetic convenience.
 *  3. Preserve the rest of the file — key order, other registries, everything.
 *     This should read as a one-line diff in review, not a reformat.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type AliasResult =
  | { status: 'added'; alias: string }
  | { status: 'already-present' }
  | { status: 'no-config' }
  | { status: 'unparsable' };

export const ALIAS = '@interlace';

/**
 * Register `@interlace` in `<cwd>/components.json` so plain
 * `npx shadcn@latest add @interlace/button` works from here on.
 *
 * This is deliberately the opposite of a lock-in step: its whole purpose is to
 * leave the project able to install our components WITHOUT this CLI.
 */
export const ensureRegistryAlias = async (
  cwd: string,
  registry: string,
): Promise<AliasResult> => {
  const file = path.join(cwd, 'components.json');

  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return { status: 'no-config' };
  }

  let config: { registries?: Record<string, string> };
  try {
    config = JSON.parse(raw) as { registries?: Record<string, string> };
  } catch {
    return { status: 'unparsable' };
  }

  if (config.registries?.[ALIAS]) return { status: 'already-present' };

  const alias = `${registry.replace(/\/+$/, '')}/r/{name}.json`;
  config.registries = { ...config.registries, [ALIAS]: alias };
  // Match shadcn's own formatting (2-space, trailing newline).
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`);
  return { status: 'added', alias };
};
