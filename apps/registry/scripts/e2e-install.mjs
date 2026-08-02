#!/usr/bin/env node
/**
 * End-to-end installability proof for EVERY registry item.
 *
 * A registry that publishes JSON is not the same as a registry that installs.
 * This scaffolds a real Next.js app, points the shadcn CLI at our registry,
 * installs every item, wires the CSS baseline into the app's global
 * stylesheet, and runs `next build` — which type-checks all installed sources
 * in a tree that has none of our workspace aliases to fall back on.
 *
 *   node scripts/e2e-install.mjs                  # against ./public (local)
 *   node scripts/e2e-install.mjs --url https://ds.interlace.tools
 *   node scripts/e2e-install.mjs --keep           # leave the scratch app
 *   node scripts/e2e-install.mjs --only button,card
 *
 * Results are written to `e2e-install-results.json` (committed) so the last
 * verified state is reviewable without re-running the ~5-minute job.
 *
 * Strategy: one batched `shadcn add` of every item (fast, and its exit code
 * answers "does the registry install at all"), then a per-item check that each
 * declared `target` actually landed on disk — that gives per-item attribution
 * without paying for 120 separate CLI invocations.
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { HOMEPAGE as PROD_ORIGIN } from '../registry.config.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_ROOT = path.resolve(SCRIPT_DIR, '..');
const PUBLIC_DIR = path.join(REGISTRY_ROOT, 'public');
const RESULTS_FILE = path.join(REGISTRY_ROOT, 'e2e-install-results.json');

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : (argv[i + 1] ?? '');
};
const KEEP = argv.includes('--keep');
const REMOTE_URL = flag('url');
const ONLY = flag('only')?.split(',').filter(Boolean) ?? null;

// ─── Minimal static server for public/ ───────────────────────────────────────

const MIME = { '.json': 'application/json', '.css': 'text/css' };

/**
 * Items reference each other by absolute production URL (they have to — see
 * `itemRef` in build-registry.mjs). To exercise the SHIPPED artifacts against
 * a local server, rewrite that origin in flight rather than rebuilding the
 * registry with a different base URL: the bytes under test stay the committed
 * ones, only the host changes.
 */
const serve = () =>
  new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      // ponytail: path.join + a startsWith guard is the whole traversal
      // defence needed — this server only ever runs on localhost in CI. The
      // trailing separator matters: without it a sibling `public-extra/`
      // would pass the prefix test.
      const file = path.join(PUBLIC_DIR, rel);
      if (!file.startsWith(PUBLIC_DIR + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      try {
        let body = await readFile(file);
        if (path.extname(file) === '.json') {
          const origin = `http://127.0.0.1:${server.address().port}`;
          body = body.toString('utf8').replaceAll(PROD_ORIGIN, origin);
        }
        res.writeHead(200, {
          'content-type': MIME[path.extname(file)] ?? 'text/plain',
        });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` }),
    );
  });

// ─── Subprocess helper ───────────────────────────────────────────────────────

const run = (cmd, args, cwd, { quiet = false } = {}) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, CI: '1', NEXT_TELEMETRY_DISABLED: '1' },
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let out = '';
    child.stdout?.on('data', (d) => (out += d));
    child.stderr?.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });

const tail = (s, n = 2000) => (s.length > n ? `…${s.slice(-n)}` : s);

// ─── Main ────────────────────────────────────────────────────────────────────

const main = async () => {
  const started = Date.now();
  let server = null;
  let baseUrl = REMOTE_URL;

  if (!baseUrl) {
    const s = await serve();
    server = s.server;
    baseUrl = s.url;
    console.log(`serving ${PUBLIC_DIR} at ${baseUrl}`);
  }

  const index = JSON.parse(
    await readFile(path.join(PUBLIC_DIR, 'r', 'index.json'), 'utf8'),
  );
  const itemNames = index.items
    .map((i) => i.name)
    .filter((n) => !ONLY || ONLY.includes(n));

  const scratchRoot = await mkdtemp(path.join(tmpdir(), 'interlace-e2e-'));
  const app = path.join(scratchRoot, 'app');
  const results = {
    generatedAt: new Date().toISOString(),
    registryUrl: REMOTE_URL ?? '(local public/)',
    itemCount: itemNames.length,
    steps: {},
    items: {},
  };

  const finish = async (exitCode) => {
    results.durationSeconds = Math.round((Date.now() - started) / 1000);
    results.ok = exitCode === 0;
    // A `--only` run is a partial: writing it would replace the committed
    // record of the last FULL 120/120 pass with a two-item file.
    const resultsPath = ONLY
      ? RESULTS_FILE.replace(/\.json$/, '.partial.json')
      : RESULTS_FILE;
    await writeFile(resultsPath, JSON.stringify(results, null, 2) + '\n');
    server?.close();
    if (!KEEP) await rm(scratchRoot, { recursive: true, force: true });
    else console.log(`scratch app kept at ${app}`);
    console.log(
      `${results.ok ? 'PASS' : 'FAIL'} — results written to ${resultsPath}`,
    );
    process.exit(exitCode);
  };

  // 1. Scaffold a real Next.js app, then shadcn-init it. Two steps rather
  //    than `shadcn init --template next`, which still prompts for a project
  //    name even under `-d` and so can't run unattended.
  console.log('\n▸ scaffolding Next.js app …');
  const create = await run(
    'npx',
    [
      '--yes',
      'create-next-app@latest',
      'app',
      '--ts',
      '--tailwind',
      '--app',
      '--no-eslint',
      '--no-src-dir',
      '--use-npm',
      '--yes',
    ],
    scratchRoot,
    { quiet: true },
  );
  results.steps.createNextApp = {
    ok: create.code === 0,
    log: tail(create.out),
  };
  if (create.code !== 0) {
    console.error(create.out);
    return finish(1);
  }

  const scaffold = await run(
    'npx',
    ['--yes', 'shadcn@latest', 'init', '-d'],
    app,
    { quiet: true },
  );
  results.steps.shadcnInit = { ok: scaffold.code === 0, log: tail(scaffold.out) };
  if (scaffold.code !== 0) {
    console.error(scaffold.out);
    return finish(1);
  }

  // 2. Register our registry under the `@interlace` namespace — this exercises
  //    the exact alias form the site advertises, not just the raw URL form.
  const componentsJsonPath = path.join(app, 'components.json');
  const componentsJson = JSON.parse(await readFile(componentsJsonPath, 'utf8'));
  componentsJson.registries = {
    ...componentsJson.registries,
    '@interlace': `${baseUrl}/r/{name}.json`,
  };
  await writeFile(
    componentsJsonPath,
    JSON.stringify(componentsJson, null, 2) + '\n',
  );

  // 3. Install every item in one batch — dedupes the npm work, and the exit
  //    code answers "does this registry install at all".
  console.log(`\n▸ installing ${itemNames.length} items …`);
  const add = await run(
    'npx',
    [
      '--yes',
      'shadcn@latest',
      'add',
      '--overwrite',
      '--yes',
      ...itemNames.map((n) => `@interlace/${n}`),
    ],
    app,
    { quiet: true },
  );
  results.steps.add = { ok: add.code === 0, log: tail(add.out, 20000) };

  // 4. Per-item attribution: every declared target must exist on disk.
  let missing = 0;
  for (const name of itemNames) {
    const item = JSON.parse(
      await readFile(path.join(PUBLIC_DIR, 'r', `${name}.json`), 'utf8'),
    );
    const targets = item.files.map((f) => f.target);
    const absent = targets.filter(
      (t) => !existsSync(path.join(app, t)) && !existsSync(path.join(app, 'src', t)),
    );
    results.items[name] = absent.length
      ? { installed: false, missingTargets: absent }
      : { installed: true, files: targets.length };
    if (absent.length) missing += 1;
  }
  console.log(
    `  ${itemNames.length - missing}/${itemNames.length} items landed every declared file`,
  );

  // 5. Wire the CSS baseline in, in cascade order — otherwise the build proves
  //    only that files were copied, not that the stylesheets parse.
  const cssPath = ['src/app/globals.css', 'app/globals.css', 'src/styles/globals.css']
    .map((p) => path.join(app, p))
    .find((p) => existsSync(p));
  if (cssPath) {
    const styleDir = path.join(app, 'styles/interlace');
    const sheets = existsSync(styleDir)
      ? (await readdir(styleDir)).filter((f) => f.endsWith('.css'))
      : [];
    // The `theme` item writes them in cascade order; re-derive that order from
    // the item itself rather than re-hardcoding it here.
    const themeItem = JSON.parse(
      await readFile(path.join(PUBLIC_DIR, 'r', 'theme.json'), 'utf8'),
    );
    const ordered = themeItem.files
      .map((f) => path.basename(f.target))
      .filter((f) => sheets.includes(f));
    const rel = path.relative(path.dirname(cssPath), styleDir);
    const imports = ordered.map((f) => `@import "./${rel}/${f}";`).join('\n');
    const css = await readFile(cssPath, 'utf8');
    // CSS @import must precede every other rule except @charset/@layer.
    await writeFile(cssPath, `${imports}\n${css}`);
    results.steps.cssWired = { ok: ordered.length > 0, sheets: ordered };
  } else {
    results.steps.cssWired = { ok: false, reason: 'globals.css not found' };
  }

  // 6. The real gate — `next build` type-checks every installed source in a
  //    tree with none of our workspace aliases.
  console.log('\n▸ next build …');
  const build = await run('npm', ['run', 'build'], app, { quiet: true });
  results.steps.build = { ok: build.code === 0, log: tail(build.out, 8000) };
  if (build.code !== 0) console.error(tail(build.out, 8000));

  const ok =
    add.code === 0 &&
    missing === 0 &&
    build.code === 0 &&
    results.steps.cssWired.ok;
  return finish(ok ? 0 : 1);
};

main().catch(async (err) => {
  console.error(err);
  await mkdir(path.dirname(RESULTS_FILE), { recursive: true });
  process.exit(1);
});
