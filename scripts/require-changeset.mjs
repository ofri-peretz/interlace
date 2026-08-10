#!/usr/bin/env node
/**
 * CI gate: a pull request that changes the design system must add a changeset.
 *
 * The enforcement IS the feature. A changelog that depends on remembering to
 * write one stops after two releases — and for a registry that distributes
 * COPIED SOURCE, the changelog is the only upgrade path a consumer has. There
 * is no `npm update` that quietly carries a fix into their tree; if it is not
 * written down here it does not reach them at all.
 *
 * What counts as "changes the design system":
 *   packages/ui/**  MINUS the files listed in EXEMPT below.
 *
 * Usage:
 *   node scripts/require-changeset.mjs               # diffs against origin/main
 *   CHANGESET_BASE=origin/next node scripts/…        # or an explicit base
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const git = (args) =>
  execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();

/**
 * Files under packages/ui that cannot require a changeset.
 *
 *   - `package.json` + `CHANGELOG.md` are what `changeset version` itself
 *     rewrites. Requiring a changeset for them would mean the release PR needs
 *     a changeset to describe the release — a loop with no exit.
 *   - tests and internal docs change nothing in the file a consumer installs.
 */
const EXEMPT = [
  /^packages\/ui\/package\.json$/,
  /^packages\/ui\/CHANGELOG\.md$/,
  /^packages\/ui\/__tests__\//,
  /^packages\/ui\/.*\.test\.tsx?$/,
  /^packages\/ui\/[A-Z_]+\.md$/,
];

const isRelevant = (file) =>
  file.startsWith('packages/ui/') && !EXEMPT.some((re) => re.test(file));

const isChangeset = (file) =>
  file.startsWith('.changeset/') &&
  file.endsWith('.md') &&
  path.basename(file).toLowerCase() !== 'readme.md';

const resolveBase = () => {
  const explicit = process.env.CHANGESET_BASE;
  if (explicit) return explicit;
  for (const ref of ['origin/main', 'main']) {
    try {
      git(['rev-parse', '--verify', ref]);
      return ref;
    } catch {
      /* try the next */
    }
  }
  return null;
};

const main = () => {
  // The release PR that `changeset version` opens deletes changesets rather
  // than adding them; gating it would deadlock every release.
  const branch = process.env.GITHUB_HEAD_REF ?? '';
  if (branch.startsWith('changeset-release/')) {
    console.log('Release branch — changeset gate skipped.');
    return;
  }

  const base = resolveBase();
  if (!base) {
    console.log('No base branch to diff against — changeset gate skipped.');
    return;
  }

  const range = `${base}...HEAD`;
  const lines = (out) => out.split('\n').filter(Boolean);

  // Committed changes plus the working tree. In CI the tree is clean, so this
  // is exactly the PR diff; run locally before committing it still answers the
  // question honestly instead of "no changeset found" for a file you just
  // wrote.
  // `--untracked-files=all`: without it git collapses a wholly-untracked
  // directory to `?? .changeset/`, and a brand-new changeset in a brand-new
  // `.changeset/` would read as "no changeset added".
  const working = lines(
    git(['status', '--porcelain', '--untracked-files=all']),
  ).map((l) =>
    l.slice(3).replace(/^.*\s->\s/, ''),
  );
  const changed = [...lines(git(['diff', '--name-only', range])), ...working];

  const touched = [...new Set(changed.filter(isRelevant))];
  if (!touched.length) {
    console.log('No design-system changes in this PR — no changeset needed.');
    return;
  }

  const added = [
    ...new Set(
      [
        ...lines(git(['diff', '--name-only', '--diff-filter=A', range])),
        ...working,
      ].filter(isChangeset),
    ),
  ];

  if (added.length) {
    console.log(
      `OK — ${touched.length} design-system file(s) changed, ${added.length} changeset(s) added: ${added.join(', ')}`,
    );
    return;
  }

  console.error(
    [
      'Missing changeset.',
      '',
      `This PR changes ${touched.length} file(s) under packages/ui:`,
      ...touched.slice(0, 10).map((f) => `  ${f}`),
      ...(touched.length > 10 ? [`  … and ${touched.length - 10} more`] : []),
      '',
      'Run `npx changeset` and describe the change for someone who installed',
      'this component three months ago. `shadcn add` copied our source into',
      'their tree — the changelog is the only way that change reaches them.',
      '',
      'Format and the required `Components:` / `Migration:` lines:',
      '  .changeset/README.md',
    ].join('\n'),
  );
  process.exit(1);
};

main();
