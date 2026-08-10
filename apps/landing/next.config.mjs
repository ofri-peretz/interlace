import path from "node:path";
import { fileURLToPath } from "node:url";

import { createMDX } from "fumadocs-mdx/next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../..");

const withMDX = createMDX();

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

export default withMDX(config);
