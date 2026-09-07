#!/usr/bin/env node
/**
 * Publish step for `interlace-ui`, the one package in this repo that IS on npm.
 *
 * It is a separate script from `release-tag.mjs` because the two packages have
 * opposite release contracts and merging them would blur the distinction that
 * `docs/philosophies/VERSIONING_PHILOSOPHY.md` § 2 is careful about:
 *
 *   @interlace/ui   private. Distributed as copied source through the registry.
 *                   Released by TAGGING — never `npm publish`.
 *   interlace-ui    public. A tool, not components: it installs from the
 *                   registry rather than duplicating it, so it creates no
 *                   second copy of anything and no second upgrade model.
 *
 * Idempotent, like its sibling: re-running on a version already on npm is a
 * no-op, which is what makes it safe in a workflow that can be re-run.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = path.join(REPO_ROOT, 'packages/cli/package.json');

const { name, version } = JSON.parse(readFileSync(PKG, 'utf8'));

const alreadyPublished = () => {
  try {
    execFileSync('npm', ['view', `${name}@${version}`, 'version'], { stdio: 'pipe' });
    return true;
  } catch {
    // `npm view` exits non-zero for a version that does not exist AND for a
    // registry that cannot be reached. Treat both as "not published" and let
    // `npm publish` be the one that decides — it fails loudly on a duplicate
    // (E409), so a network blip cannot cause a silent skip.
    return false;
  }
};

if (alreadyPublished()) {
  console.log(`${name}@${version} is already on npm — nothing to publish.`);
  process.exit(0);
}

// `prepack` in packages/cli rebuilds dist, so the tarball can never contain a
// stale build regardless of what ran before this script.
execFileSync('npm', ['publish', '--workspace', name], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
});

console.log(`Published ${name}@${version}.`);
