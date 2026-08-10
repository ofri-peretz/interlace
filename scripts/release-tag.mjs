#!/usr/bin/env node
/**
 * "Publish" step for a package that is deliberately NOT published to npm.
 *
 * `@interlace/ui` is `private: true` and stays that way — see
 * `docs/philosophies/VERSIONING_PHILOSOPHY.md` § "Private, and still
 * versioned". Distribution is the shadcn registry at ds.interlace.tools, which
 * hands consumers a COPY of the source; a parallel npm package would be a
 * second distribution channel with a different upgrade model, and the two
 * would disagree the first time someone edited their copy.
 *
 * So the release action is not `npm publish`. It is:
 *
 *   1. tag the commit `@interlace/ui@<version>` (the tag changesets expects,
 *      and the anchor `derive-component-versions.mjs` reads to answer "which
 *      release did this component first ship in");
 *   2. push the tag, so the registry deploy for that commit is identifiable.
 *
 * Idempotent: re-running on an already-tagged version is a no-op, which is
 * what makes it safe to wire into a workflow that can re-run.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = path.join(REPO_ROOT, 'packages/ui/package.json');

const git = (args) =>
  execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();

const { version } = JSON.parse(readFileSync(PKG, 'utf8'));
const tag = `@interlace/ui@${version}`;

const existing = git(['tag', '--list', tag]);
if (existing) {
  console.log(`${tag} already exists — nothing to release.`);
  process.exit(0);
}

git(['tag', '-a', tag, '-m', `@interlace/ui ${version}`]);
console.log(`Tagged ${tag}.`);

if (process.env.SKIP_TAG_PUSH === '1') {
  console.log('SKIP_TAG_PUSH=1 — not pushing.');
  process.exit(0);
}

git(['push', 'origin', tag]);
console.log(`Pushed ${tag}. Release notes: https://ds.interlace.tools/changelog#v${version}`);
