import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ORIGIN } from '../../../../../registry.config.mjs';

/**
 * Serve `/r/**` with the registry's own origin substituted per request.
 *
 * ─── Why this route exists ────────────────────────────────────────────────
 *
 * Every item's `registryDependencies` MUST be an absolute URL. That is not a
 * style choice: the shadcn CLI (v4.16.2, `ft()` in `dist/chunk-*.js`)
 * classifies a dependency string as one of five things, and only two of them
 * reach a network origin —
 *
 *   `./child.json` / `child.json` / `/r/child.json`  → LOCAL FILE, `path.resolve`d
 *                                                      against `process.cwd()`
 *   `button`                                          → shadcn's OWN registry
 *   `@ns/button`                                      → the consumer's `registries` map
 *   `owner/repo/path.json`                            → GitHub shorthand
 *   `https://host/r/button.json`                      → fetched as written
 *
 * There is no "resolve relative to the URL this item was fetched from" — the
 * only two-argument `new URL(x, base)` in the whole CLI bundle is its HTTP
 * redirect follower. So relative refs are not an option, and an absolute URL
 * baked at build time is.
 *
 * Which creates the failure this route fixes. `public/r/*.json` is a committed
 * artifact carrying the PRODUCTION origin, so serving that artifact from any
 * other origin — a branch preview, `next start -p 4178`, a colleague's laptop —
 * produced a tree assembled from two registries at once: the item you asked
 * for came from the branch, and every transitive dependency came from
 * ds.interlace.tools. Installing branch `stat-strip` fetched production
 * `data-state`, which exports `DataState` where the branch exports
 * `DataStateBadge`. The install reported success. The tree did not compile.
 * Nothing warned, because from the CLI's point of view nothing went wrong.
 *
 * Rewriting at SERVE time rather than at build time is what makes that
 * impossible rather than merely unlikely:
 *
 *   - it needs no env var to be remembered, so a preview deploy is
 *     self-consistent by default rather than when someone configures it;
 *   - the committed bytes stay canonical, so `build-registry.mjs --check` has
 *     exactly one correct answer and the drift gate keeps working;
 *   - `refToName` (src/lib/registry.ts) keeps matching the production origin
 *     when the SITE reads these files off disk to render component pages. Only
 *     the HTTP surface is rewritten, and only for the caller that asked.
 *
 * `REGISTRY_ORIGIN` (registry.config.mjs) remains for the offline case — a
 * build whose artifacts must carry a non-production origin without a server in
 * front of them.
 *
 * ─── Why the handler lives at /api/r and not /r ───────────────────────────
 *
 * A route handler does NOT shadow a same-path file in `public/` — measured,
 * not assumed: with `src/app/r/[...slug]/route.ts` in place, `curl /r/x.json`
 * still answered from the static handler (`ETag` + `Accept-Ranges` in the
 * response, production origins in the body). Next's static-file handler wins.
 *
 * `rewrites().beforeFiles` in `next.config.mjs` is the documented way to
 * override a public file — it is evaluated before the filesystem is consulted.
 * So `/r/**.json` is rewritten here, and `public/r/*.json` stays on disk as
 * the canonical artifact this route reads and the drift gate compares.
 *
 * `outputFileTracingIncludes` (same config) is what makes that work off the
 * local filesystem: `readFile(process.cwd() + '/public/r/…')` is not
 * statically analysable, so nothing would otherwise pull those JSON files into
 * the serverless bundle and every request would 404 in production only.
 *
 * Exercised end-to-end by `scripts/e2e-install.mjs`, which installs over real
 * HTTP from a `next start` server rather than from a bespoke static server
 * that rewrote the origin itself — the harness must not be the only place the
 * fix exists.
 */

/**
 * The production origin, parsed once. `ORIGIN` is a module constant, so
 * re-deriving this inside the per-dependency loop was work repeated 140×
 * per request for a value that cannot change.
 */
const PROD_ORIGIN = new URL(ORIGIN).origin;

/** Read from disk on every request; never prerendered with a baked origin. */
export const dynamic = 'force-dynamic';

const R_DIR = path.join(process.cwd(), 'public', 'r');

const MIME: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

/**
 * The origin the CLI actually used, not the one this process is bound to.
 *
 * On Vercel the request URL a function sees is an internal one, so
 * `new URL(request.url).origin` would bake the wrong host into every
 * dependency — the same class of bug this route exists to fix. The forwarded
 * headers carry the public origin; `request.url` is the fallback for a plain
 * `next start` where there is no proxy.
 */
export const originOf = (headers: Headers, requestUrl: string): string => {
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host) return new URL(requestUrl).origin;
  const proto =
    headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
};

/**
 * Repoint `registryDependencies` at `origin` — and nothing else.
 *
 * A blanket `body.replaceAll(ORIGIN, origin)` also works, and was the first
 * version, but it rewrites too much: the `docs` string and the version banner
 * inside every `files[].content` carry `https://ds.interlace.tools/c/<name>`
 * links, and a consumer who installed from a preview would end up owning a
 * file whose "where are the docs" comment points at a preview URL that stops
 * existing when the branch merges. Those links are meant to be canonical.
 *
 * Only the dependency list has to move, so only the dependency list moves. It
 * is also a stronger check: a dependency that names some OTHER registry is
 * left alone here, where a string replace would have had to get lucky.
 *
 * Non-JSON or unparseable bodies are returned untouched — the CLI's own error
 * is more useful than one invented here.
 */
export const withRequestOrigin = (body: string, origin: string): string => {
  if (origin === ORIGIN) return body;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }
  const item = parsed as { registryDependencies?: unknown };
  if (!Array.isArray(item.registryDependencies)) return body;
  item.registryDependencies = item.registryDependencies.map((dep) => {
    if (typeof dep !== 'string') return dep;
    try {
      // Origin equality, not a prefix test: `ds.interlace.tools.example.com`
      // shares the prefix and is a different host entirely.
      //
      // `dep` is parsed once and `ORIGIN` once per module rather than once per
      // dependency — this runs over every item's whole dependency list on
      // every request, and `ORIGIN` is a module constant that cannot change
      // between iterations.
      const parsedDep = new URL(dep);
      return parsedDep.origin === PROD_ORIGIN
        ? origin + dep.slice(parsedDep.origin.length)
        : dep;
    } catch {
      return dep;
    }
  });
  return JSON.stringify(parsed, null, 2) + '\n';
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  // `path.join` collapses `..`; the prefix test (with the trailing separator,
  // so a sibling `r-extra/` cannot pass) is what makes that collapse safe.
  const file = path.join(R_DIR, ...slug);
  if (!file.startsWith(R_DIR + path.sep)) {
    return new Response('forbidden', { status: 403 });
  }

  const type = MIME[path.extname(file)];
  if (!type) return new Response('not found', { status: 404 });

  let body: string;
  try {
    body = await readFile(file, 'utf8');
  } catch {
    return new Response('not found', { status: 404 });
  }

  // Only the JSON carries origins. The stylesheets are origin-free by
  // construction — `@import` between them is relative.
  if (path.extname(file) === '.json') {
    body = withRequestOrigin(body, originOf(request.headers, request.url));
  }

  return new Response(body, {
    headers: {
      'content-type': type,
      // Per-origin bodies. Without `Vary` a shared cache could hand a
      // localhost-rewritten item to a production caller.
      vary: 'Host, X-Forwarded-Host',
      'cache-control':
        'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      'access-control-allow-origin': '*',
    },
  });
}
