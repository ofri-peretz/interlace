import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for live-page accessibility checks.
 *
 * Boots `next start` on port 3091, runs axe-core against the rendered HTML
 * for every important route. Catches a class of bugs storybook can't see:
 *
 *   - Tailwind content-scan misses (the `text-purple-950` regression that
 *     started this whole audit)
 *   - landmark / heading-order issues at the page level
 *   - integration-time wiring (theme provider, fonts, third-party widgets)
 *
 * Local: `npm run e2e:a11y` after `npm run build`.
 * CI: see `.github/workflows/baseline-a11y.yml` → `live-page-axe` job.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // axe needs the page fully loaded; one route at a time keeps memory low
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3091",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx next start --port 3091",
    url: "http://localhost:3091",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
