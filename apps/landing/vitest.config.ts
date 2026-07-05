import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "#interlace": resolve(__dirname, ".interlace"),
      "@": resolve(__dirname, "src"),
    },
  },
  // tsconfig.json sets `jsx: "preserve"` for Next.js's own SWC transform.
  // Vite/oxc would otherwise inherit that and leave JSX untransformed,
  // which breaks import analysis for any test that imports a .tsx component.
  oxc: {
    jsx: { runtime: "automatic" },
  },
});
