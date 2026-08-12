#!/usr/bin/env node
/**
 * `npm outdated` for a registry that ships copies.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────
 *
 * `shadcn add` copies source into the consumer's tree. There is no dependency
 * edge afterwards, so there is no `npm update`, no lockfile entry, and no
 * command that answers "am I current?". The consumer owns the file; the
 * registry has no idea they exist.
 *
 * That is not a theoretical gap. On 2026-08-11 the design system's only real
 * consumer — ofriperetz.dev, 50 installed items — was measured against the
 * registry on normalised token streams. **Zero of 50 matched.** Forty were
 * strictly behind, and eighteen still imported `@base-ui-components/react`,
 * the pre-rename package: the site was running a 1.0 BETA of the primitive
 * library the design system had long since taken to 1.4 stable. Nobody knew,
 * because nobody could ask.
 *
 * The version banner (`build-registry.mjs`, `stampVersionBanner`) is the answer
 * to "which copy do I hold" — but a banner nobody reads is just a comment. This
 * is the reader.
 *
 * ─── What it reports, and what it deliberately does not ───────────────────
 *
 * Four states per file, and the third is the one that matters:
 *
 *   current  — banner version === registry version.
 *   behind   — banner version < registry version. Says by how much, and links
 *              the changelog anchor for the diff.
 *   unknown  — the file matches a registry item by name but carries NO banner.
 *              Reported as its own state rather than folded into `behind`,
 *              because they need different actions and because the honest
 *              answer is that we cannot tell. 49 of those 50 files were here.
 *   local    — no registry item of that name. Yours; not our business.
 *
 * It compares VERSIONS, not content. A consumer is expected to edit their copy
 * — that is the model — so a content diff would flag every deliberate
 * customisation as drift and be ignored within a week. `--diff` prints the
 * content comparison for one item when you actually want it.
 *
 * Exit code 1 when anything is `behind` or `unknown`, so it works in CI.
 *
 * Usage:
 *   node scripts/check-consumer.mjs <path-to-consumer>
 *   node scripts/check-consumer.mjs <path-to-consumer> --registry http://localhost:4178
 *   node scripts/check-consumer.mjs <path-to-consumer> --diff button
 *   node scripts/check-consumer.mjs <path-to-consumer> --json
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { HOMEPAGE } from '../registry.config.mjs';

const args = process.argv.slice(2);

/**
 * A single positional scan, because the previous version used
 * `args.indexOf(a)` to ask "is the token before me a flag?" — and `indexOf`
 * returns the FIRST occurrence, not the current one. So
 * `check-consumer.mjs http://foo --registry http://foo` looked up position 0
 * for the second `http://foo`, decided its predecessor was not a flag, and
 * accepted the SAME string as both the consumer directory and the registry
 * URL. Any argument whose value repeats elsewhere on the line was parsed
 * against the wrong position.
 *
 * Walking once and consuming each flag's value as we pass it has no such
 * ambiguity, and it is shorter.
 */
const VALUE_FLAGS = new Set(['--registry', '--diff']);
const opts = { registry: null, diff: null, json: false };
let consumerDir = null;
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (VALUE_FLAGS.has(arg)) {
    opts[arg.slice(2)] = args[i + 1] ?? null;
    i += 1;
  } else if (arg === '--json') {
    opts.json = true;
  } else if (!arg.startsWith('--') && consumerDir === null) {
    consumerDir = arg;
  }
}
const flag = (name) => opts[name];
const asJson = opts.json;
const diffItem = opts.diff;

if (!consumerDir) {
  console.error('usage: check-consumer.mjs <path-to-consumer> [--registry <url>] [--diff <item>] [--json]');
  process.exit(2);
}

/**
 * The banner `stampVersionBanner` writes, read back.
 *
 * Anchored on the `@interlace/<name> v<x.y.z>` line specifically. A looser
 * match would also hit the docs URLs on the following two lines and, worse,
 * any prose in the component's own header that happens to mention a version.
 */
const BANNER_RE = /^\/\/ @interlace\/([\w-]+) v(\d+\.\d+\.\d+)\b/m;

const cmp = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
};

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

/**
 * Where the consumer's installed components live, per their own aliases.
 *
 * Read from `components.json` rather than assumed: the `ui` alias is
 * configurable and a consumer who moved it would otherwise get a clean bill of
 * health over an empty directory — a false pass, which is the worst outcome a
 * checker can produce.
 */
const resolveUiDir = (root, components) => {
  const alias = components.aliases?.ui ?? '@/components/ui';
  const rel = alias.replace(/^@\//, '');
  return [path.join(root, 'src', rel), path.join(root, rel)];
};

const main = async () => {
  const root = path.resolve(consumerDir);
  let components;
  try {
    components = await readJson(path.join(root, 'components.json'));
  } catch {
    console.error(`No components.json in ${root} — is that a shadcn consumer?`);
    process.exit(2);
  }

  const candidates = resolveUiDir(root, components);
  let uiDir = null;
  let files = [];
  for (const dir of candidates) {
    try {
      // RECURSIVE, and that is not a nicety. The registry nests its
      // decorative and pattern tiers (`aceternity/`, `magicui/`,
      // `patterns/`) to preserve provenance, so a top-level-only scan misses
      // them — measured: 23 of 50 items on the first consumer we ran this
      // against. It reported "29 installed" over a tree of 52 files and
      // looked entirely healthy, which is the exact false pass this file's
      // header warns about, produced by the checker itself.
      files = (await readdir(dir, { recursive: true })).filter((f) =>
        /\.tsx?$/.test(f),
      );
      uiDir = dir;
      break;
    } catch {
      /* try the next candidate */
    }
  }
  if (!uiDir) {
    console.error(`Could not find the installed components. Looked in:\n  ${candidates.join('\n  ')}`);
    process.exit(2);
  }

  // Prefer the registry the consumer actually installs from — checking against
  // a different one than they use is how you certify the wrong catalogue.
  const declared = Object.values(components.registries ?? {})[0];
  const origin =
    flag('registry') ??
    (typeof declared === 'string' ? declared.replace(/\/r\/.*$/, '') : HOMEPAGE);

  const index = await fetch(`${origin}/r/index.json`).then((r) => {
    if (!r.ok) throw new Error(`${origin}/r/index.json → ${r.status}`);
    return r.json();
  });
  const versions = new Map();
  await Promise.all(
    index.items.map(async (i) => {
      const item = await fetch(`${origin}/r/${i.name}.json`).then((r) => r.json());
      versions.set(i.name, { version: item.meta?.version ?? null, item });
    }),
  );

  /**
   * Files an item ships ALONGSIDE its own — `button-variants.ts`,
   * `skeleton-variants.ts`, the model modules. `stampVersionBanner` puts the
   * banner on the item's own file only, deliberately: four banners in one
   * install is noise the consumer reads past every time they open it.
   *
   * So a companion has no banner BY DESIGN, and reporting it as `unversioned`
   * would be a false alarm that trains the reader to ignore the real ones.
   */
  const companions = new Set();
  for (const { item } of versions.values()) {
    for (const f of (item.files ?? []).slice(1)) {
      companions.add(path.basename(f.target));
    }
  }

  const rows = [];
  for (const file of files.sort()) {
    const base = path.basename(file);
    const name = base.replace(/\.tsx?$/, '');
    const source = await readFile(path.join(uiDir, file), 'utf8');
    const known = versions.get(name);
    if (!known) {
      rows.push({ file, state: companions.has(base) ? 'companion' : 'local' });
      continue;
    }
    const banner = BANNER_RE.exec(source);
    if (!banner) {
      // A companion that is ALSO published as an item of its own (so `known`
      // resolved) still arrives without a banner when it came in as somebody
      // else's companion. Same reason, same non-alarm.
      rows.push({
        file,
        state: companions.has(base) ? 'companion' : 'unknown',
        latest: known.version,
      });
      continue;
    }
    const held = banner[2];
    rows.push({
      file,
      state: cmp(held, known.version) < 0 ? 'behind' : 'current',
      held,
      latest: known.version,
    });
  }

  if (diffItem && typeof diffItem === 'string') {
    const known = versions.get(diffItem);
    if (!known) {
      console.error(`No registry item named "${diffItem}".`);
      process.exit(2);
    }
    const shipped = known.item.files?.[0];
    const local = await readFile(path.join(uiDir, path.basename(shipped.target)), 'utf8');
    const strip = (s) =>
      s
        .replace(/\/\*(?:[^*]|\*(?!\/))*\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/"/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    console.log(
      strip(local) === strip(shipped.content)
        ? `${diffItem}: identical to the registry, ignoring comments and formatting.`
        : `${diffItem}: content differs from the registry (${strip(local).length} vs ${strip(shipped.content).length} chars, comments and formatting normalised).`,
    );
    return;
  }

  if (asJson) {
    console.log(JSON.stringify({ registry: origin, uiDir, rows }, null, 2));
  } else {
    const count = (s) => rows.filter((r) => r.state === s).length;
    for (const r of rows) {
      if (r.state === 'current') continue;
      const label = { behind: 'BEHIND ', unknown: 'UNKNOWN', local: 'local  ', companion: 'part of' }[r.state];
      const detail =
        r.state === 'behind'
          ? `v${r.held} → v${r.latest}   ${origin}/c/${r.file.replace(/\.tsx?$/, '')}#history`
          : r.state === 'unknown'
            ? `no version banner — registry is at v${r.latest}`
            : r.state === 'companion'
              ? 'shipped as part of another item — no banner by design'
              : 'not a registry item';
      console.log(`  ${label}  ${r.file.padEnd(38)} ${detail}`);
    }
    console.log(
      `\n${rows.length} installed · ${count('current')} current · ${count('behind')} behind · ` +
        `${count('unknown')} unversioned · ${count('companion')} companion · ${count('local')} local`,
    );
    if (count('unknown')) {
      console.log(
        '\nAn unversioned file was installed before the version banner shipped, or had its\n' +
          'leading comments stripped. Re-add it to adopt a version you can track:\n' +
          `  npx shadcn@latest add ${origin}/r/<name>.json`,
      );
    }
  }

  const stale = rows.filter((r) => r.state === 'behind' || r.state === 'unknown');
  process.exit(stale.length ? 1 : 0);
};

await main();
