/**
 * Storybook manager-side customizations.
 *
 * The *preview* side (per-story renders) lives in `preview.ts`. This file
 * configures the *manager* — the surrounding Storybook chrome: brand
 * logo + wordmark, sidebar/toolbar colors, manager toolbar visibility.
 *
 * Analytics: PostHog is initialised on the manager only, never inside the
 * preview iframe (per-story renders would blow up event volume — see
 * ANALYTICS_PHILOSOPHY principle 6). We capture a manager `$pageview` on
 * mount and a `storybook:story_view` whenever a story finishes rendering.
 */
import { addons } from 'storybook/manager-api';
import type { Channel } from 'storybook/internal/channels';
import {
  STORY_FINISHED,
  STORY_RENDERED,
  type StoryFinishedPayload,
} from 'storybook/internal/core-events';

import theme from './theme';
import {
  initStorybookPostHog,
  trackManagerEvent,
  trackManagerPageview,
} from './posthog';

addons.setConfig({
  theme,
  showToolbar: true,
  sidebar: {
    showRoots: true,
  },
});

/**
 * Run `cb` with the manager channel, once the REAL channel exists.
 *
 * `addons.getChannel()` is not a passive getter. Called before Storybook has
 * installed the real channel it CONSTRUCTS a throwaway one, caches it, and
 * hands that back — and the real channel replaces it moments later. Measured
 * on a cold manager boot here: the module-scope call returned a channel with
 * sender `8edc94274b18f8` and 1 transport, and ~372ms later
 * `addons.getChannel()` was returning sender `a1e890cb444398` with 2
 * transports. Anything subscribed to the first object is subscribed to an
 * orphan: it is wired to nothing, it never throws, and it never fires.
 *
 * That is not hypothetical — it is what the previous version of this file did
 * to the PostHog `STORY_RENDERED` listener below, which is why `hasChannel()`
 * now gates every acquisition.
 */
function withManagerChannel(cb: (channel: Channel) => void): void {
  if (typeof window === 'undefined') return;
  const attempt = (): boolean => {
    if (!addons.hasChannel()) return false;
    cb(addons.getChannel());
    return true;
  };
  if (attempt()) return;
  const interval = setInterval(() => {
    if (attempt()) clearInterval(interval);
  }, 50);
  // Never poll forever if something upstream changes.
  setTimeout(() => clearInterval(interval), 30_000);
}

/**
 * Back-fill the Accessibility panel when it mounts after the scan finished.
 *
 * ─── The bug ──────────────────────────────────────────────────────
 *
 * On a hard page load every story's Accessibility panel sat on "Preparing
 * accessibility scan — Please wait while the addon is initializing…"
 * permanently. A gate that never runs while the system advertises strict
 * WCAG 2.2 AA + ACT is a false claim, so this is not cosmetic.
 *
 * What is NOT wrong (all four verified against a running Storybook, so nobody
 * re-litigates them):
 *   1. The preview annotation IS registered. The generated
 *      `virtual:/@storybook/builder-vite/project-annotations.js` imports
 *      `@storybook/addon-a11y/dist/preview.js` — Storybook 10 resolves the
 *      addon's `./preview` subpath itself, which is why `preset.js` exporting
 *      only `isAddonA11yEnabled` is correct and not a packaging bug.
 *   2. The scan RUNS. `afterEach` completes and the preview reaches phase
 *      `finished`.
 *   3. `STORY_FINISHED` FIRES, and it carries a real a11y reporter. Read back
 *      off the manager channel on a stuck load, `channel.last(STORY_FINISHED)`
 *      held `{ type: 'a11y', status: 'passed' }` with 13 passes and 0
 *      violations for the very story whose panel claimed to be initializing.
 *   4. The parameters are right (`context`, globals-`manual`). Changing them
 *      changes nothing, because nothing ever reads the result.
 *
 * The actual defect is a subscribe-after-emit race on the MANAGER side. The
 * panel's `A11yContextProvider` subscribes to `STORY_FINISHED` only when the
 * Accessibility tab is actually activated — not when the manager boots, and
 * not merely because `addonPanel=storybook/a11y/panel` is in the URL. On a
 * hard load the preview wins that race: the report is delivered to a channel
 * with zero listeners for it. Confirmed by listener census — on a stuck load
 * the channel had NO `storyFinished` listener at all, yet the retained report
 * was sitting right there — and the panel has no back-fill path. `status`
 * starts at `initial` and leaves it only via an event it must already be
 * mounted to hear. So the result is not late; it is dropped, forever.
 *
 * Navigating to another story hides this: by then the panel is subscribed, so
 * the second story scans normally. That is why this reads as "the addon never
 * initializes" rather than "the first render is missed".
 *
 * ─── The fix ──────────────────────────────────────────────────────
 *
 * `Channel.handleEvent` records `this.data[type] = args` for EVERY event it
 * receives, whether or not anyone was listening, and exposes it as
 * `channel.last(type)`. So the dropped report is not lost — it is retained.
 * When the panel's subscription appears (0 → 1 listeners on the addon's RESULT
 * event) we re-emit the retained report on the addon's own
 * `storybook/a11y/result` channel event, which is exactly what its `handleResult`
 * consumes.
 *
 * Three properties worth stating, because each is a way this could have been
 * done wrong:
 *
 *   1. It REPLAYS, it does not re-scan and it does not fabricate. The payload
 *      is the untouched result of the real axe run, produced by the real
 *      `parameters.a11y` — the strict seven-tag stack, AAA contrast included.
 *      Nothing here can make the panel greener than the scan was. A re-scan
 *      triggered from the manager could: `EVENTS.MANUAL` with no payload falls
 *      back to the addon's `DEFAULT_PARAMETERS` (`{config:{},options:{}}`),
 *      which would silently drop the tag stack and the `#storybook-root`
 *      context and report a WEAKER scan as if it were ours. That is the trap
 *      this deliberately avoids.
 *   2. It fires only on the 0 → N transition. During normal story navigation
 *      the panel is already subscribed and receives the live event, so the
 *      count never returns to 0 and no replay happens. The back-fill is
 *      exactly scoped to the late-mount case.
 *   3. The storyId guard is upstream's, not ours. `handleResult` ignores any
 *      result whose id does not match the panel's current story, so a stale
 *      retained report cannot be shown against a different story.
 */
const A11Y_RESULT_EVENT = 'storybook/a11y/result';
const A11Y_ERROR_EVENT = 'storybook/a11y/error';

withManagerChannel((channel) => {
  let previousListenerCount = 0;

  const backfill = (): void => {
    const count = channel.listeners(A11Y_RESULT_EVENT)?.length ?? 0;
    const justSubscribed = previousListenerCount === 0 && count > 0;
    previousListenerCount = count;
    if (!justSubscribed) return;

    const retained = channel.last(STORY_FINISHED) as
      | [StoryFinishedPayload]
      | undefined;
    const storyId = retained?.[0]?.storyId;
    const result: unknown = retained?.[0]?.reporters?.find(
      (r) => r.type === 'a11y',
    )?.result;
    if (!storyId || !result) return;

    // Mirror the panel's own `handleReport`: an errored scan is an error,
    // not an empty pass.
    const errored = typeof result === 'object' && 'error' in result;
    if (errored) {
      channel.emit(A11Y_ERROR_EVENT, (result as { error: unknown }).error);
    } else {
      channel.emit(A11Y_RESULT_EVENT, result, storyId);
    }
  };

  backfill();
  // The panel can mount at any time — the user may never open the
  // Accessibility tab — so this watch is intentionally long-lived rather
  // than a boot-time one-shot. It is one listener-count read every 100ms,
  // and it ends with the page.
  setInterval(backfill, 100);
});

// Defer until the manager has finished its first render cycle.
if (typeof window !== 'undefined') {
  try {
    const ph = initStorybookPostHog();
    if (ph) {
      trackManagerPageview();
      // Was `addons.getChannel()` inline, which on a cold boot subscribed to
      // the orphan channel described above — so `storybook:story_view` had
      // never fired in production.
      withManagerChannel((channel) => {
        channel.on(STORY_RENDERED, (storyId: string) => {
          trackManagerEvent('storybook:story_view', { storyId });
        });
      });
    }
  } catch {
    // Never let analytics break the manager boot.
  }
}
