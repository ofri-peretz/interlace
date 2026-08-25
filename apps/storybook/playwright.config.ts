import { defineConfig, devices } from '@playwright/test';

/**
 * Visual-baseline runner for the woven signature kit (visual/kit.spec.ts).
 *
 * Serves the BUILT storybook (`storybook-static`) — the same artifact CI
 * ships — never the dev server, whose lazy compilation makes first-paint
 * timing nondeterministic. Build first: `npm run build-storybook`.
 *
 * Baselines are platform-suffixed by Playwright (`-darwin` locally,
 * `-linux` in CI); both sets are committed. The CI job bootstraps the
 * linux set on its first run (see `storybook (visual)` in ci.yml).
 */
export default defineConfig({
  testDir: './visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:6007',
    // The determinism contract: reduce completes every draw instantly.
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx --yes http-server storybook-static -p 6007 -s',
    url: 'http://127.0.0.1:6007/iframe.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
