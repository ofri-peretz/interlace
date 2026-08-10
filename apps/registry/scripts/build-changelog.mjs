#!/usr/bin/env node
/**
 * Compile the public release notes into `public/data/changelog.json`.
 *
 * ONE source, TWO views (phase 9.3): `/changelog` renders every release, and
 * each component page renders the subset that names it. Both read this JSON —
 * there is no second copy of the notes anywhere, and no hand-maintained list
 * of "what changed in badge".
 *
 * Inputs:
 *
 *   - `packages/ui/CHANGELOG.md`  — released notes. Written by
 *                                   `changeset version`; the baseline 1.0.0
 *                                   entry is authored in the same shape.
 *   - `.changeset/*.md`           — notes for the NEXT release, not yet cut.
 *                                   Rendered as "Unreleased" so a reviewer can
 *                                   see the release forming.
 *
 * Entry grammar (documented for humans in `.changeset/README.md`):
 *
 *   - the first paragraph is the note;
 *   - `Components: a, b` names the registry items it touched (`none` is a
 *     legal, explicit answer);
 *   - `Kind: Added|Changed|Breaking` overrides the bump→kind default;
 *   - `Migration: …` is MANDATORY on a major, because a breaking change to
 *     source somebody already copied into their tree is unactionable without
 *     the literal edit they have to make.
 *
 * Those three rules are enforced here rather than in review: run with
 * `--check` (CI does) and a missing migration note or a typo'd component name
 * fails the build instead of shipping a dead link.
 */

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(REGISTRY_ROOT, '..', '..');
const CHANGELOG_MD = path.join(REPO_ROOT, 'packages/ui/CHANGELOG.md');
const CHANGESET_DIR = path.join(REPO_ROOT, '.changeset');
const INDEX_JSON = path.join(REGISTRY_ROOT, 'public/r/index.json');
const OUT_FILE = path.join(REGISTRY_ROOT, 'public/data/changelog.json');

const CHECK_ONLY = process.argv.includes('--check');

/** bump → the heading a reader scans for. */
const KIND_BY_BUMP = { major: 'Breaking', minor: 'Added', patch: 'Changed' };
export const KINDS = ['Breaking', 'Added', 'Changed'];

const BUMP_BY_HEADING = {
  'major changes': 'major',
  'minor changes': 'minor',
  'patch changes': 'patch',
};

// ─── entry body parsing ──────────────────────────────────────────────────────

const FIELD_RE = /^(Components|Kind|Migration):\s*/i;

/**
 * Split a raw entry body into `{ summary, components, kind, migration }`.
 *
 * Fields are line-prefixed and may wrap: everything up to the next field
 * keyword (or the end) belongs to the field that opened. That is what lets a
 * `Migration:` note be three paragraphs of instructions, which is what a real
 * one usually is.
 */
export const parseEntryBody = (body, bump) => {
  const lines = body.split('\n');
  const summary = [];
  const fields = {};
  let current = null;
  for (const line of lines) {
    const m = FIELD_RE.exec(line.trim());
    if (m) {
      current = m[1].toLowerCase();
      fields[current] = [line.trim().slice(m[0].length)];
      continue;
    }
    if (current) fields[current].push(line.trim());
    else summary.push(line.trim());
  }
  const joined = (key) => (fields[key] ?? []).join(' ').replace(/\s+/g, ' ').trim();
  const rawComponents = joined('components');
  const kind = (() => {
    const k = joined('kind');
    const match = KINDS.find((v) => v.toLowerCase() === k.toLowerCase());
    return match ?? KIND_BY_BUMP[bump] ?? 'Changed';
  })();
  return {
    summary: summary.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    // `none` is an explicit "touches no shipped item", distinct from a missing
    // line — which is an authoring mistake `--check` refuses to let through.
    components:
      rawComponents.toLowerCase() === 'none'
        ? []
        : rawComponents
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
    componentsDeclared: Boolean(fields.components),
    kind,
    bump,
    migration: (fields.migration ?? []).join('\n').trim() || null,
  };
};

// ─── CHANGELOG.md (released) ─────────────────────────────────────────────────

const VERSION_HEADING_RE = /^##\s+(\d+\.\d+\.\d+)\s*$/;
const SECTION_HEADING_RE = /^###\s+(.+?)\s*$/;
const BULLET_RE = /^-\s+(.*)$/;
/** `- 1a2b3c4: text` and `- [#12](url) 1a2b3c4: text` both come out of changesets. */
const BULLET_PREFIX_RE = /^(?:\[#\d+\]\([^)]*\)\s*)?[0-9a-f]{7,40}:\s*/i;

export const parseChangelogMarkdown = (markdown) => {
  const releases = [];
  let release = null;
  let bump = 'patch';
  let entryLines = null;

  const flushEntry = () => {
    if (!entryLines || !release) return;
    const raw = entryLines.join('\n');
    release.entries.push({
      ...parseEntryBody(raw.replace(BULLET_PREFIX_RE, ''), bump),
      source: `CHANGELOG.md#${release.version}`,
    });
    entryLines = null;
  };

  for (const line of markdown.split('\n')) {
    const versionMatch = VERSION_HEADING_RE.exec(line);
    if (versionMatch) {
      flushEntry();
      release = { version: versionMatch[1], unreleased: false, entries: [] };
      releases.push(release);
      continue;
    }
    if (!release) continue;
    const sectionMatch = SECTION_HEADING_RE.exec(line);
    if (sectionMatch) {
      flushEntry();
      bump = BUMP_BY_HEADING[sectionMatch[1].toLowerCase()] ?? 'patch';
      continue;
    }
    const bulletMatch = BULLET_RE.exec(line);
    if (bulletMatch) {
      flushEntry();
      entryLines = [bulletMatch[1]];
      continue;
    }
    if (entryLines) entryLines.push(line);
  }
  flushEntry();
  return releases;
};

// ─── .changeset/*.md (unreleased) ────────────────────────────────────────────

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const BUMP_LINE_RE = /['"]?@interlace\/ui['"]?\s*:\s*(major|minor|patch)/i;

export const parseChangeset = (source, id) => {
  const m = FRONTMATTER_RE.exec(source);
  if (!m) return null;
  const bumpMatch = BUMP_LINE_RE.exec(m[1]);
  if (!bumpMatch) return null; // a changeset for some other package
  return {
    ...parseEntryBody(source.slice(m[0].length).trim(), bumpMatch[1].toLowerCase()),
    source: `.changeset/${id}`,
  };
};

// ─── validation ──────────────────────────────────────────────────────────────

const RELEASE_RANK = { Breaking: 0, Added: 1, Changed: 2 };

export const validate = (releases, itemNames) => {
  const errors = [];
  for (const release of releases) {
    const where = release.unreleased ? 'unreleased' : `v${release.version}`;
    for (const entry of release.entries) {
      const head = `${where} — "${entry.summary.slice(0, 60)}…"`;
      if (!entry.summary) errors.push(`${where}: an entry has no summary`);
      if (!entry.componentsDeclared) {
        errors.push(
          `${head}: no \`Components:\` line. Name the registry items this touched, or write \`Components: none\`.`,
        );
      }
      for (const name of entry.components) {
        if (!itemNames.has(name)) {
          errors.push(`${head}: "${name}" is not a registry item`);
        }
      }
      if (entry.kind === 'Breaking' && !entry.migration) {
        errors.push(
          `${head}: a breaking change needs a \`Migration:\` note — the consumer already owns a copy of this source and cannot npm-update out of it.`,
        );
      }
    }
  }
  return errors;
};

// ─── build ───────────────────────────────────────────────────────────────────

export const buildChangelog = async () => {
  const released = parseChangelogMarkdown(await readFile(CHANGELOG_MD, 'utf8'));

  const files = (await readdir(CHANGESET_DIR))
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort();
  const pending = [];
  for (const file of files) {
    const entry = parseChangeset(
      await readFile(path.join(CHANGESET_DIR, file), 'utf8'),
      file,
    );
    if (entry) pending.push(entry);
  }

  const releases = [
    ...(pending.length
      ? [{ version: 'Unreleased', unreleased: true, entries: pending }]
      : []),
    ...released,
  ];
  // Breaking first inside a release: it is the only kind a reader MUST act on.
  for (const release of releases) {
    release.entries.sort(
      (a, b) => (RELEASE_RANK[a.kind] ?? 9) - (RELEASE_RANK[b.kind] ?? 9),
    );
  }
  return { releases };
};

const loadItemNames = async () => {
  try {
    const index = JSON.parse(await readFile(INDEX_JSON, 'utf8'));
    return new Set(index.items.map((i) => i.name));
  } catch {
    return null;
  }
};

const main = async () => {
  const payload = await buildChangelog();
  const itemNames = await loadItemNames();
  if (itemNames) {
    const errors = validate(payload.releases, itemNames);
    if (errors.length) {
      console.error('Changelog contract violated:\n  ' + errors.join('\n  '));
      process.exit(1);
    }
  }

  const serialised = JSON.stringify(payload, null, 2) + '\n';
  if (CHECK_ONLY) {
    const current = await readFile(OUT_FILE, 'utf8').catch(() => null);
    if (current !== serialised) {
      console.error(
        'changelog.json is stale — run `npm run changelog:build --workspace=registry`.',
      );
      process.exit(1);
    }
    console.log(`OK — ${payload.releases.length} release(s) match on-disk.`);
    return;
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, serialised, 'utf8');
  const entries = payload.releases.reduce((n, r) => n + r.entries.length, 0);
  console.log(
    `build-changelog: ${payload.releases.length} release(s), ${entries} entr(ies) → apps/registry/public/data/changelog.json`,
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
