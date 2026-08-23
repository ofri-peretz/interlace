import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Registry-app config.
 *
 * - `output: 'standalone'` is NOT used — Vercel runs Next.js natively.
 * - `public/r/*.json` is NO LONGER served as a static asset. A `beforeFiles`
 *   rewrite sends `/r/**.json` to `src/app/api/r/[...slug]/route.ts`, which
 *   substitutes the requesting origin into the `registryDependencies` URLs
 *   before answering. See that file for why. `beforeFiles` specifically:
 *   it is the only rewrite phase evaluated BEFORE the filesystem, so it is
 *   the only one that can override a `public/` file — an `afterFiles`
 *   rewrite (the shape a bare array compiles to) never fires here, and a
 *   route handler at `/r/[...slug]` is likewise shadowed by the static file.
 *   The raw stylesheets under `/r/styles/*.css` stay static: they contain no
 *   origins, so there is nothing to rewrite and no reason to pay for a
 *   function invocation.
 * - `turbopack.root` set to the workspace root because `next` is hoisted to
 *   the monorepo root's node_modules in npm workspaces — Turbopack's package
 *   resolver needs to know to walk up.
 * - Headers below mirror the contract from the previous static deploy:
 *   permissive CORS for `/r/*.json` so the shadcn CLI can fetch cross-origin.
 *
 * `.mjs` (not `.ts`) because `package.json` declares `"type": "module"` and
 * Next compiles `next.config.ts` to a `.js` sibling that ends up parsed as
 * CJS — `ReferenceError: exports is not defined in ES module scope`. The
 * sibling `apps/docs/next.config.mjs` uses the same pattern.
 *
 * @type {import('next').NextConfig}
 */
const config = {
  reactStrictMode: true,
  turbopack: {
    root: resolve(__dirname, "../.."),
  },
  // PostHog reverse proxy (ANALYTICS_PHILOSOPHY principle 2). Same-origin
  // ingest survives ad-blockers and keeps third-party hosts out of CSP.
  skipTrailingSlashRedirect: true,
  // `readFile(process.cwd() + '/public/r/…')` in the registry route is not
  // statically analysable, so Next's tracer has no reason to bundle those
  // files into the serverless function. Without this the route 404s in
  // production while working perfectly in `next dev` — the exact shape of
  // failure this whole route exists to eliminate.
  outputFileTracingIncludes: {
    "/api/r/[...slug]": ["./public/r/**/*.json"],
  },
  async rewrites() {
    return {
      // Evaluated before the filesystem — this is what lets a dynamic handler
      // answer for a path that also exists under `public/`.
      beforeFiles: [
        {
          source: "/r/:path*.json",
          destination: "/api/r/:path*.json",
        },
      ],
      // PostHog reverse proxy — no filesystem conflict, so the default phase
      // is correct for these.
      afterFiles: [
        {
          source: "/ingest/static/:path*",
          destination: "https://us-assets.i.posthog.com/static/:path*",
        },
        {
          source: "/ingest/:path*",
          destination: "https://us.i.posthog.com/:path*",
        },
        {
          source: "/ingest/decide",
          destination: "https://us.i.posthog.com/decide",
        },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/r/:path*.json",
        headers: [
          { key: "Content-Type", value: "application/json; charset=utf-8" },
          {
            key: "Cache-Control",
            value:
              "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
          },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // This site shipped no framing header at all, so any page could be
          // iframed and clickjacked. DENY rather than SAMEORIGIN: the
          // registry renders no iframes of its own. Note this does not
          // restrict /r/*.json — that route is a public registry endpoint
          // with Access-Control-Allow-Origin: *, and CORS is a separate
          // mechanism from framing.
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          // Sent here too, not just on the apex. The apex's includeSubDomains
          // only covers this host for a browser that already has the apex
          // entry cached — someone landing on ds. first, via a direct link or
          // a `shadcn add` reference, would get no HSTS on that first
          // response. Belt and braces.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          // Severs the window.opener relationship with cross-origin openers.
          // Safe here: nothing in this app calls window.open.
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

/**
 * Source maps for PostHog Error Tracking — generated, uploaded, then deleted.
 *
 * `deleteAfterUpload` is the load-bearing option, not a default we inherit:
 * the .map files are produced inside the build, handed to PostHog, and removed
 * from the output before anything is served. Symbolication lives in PostHog,
 * behind auth; the deployment ships the same minified bundle it always did.
 *
 * Inert unless both env vars are set, so local builds and forks stay
 * byte-identical to today and no build can fail for want of a token.
 */
async function withSourcemapUpload(nextConfig) {
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  if (!personalApiKey || !projectId) return nextConfig;
  // Imported here rather than at module scope: the package is a
  // devDependency, and a top-level import would make this config
  // unloadable in an --omit=dev install even with the gate off.
  const { withPostHogConfig } = await import("@posthog/nextjs-config");
  return withPostHogConfig(nextConfig, {
    personalApiKey,
    projectId,
    sourcemaps: { enabled: true, deleteAfterUpload: true },
  });
}

export default await withSourcemapUpload(config);
