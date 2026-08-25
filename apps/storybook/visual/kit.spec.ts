import { expect, test } from '@playwright/test';

/**
 * Visual baselines for the woven signature kit.
 *
 * Every real bug the kit shipped was invisible in code and caught only
 * by rendering: the dash-sign inversion, Chromium's screen-space dashes
 * discarding pathLength, the preflight `svg { height: auto }` square-
 * spill, the 735-thread hairball, the weave covering only a card's top
 * band. This spec turns "found only by rendering" into a lock: the kit
 * stories are screenshotted against committed baselines in BOTH themes.
 *
 * Determinism is the kit's own reduced-motion contract doing double
 * duty: the context runs with `reducedMotion: 'reduce'`, under which
 * every draw completes instantly to its end state (never `animation:
 * none` — the strand rules clamp duration instead), so a screenshot
 * captures the finished gesture, not a mid-animation frame.
 * `animations: 'disabled'` is the belt to that suspender.
 *
 * To update baselines intentionally: `npm run visual:update` (commit
 * the diff — a baseline change IS a design change and reviews as one).
 */

/** The kit stories whose pixels are contract. Ids are storybook's. */
const KIT_STORIES = [
  'effects-interlaceweave--on-a-card',
  'effects-decodetext--eyebrow',
  'effects-herostrand--default',
  'effects-herostrand--woven-crossing',
  'primitives-readingstrand--default',
  'blocks-timelinemap--default',
  'blocks-timelinemap--woven-threads',
  'blocks-timelinemap--reading-time-landscape',
] as const;

const THEMES = ['light', 'dark'] as const;

for (const theme of THEMES) {
  for (const id of KIT_STORIES) {
    test(`${id} @ ${theme}`, async ({ page }) => {
      await page.goto(
        `/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`,
        { waitUntil: 'networkidle' },
      );
      // Story mounted: the root has rendered children (play functions,
      // if any, run after mount; the settle wait below covers them).
      const root = page.locator('#storybook-root');
      await expect(root.locator(':scope > *').first()).toBeVisible();
      // Fonts settle explicitly; play-function side-effects settle via
      // toHaveScreenshot's own stabilization (it polls until two
      // consecutive frames match) — no hard wait needed (review).
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${id}--${theme}.png`, {
        animations: 'disabled',
        fullPage: true,
        // Absolute cap, not a ratio (review): 1% of a full-page shot is
        // ~9,000 free pixels — enough to hide a recolored strand, whose
        // entire 300px run is ~300 pixels. 400px covers antialiasing
        // wiggle and nothing structural.
        maxDiffPixels: 400,
      });
    });
  }
}
