import path from "node:path";
import { fileURLToPath } from "node:url";

import { createMDX } from "fumadocs-mdx/next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../..");

const withMDX = createMDX();

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

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  compress: true,

  // Same-origin PostHog ingest (ANALYTICS_PHILOSOPHY §9). Ad blockers match on
  // the `*.i.posthog.com` hostname, not on payload shape, so proxying through
  // our own origin is what recovers the ~30-40% of visitors they were dropping.
  // `skipTrailingSlashRedirect` is required: Next would otherwise 308
  // `/ingest/e/` -> `/ingest/e`, and posthog-js does not follow the redirect.
  skipTrailingSlashRedirect: true,
  rewrites: async () => [
    // Static assets (the recorder/surveys bundles) come from a different
    // upstream host than the event API — order matters, this must precede the
    // catch-all below or `:path*` swallows it.
    {
      source: "/ingest/static/:path*",
      destination: "https://us-assets.i.posthog.com/static/:path*",
    },
    {
      source: "/ingest/:path*",
      destination: "https://us.i.posthog.com/:path*",
    },
  ],

  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["motion", "motion/react"],
  serverExternalPackages: ["typescript", "twoslash"],

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "motion",
      "motion/react",
      "fumadocs-ui",
      "fumadocs-core",
    ],
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.resolve(monorepoRoot, "node_modules/react"),
      "react-dom": path.resolve(monorepoRoot, "node_modules/react-dom"),
      "motion/react": "motion",
      "fumadocs-ui": path.resolve(monorepoRoot, "node_modules/fumadocs-ui"),
      "fumadocs-core": path.resolve(monorepoRoot, "node_modules/fumadocs-core"),
      tailwindcss: path.resolve(monorepoRoot, "node_modules/tailwindcss"),
    };
    return config;
  },

  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ...cspReportOnlyHeaders(),
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
        },
        // The apex is the only host whose HSTS can cover the siblings —
        // ds., storybook., eslint., serverless.interlace.tools. Vercel's
        // default header omits includeSubDomains, so each subdomain was
        // protected only after its own first HTTPS response. All of them are
        // HTTPS-only on Vercel, so asserting it here is safe. `preload` is
        // deliberately omitted: it is baked into browser binaries and is very
        // hard to unwind if a subdomain ever needs plain HTTP.
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
    {
      source: "/_next/static/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
  ],

  redirects: async () => [
    {
      source: "/docs",
      destination: "/docs/concepts/what-is-interlace",
      permanent: true,
    },
  ],
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

export default await withSourcemapUpload(withMDX(config));
