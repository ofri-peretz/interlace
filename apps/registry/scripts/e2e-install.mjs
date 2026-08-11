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
 *   node scripts/e2e-install.mjs                  # against a real `next start`
 *   node scripts/e2e-install.mjs --url https://ds.interlace.tools
 *   node scripts/e2e-install.mjs --keep           # leave the scratch app
 *   node scripts/e2e-install.mjs --only button,card
 *   node scripts/e2e-install.mjs --no-build       # reuse an existing .next
 *
 * Results are written to `e2e-install-results.json` (committed) so the last
 * verified state is reviewable without re-running the ~5-minute job.
 *
 * Strategy: one batched `shadcn add` of every item (fast, and its exit code
 * answers "does the registry install at all"), then a per-item check that each
 * declared `target` actually landed on disk — that gives per-item attribution
 * without paying for 120 separate CLI invocations.
 *
 * ─── What this harness got WRONG, and what it now does instead ─────────────
 *
 * Two of the three defects below were invisible to this file BY CONSTRUCTION.
 * A harness that can only pass is not a gate, so all three are now the
 * things it specifically tries to break:
 *
 * 1. IT RAN `shadcn init -d` FIRST. That is the one configuration in which
 *    "102 items import `@/lib/utils` and zero of them declare `cn`" cannot
 *    fail: `shadcn init` writes `lib/utils.ts` itself, as part of scaffolding.
 *    Every real adopter already has a `components.json` and so never re-runs
 *    init — for them each installed file died on its first import. The harness
 *    now WRITES `components.json` by hand, exactly as an existing app would
 *    already have it, and never runs `init`. `lib/utils.ts` must therefore
 *    arrive from the `cn` registry item or not at all, and step 5 asserts it.
 *
 * 2. IT REWROTE THE ORIGIN ITSELF. The old local server replaced the
 *    production origin with its own on the way out, which is precisely the
 *    behaviour the SERVER is supposed to provide. So the harness proved a
 *    property of the harness. It now installs from a real `next start` of this
 *    app, exercising the `beforeFiles` rewrite and
 *    `src/app/api/r/[...slug]/route.ts` that a branch deploy actually serves.
 *
 * 3. IT COULD NOT SEE A CROSS-REGISTRY INSTALL. Fetching a transitive
 *    dependency from PRODUCTION instead of from the build under test looks
 *    identical to success — same file count, same exit code. Every request is
 *    now recorded by a proxy in front of the server, and step 6 asserts that
 *    every transitive dependency in the closure was fetched FROM US. A dep
 *    resolved against ds.interlace.tools is a request we never see, so the
 *    assertion fails rather than passing quietly.
 */

import { createServer, request as httpRequest } from 'node:http';
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
const NO_BUILD = argv.includes('--no-build');
const REMOTE_URL = flag('url');
const ONLY = flag('only')?.split(',').filter(Boolean) ?? null;

// ─── Subprocess helper ───────────────────────────────────────────────────────

const run = (cmd, args, cwd, { quiet = false, env = {} } = {}) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, CI: '1', NEXT_TELEMETRY_DISABLED: '1', ...env },
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let out = '';
    child.stdout?.on('data', (d) => (out += d));
    child.stderr?.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });

const tail = (s, n = 2000) => (s.length > n ? `…${s.slice(-n)}` : s);

// ─── The registry, served the way it is really served ────────────────────────

/**
 * Boot `next start` for THIS app and put a recording proxy in front of it.
 *
 * The proxy is not decoration. "Did the CLI fetch this dependency from the
 * build under test, or from production?" has no other cheap answer — both
 * outcomes produce a successful install and the same files on disk. A request
 * we never see is a dependency someone else served.
 *
 * The proxy also gives the app a stable public origin (`Host` /
 * `X-Forwarded-*`), which is exactly what the route handler reads to decide
 * what to substitute — so the origin injection is exercised through the same
 * header path a CDN would use.
 */
const startRegistryServer = async () => {
  if (!NO_BUILD) {
    console.log('\n▸ next build (registry app) …');
    // `npx next build`, not `npm run build`: the latter fires `prebuild`,
    // which regenerates committed artifacts as a side effect of running a test.
    const built = await run('npx', ['next', 'build'], REGISTRY_ROOT, {
      quiet: true,
    });
    if (built.code !== 0) {
      console.error(tail(built.out, 8000));
      throw new Error('registry `next build` failed — cannot serve');
    }
  }

  const appPort = await freePort();
  console.log(`\n▸ next start -p ${appPort} …`);
  const server = spawn('npx', ['next', 'start', '-p', String(appPort)], {
    cwd: REGISTRY_ROOT,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));

  const requested = [];
  const proxy = createServer((req, res) => {
    requested.push(req.url);
    const upstream = httpRequest(
      {
        host: '127.0.0.1',
        port: appPort,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${proxyPort}` },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('error', () => res.writeHead(502).end('upstream error'));
    req.pipe(upstream);
  });
  const proxyPort = await freePort();
  await new Promise((resolve) => proxy.listen(proxyPort, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${proxyPort}`;

  await waitFor(`${url}/r/index.json`, () => serverLog);

  return {
    url,
    requested,
    log: () => serverLog,
    close: () => {
      proxy.close();
      server.kill();
    },
  };
};

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

const waitFor = async (url, log, tries = 90) => {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`server never became ready at ${url}\n${tail(log(), 4000)}`);
};

// ─── The consumer profile ────────────────────────────────────────────────────

/**
 * `components.json` as an app that adopted shadcn months ago already has it.
 *
 * Hand-written on purpose — running `shadcn init` here would recreate the blind
 * spot described at the top of this file. Nothing in this object creates
 * `lib/utils.ts`; if the installed components are to compile, the `cn` item has
 * to bring it.
 *
 * `rsc: true` because the scratch app is App Router, which is what an honest
 * profile for it says. The `rsc: false` case is covered separately in step 7:
 * the CLI drops the `'use client'` statement there, and anything that was
 * attached to it goes with it.
 */
const componentsJsonFor = (baseUrl) => ({
  $schema: 'https://ui.shadcn.com/schema.json',
  style: 'new-york',
  rsc: true,
  tsx: true,
  tailwind: {
    config: '',
    css: 'app/globals.css',
    baseColor: 'neutral',
    cssVariables: true,
    prefix: '',
  },
  iconLibrary: 'lucide',
  aliases: {
    components: '@/components',
    utils: '@/lib/utils',
    ui: '@/components/ui',
    lib: '@/lib',
    hooks: '@/hooks',
  },
  registries: {
    '@interlace': `${baseUrl}/r/{name}.json`,
  },
});

/** Every item reachable from `roots` through `registryDependencies`. */
const transitiveClosure = async (roots) => {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length) {
    const name = queue.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    let item;
    try {
      item = JSON.parse(
        await readFile(path.join(PUBLIC_DIR, 'r', `${name}.json`), 'utf8'),
      );
    } catch {
      continue;
    }
    for (const dep of item.registryDependencies ?? []) {
      const depName = dep.split('/').pop().replace(/\.json$/, '');
      if (!seen.has(depName)) queue.push(depName);
    }
  }
  return seen;
};

// ─── Main ────────────────────────────────────────────────────────────────────

const main = async () => {
  const started = Date.now();
  let registry = null;
  let baseUrl = REMOTE_URL;

  if (!baseUrl) {
    registry = await startRegistryServer();
    baseUrl = registry.url;
    console.log(`registry served at ${baseUrl}`);
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
    registryUrl: REMOTE_URL ?? '(next start + recording proxy)',
    consumerProfile:
      'pre-existing components.json — `shadcn init` is NOT run, so lib/utils.ts must arrive from the `cn` item',
    itemCount: itemNames.length,
    steps: {},
    items: {},
  };

  const finish = async (exitCode) => {
    results.durationSeconds = Math.round((Date.now() - started) / 1000);
    results.ok = exitCode === 0;
    // A `--only` run is a partial: writing it would replace the committed
    // record of the last FULL pass with a two-item file.
    const resultsPath = ONLY
      ? RESULTS_FILE.replace(/\.json$/, '.partial.json')
      : RESULTS_FILE;
    await writeFile(resultsPath, JSON.stringify(results, null, 2) + '\n');
    registry?.close();
    if (!KEEP) await rm(scratchRoot, { recursive: true, force: true });
    else console.log(`scratch app kept at ${app}`);
    console.log(
      `${results.ok ? 'PASS' : 'FAIL'} — results written to ${resultsPath}`,
    );
    process.exit(exitCode);
  };

  // 1. Scaffold a real Next.js app. NOT followed by `shadcn init` — see the
  //    header. This is a plain app that has never met our registry.
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

  // 2. Give it the `components.json` it would already have, with our registry
  //    registered under the `@interlace` namespace — the exact alias form the
  //    site advertises, not just the raw URL form.
  await writeFile(
    path.join(app, 'components.json'),
    JSON.stringify(componentsJsonFor(baseUrl), null, 2) + '\n',
  );
  // The premise of the whole profile: this file does not exist yet.
  const utilsPreexisting =
    existsSync(path.join(app, 'lib/utils.ts')) ||
    existsSync(path.join(app, 'src/lib/utils.ts'));
  results.steps.consumerProfile = {
    ok: !utilsPreexisting,
    shadcnInitRun: false,
    libUtilsPreexisting: utilsPreexisting,
  };
  if (utilsPreexisting) {
    console.error(
      'lib/utils.ts already exists before install — the `cn` dependency check would be meaningless',
    );
    return finish(1);
  }

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

  // 5. The `cn` proof. `lib/utils.ts` was absent before the install and 100+
  //    installed files import `@/lib/utils`; if it is here now, it came from
  //    the `cn` registry item being declared as a dependency.
  const utilsPath = ['lib/utils.ts', 'src/lib/utils.ts']
    .map((p) => path.join(app, p))
    .find((p) => existsSync(p));
  results.steps.cnDependency = {
    ok: Boolean(utilsPath),
    note: utilsPath
      ? 'lib/utils.ts arrived from the `cn` registry item (no `shadcn init` was run)'
      : 'lib/utils.ts is MISSING — every file importing @/lib/utils will fail to resolve',
  };
  if (!utilsPath) console.error('  lib/utils.ts did not arrive');

  // 6. The origin proof. Every item in the transitive closure must have been
  //    fetched FROM THIS SERVER. A dependency resolved against production is a
  //    request that never reaches the proxy, so its absence is the failure —
  //    which is the only way to catch a cross-registry install, because on
  //    disk it looks exactly like a correct one.
  if (registry) {
    const closure = await transitiveClosure(itemNames);
    const fetched = new Set(
      registry.requested
        .map((u) => /^\/r\/(.+)\.json$/.exec(u)?.[1])
        .filter(Boolean),
    );
    const unfetched = [...closure].filter((n) => !fetched.has(n)).sort();
    // And assert the served dependency lists themselves no longer name
    // production. `stat-strip` because it is the item the original report was
    // written against: branch `stat-strip` + production `data-state` is a tree
    // that does not compile, from an install that says it succeeded.
    const probe = itemNames.includes('stat-strip') ? 'stat-strip' : itemNames[0];
    const served = await (await fetch(`${baseUrl}/r/${probe}.json`)).json();
    const leakedOrigin = (served.registryDependencies ?? []).some((d) =>
      d.startsWith(PROD_ORIGIN),
    );
    results.steps.originProvenance = {
      ok: unfetched.length === 0 && !leakedOrigin,
      closureSize: closure.size,
      fetchedFromUs: fetched.size,
      neverRequestedFromUs: unfetched,
      probedItem: probe,
      servedItemsStillNameProduction: leakedOrigin,
    };
    if (unfetched.length) {
      console.error(
        `  ${unfetched.length} transitive dep(s) were never requested from this server — they came from somewhere else: ${unfetched.slice(0, 10).join(', ')}`,
      );
    }
  } else {
    results.steps.originProvenance = {
      ok: true,
      skipped: '--url run: provenance is only meaningful against a local build',
    };
  }

  // 7. The version banner must survive the copy, in BOTH `rsc` settings.
  //
  //    `rsc: false` is the harsh one and it is also the CLI's default: the
  //    `'use client'` statement is deleted, and a banner attached to it is
  //    deleted with it — which is how a 14,314-byte item arrived as 2,712
  //    bytes with no version in it. Flipping the flag and re-adding is cheap
  //    and is the only way this assertion means anything.
  const bannerProbe = ['button', 'card', 'skeleton'].filter((n) =>
    itemNames.includes(n),
  );
  const bannerFor = (name) => {
    const p = ['components/ui', 'src/components/ui']
      .map((d) => path.join(app, d, `${name}.tsx`))
      .find((f) => existsSync(f));
    return p ? readFile(p, 'utf8') : Promise.resolve('');
  };
  const bannerResults = {};
  for (const rsc of [true, false]) {
    const cfg = componentsJsonFor(baseUrl);
    cfg.rsc = rsc;
    await writeFile(
      path.join(app, 'components.json'),
      JSON.stringify(cfg, null, 2) + '\n',
    );
    await run(
      'npx',
      [
        '--yes',
        'shadcn@latest',
        'add',
        '--overwrite',
        '--yes',
        ...bannerProbe.map((n) => `@interlace/${n}`),
      ],
      app,
      { quiet: true },
    );
    const missingBanner = [];
    for (const name of bannerProbe) {
      const content = await bannerFor(name);
      if (!new RegExp(`@interlace/${name} v\\d`).test(content)) {
        missingBanner.push(name);
      }
    }
    bannerResults[`rsc:${rsc}`] = {
      ok: missingBanner.length === 0,
      probed: bannerProbe,
      missingBanner,
    };
  }
  // Leave the app in the honest App Router profile for the build below.
  await writeFile(
    path.join(app, 'components.json'),
    JSON.stringify(componentsJsonFor(baseUrl), null, 2) + '\n',
  );
  await run(
    'npx',
    [
      '--yes',
      'shadcn@latest',
      'add',
      '--overwrite',
      '--yes',
      ...bannerProbe.map((n) => `@interlace/${n}`),
    ],
    app,
    { quiet: true },
  );
  results.steps.versionBanner = {
    ok: Object.values(bannerResults).every((r) => r.ok),
    ...bannerResults,
  };

  // 8. Wire the CSS baseline in — via the BARREL, which is the one line the
  //    docs tell a consumer to write. If `index.css` did not ship, or its
  //    relative `@import`s do not resolve next to the leaves, this is where it
  //    shows up.
  const cssPath = ['src/app/globals.css', 'app/globals.css', 'src/styles/globals.css']
    .map((p) => path.join(app, p))
    .find((p) => existsSync(p));
  if (cssPath) {
    const styleDir = ['styles/interlace', 'src/styles/interlace']
      .map((p) => path.join(app, p))
      .find((p) => existsSync(p));
    const barrel = styleDir && path.join(styleDir, 'index.css');
    const sheets = styleDir
      ? (await readdir(styleDir)).filter((f) => f.endsWith('.css'))
      : [];
    if (barrel && existsSync(barrel)) {
      const rel = path.relative(path.dirname(cssPath), styleDir);
      const css = await readFile(cssPath, 'utf8');
      // CSS @import must precede every other rule except @charset/@layer.
      await writeFile(cssPath, `@import "./${rel}/index.css";\n${css}`);
      results.steps.cssWired = {
        ok: true,
        via: 'barrel',
        imports: 1,
        sheetsInstalled: sheets.length,
      };
    } else {
      results.steps.cssWired = {
        ok: false,
        reason:
          'styles/interlace/index.css did not install — consumers would have to hand-reconstruct the layer order',
        sheetsInstalled: sheets.length,
      };
    }
  } else {
    results.steps.cssWired = { ok: false, reason: 'globals.css not found' };
  }

  // 9. The real gate — `next build` type-checks every installed source in a
  //    tree with none of our workspace aliases.
  console.log('\n▸ next build (scratch app) …');
  const build = await run('npm', ['run', 'build'], app, { quiet: true });
  results.steps.build = { ok: build.code === 0, log: tail(build.out, 8000) };
  if (build.code !== 0) console.error(tail(build.out, 8000));

  const ok = add.code === 0 && missing === 0 && Object.values(results.steps).every((s) => s.ok);
  return finish(ok ? 0 : 1);
};

main().catch(async (err) => {
  console.error(err);
  await mkdir(path.dirname(RESULTS_FILE), { recursive: true });
  process.exit(1);
});
