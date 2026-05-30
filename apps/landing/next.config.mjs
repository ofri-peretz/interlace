import { createMDX } from "fumadocs-mdx/next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../..");

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  compress: true,

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
