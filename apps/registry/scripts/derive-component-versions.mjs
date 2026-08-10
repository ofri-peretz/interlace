#!/usr/bin/env node
/**
 * Derive a per-component version manifest from git history.
 *
 * Output: `apps/registry/component-versions.json` — one
 * `{ name, version, since, updated, deprecated? }` record per registry item.
 * `build-registry.mjs` reads it and publishes `meta.version` / `meta.since` on
 * every item plus a banner inside the file the consumer installs.
 *
 * ─── Why derived, and why not at build time ─────────────────────────────────
 *
 * A hand-maintained per-component version rots within a month: nobody
 * remembers to bump `badge` because they changed `badge-variants.ts`. So the
 * version is computed from the component's own git history — its file, its
 * companions (`*-variants.ts`, `scale.ts`), and its optional `<name>.meta.json`.
 *
 * But it is computed HERE and committed, never computed inside the registry
 * build. If `meta.version` were a function of `git HEAD`, every commit would
 * rewrite all 128 item JSONs and the registry drift gate
 * (`build-registry.mjs --check`) would fail forever after. Committing the
 * manifest keeps the registry build a pure function of tracked files:
 *
 *     git history ──(this script, on demand / at release)──▶ manifest (committed)
 *     manifest    ──(build-registry.mjs, deterministic)────▶ public/r/*.json
 *
 * The gate that CI runs on every PR is therefore a COMPLETENESS check
 * (`--check` below: every item has an entry, every entry is valid semver, no
 * entry outlives its item), not a recomputation. Completeness is HEAD-
 * independent; recomputation is not.
 *
 * ─── How a version is computed ──────────────────────────────────────────────
 *
 * Walk every non-merge commit touching the component's files, oldest first:
 *
 *   - the FIRST such commit establishes `1.0.0` (a shipped component is not
 *     `0.x`; the DS ships it, therefore it has a contract);
 *   - each later commit applies its conventional-commit bump:
 *       `feat!:` / `BREAKING CHANGE:` → major
 *       `feat:`                       → minor
 *       `fix:` `perf:` `refactor:` `revert:` `style:` → patch
 *       `chore: docs: test: ci: build:` → nothing (no consumer-visible change)
 *
 * `since` is the @interlace/ui release the component first shipped in, read
 * from the release tags changesets writes (`@interlace/ui@X.Y.Z`) via
 * `git tag --contains <first-commit>`. Components whose first commit predates
 * any tag get the current package version — correct for the first release,
 * self-maintaining after it.
 *
 * `deprecated` is NEVER derived — git cannot know a component is on its way
 * out. It is authored by hand in the manifest and preserved across every
 * regeneration (see MERGE below).
 *
 * Usage:
 *   node scripts/derive-component-versions.mjs            # rewrite the manifest
 *   node scripts/derive-component-versions.mjs --check    # validate it (CI)
 */

import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildAll, SOURCE_PATHS } from './build-registry.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(REGISTRY_ROOT, '..', '..');
const MANIFEST = path.join(REGISTRY_ROOT, 'component-versions.json');
const PKG = path.join(REPO_ROOT, 'packages/ui/package.json');

const CHECK_ONLY = process.argv.includes('--check');

/** Directories whose history can change a component. */
const HISTORY_PATHS = [
  'packages/ui/src',
  'packages/ui/styles',
  'apps/registry/scripts/build-registry.mjs',
];

const git = (args) =>
  execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ─── semver, the 30 lines of it we need ──────────────────────────────────────

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

export const parseSemver = (v) => {
  const m = SEMVER_RE.exec(String(v ?? ''));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

export const compareSemver = (a, b) => {
  const pa = parseSemver(a) ?? [0, 0, 0];
  const pb = parseSemver(b) ?? [0, 0, 0];
  for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};

export const applyBump = (version, bump) => {
  const [maj, min, pat] = parseSemver(version) ?? [1, 0, 0];
  if (bump === 'major') return `${maj + 1}.0.0`;
  if (bump === 'minor') return `${maj}.${min + 1}.0`;
  if (bump === 'patch') return `${maj}.${min}.${pat + 1}`;
  return version;
};

// ─── conventional commits ────────────────────────────────────────────────────

const HEADER_RE = /^(\w+)(?:\(([^)]*)\))?(!)?:\s/;

const BUMP_BY_TYPE = {
  feat: 'minor',
  fix: 'patch',
  perf: 'patch',
  refactor: 'patch',
  revert: 'patch',
  style: 'patch',
};

/**
 * The bump a commit implies for a component it touched. `null` means "no
 * consumer-visible change" — a `chore:` that reformats a file must not move a
 * version a consumer reads as "something changed for me".
 */
export const bumpForCommit = ({ subject, body }) => {
  const m = HEADER_RE.exec(subject);
  if (!m) return 'patch'; // non-conventional subject: assume it did something
  const [, type, , bang] = m;
  if (bang || /^BREAKING[ -]CHANGE:/m.test(body ?? '')) return 'major';
  return BUMP_BY_TYPE[type] ?? null;
};

// ─── git history, read once ──────────────────────────────────────────────────

/**
 * Commit bodies contain blank lines and arbitrary prose, so the record and
 * field separators have to be bytes that cannot appear inside one. `%x01` /
 * `%x02` / `%x03` are git's own escape for exactly this.
 */
const RECORD_SEP = '\u0001';
const FIELD_SEP = '\u0002';
const BODY_END = '\u0003';

/**
 * Every non-merge commit touching the DS, oldest first, with its file list.
 *
 * One `git log` for the whole repo rather than one per component: 128 items ×
 * a process spawn each is 128 spawns and a different answer per invocation
 * order. Merges are excluded because this repo squash-merges — a merge commit
 * would double-count every change in the PR it merged.
 */
const readHistory = () => {
  const raw = git([
    'log',
    '--no-merges',
    '--reverse',
    '--name-only',
    `--format=${RECORD_SEP}%H${FIELD_SEP}%aI${FIELD_SEP}%s${FIELD_SEP}%b${BODY_END}`,
    '--',
    ...HISTORY_PATHS,
  ]);
  const commits = [];
  for (const chunk of raw.split(RECORD_SEP)) {
    if (!chunk.trim()) continue;
    const [meta, filesBlock = ''] = chunk.split(BODY_END);
    const [hash, date, subject, body] = meta.split(FIELD_SEP);
    commits.push({
      hash,
      date: (date ?? '').slice(0, 10),
      subject: subject ?? '',
      body: body ?? '',
      files: filesBlock
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean),
    });
  }
  return commits;
};

/** Release tags changesets writes for the package. */
const readReleaseTags = () => {
  let out = '';
  try {
    out = git(['tag', '--list', '@interlace/ui@*']);
  } catch {
    return [];
  }
  return out
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((tag) => ({ tag, version: tag.replace('@interlace/ui@', '') }))
    .filter((t) => parseSemver(t.version))
    .sort((a, b) => compareSemver(a.version, b.version));
};

const firstReleaseContaining = (hash, tags, fallback) => {
  for (const t of tags) {
    try {
      const contains = git(['tag', '--contains', hash, '--list', t.tag]).trim();
      if (contains) return t.version;
    } catch {
      /* tag gone — try the next */
    }
  }
  return fallback;
};

// ─── derivation ──────────────────────────────────────────────────────────────

export const deriveVersions = ({ names, sourcePaths, commits, tags, packageVersion }) => {
  // file → items that file belongs to. One pass over the commit list then
  // becomes O(files) rather than O(items × files).
  const owners = new Map();
  for (const name of names) {
    for (const file of sourcePaths.get(name) ?? []) {
      if (!owners.has(file)) owners.set(file, new Set());
      owners.get(file).add(name);
    }
  }

  const state = new Map(
    names.map((n) => [n, { version: null, firstHash: null, updated: null }]),
  );

  for (const commit of commits) {
    const touched = new Set();
    for (const file of commit.files) {
      for (const name of owners.get(file) ?? []) touched.add(name);
    }
    if (!touched.size) continue;
    const bump = bumpForCommit(commit);
    for (const name of touched) {
      const s = state.get(name);
      if (!s.version) {
        // Introduction. A component the DS ships has a contract, so it starts
        // at 1.0.0 — never 0.x, which would advertise "no promises" about
        // source that is already installed in other people's trees.
        s.version = '1.0.0';
        s.firstHash = commit.hash;
        s.updated = commit.date;
        continue;
      }
      if (!bump) continue;
      s.version = applyBump(s.version, bump);
      s.updated = commit.date;
    }
  }

  return names.map((name) => {
    const s = state.get(name);
    return {
      name,
      // An item with no history at all (brand-new file, not yet committed)
      // still gets a version — it is about to ship, and shipping without one
      // is the hole this whole phase exists to close.
      version: s.version ?? '1.0.0',
      since: s.firstHash
        ? firstReleaseContaining(s.firstHash, tags, packageVersion)
        : packageVersion,
      updated: s.updated,
    };
  });
};

// ─── manifest I/O ────────────────────────────────────────────────────────────

const readManifest = async () => {
  try {
    return JSON.parse(await readFile(MANIFEST, 'utf8'));
  } catch {
    return null;
  }
};

/**
 * MERGE, not overwrite.
 *
 *   - `deprecated` is hand-authored; regeneration must never drop it.
 *   - a published version must never go backwards. If a rebase, a squash or a
 *     `chore:`-only history makes the derived version lower than what we
 *     already published, keep the published one and say so. Consumers have the
 *     old number written into their files; moving it down makes the diff lie.
 */
const mergeWithPrevious = (derived, previous) => {
  const before = new Map((previous?.components ?? []).map((c) => [c.name, c]));
  const clamped = [];
  const merged = derived.map((entry) => {
    const prev = before.get(entry.name);
    if (!prev) return entry;
    const out = { ...entry };
    if (compareSemver(entry.version, prev.version) < 0) {
      clamped.push(`${entry.name}: derived ${entry.version} < published ${prev.version}`);
      out.version = prev.version;
    }
    if (prev.deprecated) out.deprecated = prev.deprecated;
    return out;
  });
  return { merged, clamped };
};

const manifestPayload = (components, packageVersion) => ({
  $comment:
    'GENERATED by apps/registry/scripts/derive-component-versions.mjs from git history. Do not hand-edit `version` / `since` / `updated` — they will be overwritten. `deprecated` IS hand-authored and is preserved across regeneration. See docs/philosophies/VERSIONING_PHILOSOPHY.md.',
  packageVersion,
  components,
});

// ─── check mode (what CI runs) ───────────────────────────────────────────────

const check = (manifest, names, packageVersion) => {
  const errors = [];
  if (!manifest) return ['component-versions.json is missing'];
  if (manifest.packageVersion !== packageVersion) {
    errors.push(
      `packageVersion ${manifest.packageVersion} != packages/ui/package.json ${packageVersion}`,
    );
  }
  const byName = new Map(manifest.components.map((c) => [c.name, c]));
  for (const name of names) {
    const entry = byName.get(name);
    if (!entry) {
      errors.push(`no entry for registry item "${name}"`);
      continue;
    }
    if (!parseSemver(entry.version)) {
      errors.push(`${name}: invalid version "${entry.version}"`);
    }
    if (!parseSemver(entry.since)) {
      errors.push(`${name}: invalid since "${entry.since}"`);
    }
    if (entry.deprecated && !parseSemver(entry.deprecated.removedIn)) {
      errors.push(
        `${name}: deprecated.removedIn must be a version ("${entry.deprecated.removedIn}") — a deprecation with no removal release is a permanent one`,
      );
    }
  }
  const shipped = new Set(names);
  for (const entry of manifest.components) {
    if (!shipped.has(entry.name)) {
      errors.push(`entry "${entry.name}" names no registry item`);
    }
  }
  return errors;
};

// ─── main ────────────────────────────────────────────────────────────────────

const main = async () => {
  const { items } = await buildAll();
  const names = items.map((i) => i.name).sort();
  const packageVersion = JSON.parse(await readFile(PKG, 'utf8')).version;
  const previous = await readManifest();

  if (CHECK_ONLY) {
    const errors = check(previous, names, packageVersion);
    if (errors.length) {
      console.error(
        'component-versions.json is out of contract:\n  ' + errors.join('\n  '),
      );
      process.exit(1);
    }
    console.log(`OK — ${names.length} item(s) versioned, package ${packageVersion}.`);
    return;
  }

  const derived = deriveVersions({
    names,
    sourcePaths: SOURCE_PATHS,
    commits: readHistory(),
    tags: readReleaseTags(),
    packageVersion,
  });
  const { merged, clamped } = mergeWithPrevious(derived, previous);
  await writeFile(
    MANIFEST,
    JSON.stringify(manifestPayload(merged, packageVersion), null, 2) + '\n',
    'utf8',
  );
  for (const line of clamped) console.warn(`kept published version — ${line}`);
  console.log(
    `Derived ${merged.length} component version(s) → ${path.relative(REPO_ROOT, MANIFEST)}`,
  );
  console.log('Now run `npm run registry:build` so the items pick the new versions up.');
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
