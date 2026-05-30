#!/usr/bin/env node
/**
 * @interlace/foundation — sync from @interlace/ui sources.
 *
 * Copies the five canonical stylesheets from `packages/ui/styles/` into
 * this package's `styles/` directory, then emits a barrel `index.css`
 * that `@imports` them in the correct cascade order.
 *
 * Run modes:
 *   `node scripts/sync-from-ui.mjs`         → copy + write barrel
 *   `node scripts/sync-from-ui.mjs --check` → exit 1 on drift (CI gate)
 *
 * Why this exists: `@interlace/ui` (the React-component package) and
 * `@interlace/foundation` (the CSS-only npm package) share one source of
 * truth — the styles live in `packages/ui/styles/`. This script enforces
 * that foundation is a derived artefact, not a fork. Running on
 * `prepublishOnly` refuses to publish a drifted foundation tarball.
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(PKG_DIR, '..', '..');
const UI_STYLES = path.join(REPO_ROOT, 'packages/ui/styles');
const OUT_DIR = path.join(PKG_DIR, 'styles');

// Canonical cascade order. Same five files the registry's `theme` bundle
// ships. Update both this list AND `apps/registry/scripts/build-registry.mjs`
// `STYLE_FILES` if you add a sixth.
const FILES = [
  'tokens.css',
  'foundation.css',
  'preflight.css',
  'theme.css',
  'interlace-theme.css',
];

const BARREL = `/**
 * @interlace/foundation — barrel entrypoint.
 *
 * One \`@import "@interlace/foundation"\` lands the full DS CSS contract:
 *
 *   1. tokens.css           — motion + animation keyframes.
 *   2. foundation.css       — type / spacing / radius / container scales.
 *   3. preflight.css        — focus ring (WCAG 2.2 SC 2.4.13), selection,
 *                             scrollbar tint, [data-min-viewport] container.
 *   4. theme.css             — shadcn↔fumadocs token bridge + Shiki boosts.
 *   5. interlace-theme.css   — brand violet palette (light + dark, AAA).
 *
 * If you only want a slice, import the specific file:
 *
 *   @import "@interlace/foundation/preflight.css";
 *
 * Cascade order is load-bearing — do not reorder.
 */
${FILES.map((f) => `@import "./${f}";`).join('\n')}
`;

const CHECK_ONLY = process.argv.includes('--check');

const main = async () => {
  await mkdir(OUT_DIR, { recursive: true });

  const errors = [];
  for (const name of FILES) {
    const sourcePath = path.join(UI_STYLES, name);
    const outPath = path.join(OUT_DIR, name);
    let source;
    try {
      source = await readFile(sourcePath, 'utf8');
    } catch {
      errors.push(`missing source: packages/ui/styles/${name}`);
      continue;
    }
    if (CHECK_ONLY) {
      try {
        const current = await readFile(outPath, 'utf8');
        if (source !== current) {
          errors.push(`drift: styles/${name}`);
        }
      } catch {
        errors.push(`missing dest: styles/${name}`);
      }
    } else {
      await writeFile(outPath, source, 'utf8');
    }
  }

  const barrelPath = path.join(OUT_DIR, 'index.css');
  if (CHECK_ONLY) {
    try {
      const current = await readFile(barrelPath, 'utf8');
      if (current !== BARREL) errors.push('drift: styles/index.css');
    } catch {
      errors.push('missing dest: styles/index.css');
    }
  } else {
    await writeFile(barrelPath, BARREL, 'utf8');
  }

  if (errors.length) {
    console.error(
      `@interlace/foundation: ${CHECK_ONLY ? 'drift check failed' : 'sync failed'}:\n  - ` +
        errors.join('\n  - '),
    );
    process.exit(1);
  }

  console.log(
    `@interlace/foundation: ${CHECK_ONLY ? 'OK — in sync' : 'wrote ' + (FILES.length + 1) + ' files'}.`,
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
