import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Content-Security-Policy in *report-only* mode, reported to PostHog's CSP
 * endpoint through the same same-origin `/ingest` proxy as the rest of
 * analytics.
 *
 * Report-only by design: this policy is a hypothesis, not a contract. The
 * browser evaluates it, reports what would have been blocked, and blocks
 * nothing — so a wrong rule costs a PostHog event, never a broken page. It is
 * also the only way to learn what an enforcing policy would need to allow.
 * Once the violation stream is quiet the header can be promoted to the
 * enforcing `Content-Security-Policy` name.
 *
 * Omitted entirely when the PostHog key is absent — a report-only policy with
 * nowhere to report is console noise, not telemetry.
 */
function cspReportOnlyHeaders() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  // Validated, not just trimmed. This value is interpolated into a response
  // header: a `;` would silently restructure the policy by truncating or
  // reordering directives, and a CR/LF would split the response entirely
  // (CWE-113). PostHog project keys are `phc_` followed by URL-safe
  // characters, so the shape is both a correctness check and the injection
  // guard. A malformed value drops the header rather than emitting a
  // corrupted one.
  if (!token || !/^[\w-]+$/.test(token)) return [];
  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    // Matches the X-Frame-Options: DENY this site already sends. Modern
    // browsers prefer frame-ancestors; the older header covers the rest.
    "frame-ancestors 'none'",
    "form-action 'self'",
    // Next ships inline bootstrap scripts and styles.
    // TODO(csp-promotion): do NOT carry 'unsafe-eval' into the enforcing
    // header — it re-enables eval()/new Function() and undermines the XSS
    // mitigation this policy exists for (CWE-749). It is here only so the
    // report-only stream is not drowned by it; the violation data will say
    // whether anything actually needs it.
    // eslint-disable-next-line browser-security/no-unsafe-inline-csp, browser-security/no-unsafe-eval-csp -- Both rules are right, and this is the one place they do not apply: the header below is Content-Security-Policy-REPORT-ONLY, which instructs the browser to report and block nothing. These two tokens exist so Next's inline bootstrap does not drown the violation stream in noise that hides the findings we actually want. The TODO above is the contract: neither token may survive promotion to the enforcing header, and at that point these suppressions must be deleted rather than moved.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    // eslint-disable-next-line browser-security/no-unsafe-inline-csp -- Same reasoning as script-src: report-only, and Next inlines critical CSS.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Same-origin covers /ingest (PostHog) and /_vercel (Vercel Analytics).
    // posthog-js still reaches some endpoints directly rather than through the
    // proxy — remote config, surveys, the toolbar — and session replay opens a
    // WebSocket, so those origins are named explicitly.
    "connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com wss://us.i.posthog.com",
    // eslint-disable-next-line browser-security/no-credentials-in-query-params -- Not a credential. `NEXT_PUBLIC_POSTHOG_KEY` is PostHog's *publishable* project key: it ships in the client bundle by design, identifies a project rather than authorising anything, and is already visible in this very header to anyone who runs `curl -I`. PostHog's CSP report endpoint takes it as a query parameter and offers no header-based alternative.
    `report-uri /ingest/report/?token=${token}`,
  ].join("; ");
  return [{ key: "Content-Security-Policy-Report-Only", value: policy }];
}

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
        // MUST precede the catch-all below, and MUST keep the trailing slash on
        // the destination. PostHog's CSP endpoint is `/report/` and answers 404
        // for `/report` — while `:path*` drops a trailing slash, so the catch-all
        // rewrote `/ingest/report/` to `https://us.i.posthog.com/report` and every
        // violation report 404'd. Silently: a failing report-uri reports nothing
        // about itself, and an empty event stream reads exactly like a clean
        // policy. Verified: `/report/` → 204, `/report` → 404.
        {
          source: "/ingest/report",
          destination: "https://us.i.posthog.com/report/",
        },
        {
          source: "/ingest/report/",
          destination: "https://us.i.posthog.com/report/",
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
          ...cspReportOnlyHeaders(),
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
