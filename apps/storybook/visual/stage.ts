import { expect, type Page } from '@playwright/test';

import { storyUrl, type Mode } from './matrix';

/**
 * Put one story on stage, the same way every time.
 *
 * Every source of run-to-run difference is pinned here, so a failing
 * screenshot means the component changed and nothing else:
 *
 *   - Network: only the local Storybook is reachable. The preview's Google
 *     Fonts link is cut, so text renders in the image's own fonts whether or
 *     not the CDN answers on time. (Visual baselines are a layout and colour
 *     contract; the webfont is not ours to test.)
 *   - Time: `Date` is frozen, so "3 minutes ago" and calendars hold still.
 *   - Chance: `Math.random` is a seeded generator, so shuffles and generated
 *     sample data repeat.
 *   - Motion: the context runs with `reducedMotion: 'reduce'`, the system's
 *     own contract for "finish every draw now".
 */
export async function stage(page: Page, id: string, mode: Mode): Promise<void> {
  await page.setViewportSize(mode.viewport);
  await page.route(
    (url) => url.hostname !== '127.0.0.1' && url.hostname !== 'localhost',
    (route) => route.abort(),
  );
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await page.addInitScript(() => {
    // mulberry32: small, fast, and the same sequence on every run.
    let seed = 0x1f2e3d4c;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });

  await page.goto(storyUrl(id, mode), { waitUntil: 'load' });
  // Storybook marks the body once the story has rendered (or errored).
  await page.waitForFunction(
    () =>
      document.body.classList.contains('sb-show-main') ||
      document.body.classList.contains('sb-show-errordisplay'),
  );
  const error = await page.locator('#error-message').textContent().catch(() => null);
  if (await page.locator('body.sb-show-errordisplay').count()) {
    throw new Error(`Story ${id} failed to render: ${error ?? 'unknown error'}`);
  }
  await expect(page.locator('#storybook-root')).toBeAttached();
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Two frames: one for layout effects, one for whatever they scheduled.
    const frames = () =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await frames();
    // Then every finite animation and transition to its end, so axe and the
    // camera see the settled state, not a fade at 40% opacity. Looping
    // animations never finish; they are left to `animations: 'disabled'`.
    const finite = document
      .getAnimations()
      .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity);
    await Promise.race([
      Promise.all(finite.map((a) => a.finished.catch(() => undefined))),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    await frames();
  });
}
