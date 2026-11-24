import { expect, test } from '@playwright/test';

import { MODES, storiesFor } from './matrix';
import { stage } from './stage';

/**
 * Screenshot baselines for every component, in six reading conditions:
 * light, dark, phone, right-to-left, 150% text and more contrast.
 *
 * Runs only inside the pinned Playwright image (`npm run visual:docker`, and
 * the `storybook (visual)` CI job calls the same script), so the pixels a
 * laptop writes are the pixels CI compares. Run natively, font hinting and
 * the system font stack differ and every baseline would "change".
 *
 * A failing shot is a question, not a verdict: open the diff in the
 * `visual-diffs` artifact. If the change is intended, run
 * `npm run visual:docker -- --update-snapshots` and commit the new PNGs with
 * the change that caused them; the reviewer reads them as part of the diff.
 */

test.skip(
  !process.env.INTERLACE_VISUAL_DOCKER,
  'Visual baselines run only in the pinned image: npm run visual:docker',
);

for (const mode of MODES) {
  test.describe(mode.name, () => {
    for (const story of storiesFor(mode)) {
      test(`${story.title} › ${story.name}`, async ({ page }) => {
        await stage(page, story.id, mode);
        // One screen, not the full page. Every baseline is committed, and a
        // token change rewrites all of them, so size is history: a full-page
        // matrix was 70 MB. A story whose point is below the fold should be
        // split into a story that opens on it.
        await expect(page).toHaveScreenshot([mode.name, `${story.id}.png`], {
          animations: 'disabled',
          // Same image, same pixels: anything beyond antialiasing noise is a
          // change. 100 px is less than one word of body text.
          maxDiffPixels: 100,
        });
      });
    }
  });
}
