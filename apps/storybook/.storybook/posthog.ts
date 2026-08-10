/**
 * PostHog init for the Storybook manager surface.
 *
 * Manager-only — never injected into the preview iframe (per-story
 * tracking would explode event volume for no signal per
 * ANALYTICS_PHILOSOPHY principle 6).
 *
 * Captures:
 * - `$pageview` on manager mount.
 * - `storybook:story_view` on every story-render channel event.
 *
 * Silent no-op when env key is missing, DNT/GPC, or running in a
 * non-browser context (e.g. Vitest CI build of the manager bundle).
 */
import posthog, { type PostHogConfig } from 'posthog-js';

const APP_ID = 'ds_storybook' as const;
// `cross_subdomain_cookie: true` makes posthog set the cookie on
// `.interlace.tools` automatically (the page's eTLD+1).
const COOKIE_DOMAIN = '.interlace.tools';
void COOKIE_DOMAIN;

function isLocalEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.localhost')
  );
}

function isLocalOptIn(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem('interlace_local_analytics') === '1';
  } catch {
    return false;
  }
}

function isTrackingAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof navigator === 'undefined') return false;
  // Local dev short-circuit. Storybook dev server runs on localhost:6006,
  // so without this every story-flip would pollute production cohorts.
  if (isLocalEnvironment() && !isLocalOptIn()) return false;
  const dnt = navigator.doNotTrack;
  if (dnt === '1' || dnt === 'yes') return false;
  const gpc = (
    navigator as Navigator & { globalPrivacyControl?: boolean }
  ).globalPrivacyControl;
  if (gpc === true) return false;
  return true;
}

/**
 * The key, or null.
 *
 * `process.env.STORYBOOK_POSTHOG_KEY` is written out in full, exactly once,
 * and that is not stylistic. This module is imported by manager.ts, and the
 * Storybook manager is bundled by **esbuild, not Vite** — so `import.meta.env`
 * is never substituted here and is stripped from the output entirely.
 * Storybook's own mechanism is to `define`-replace the literal text
 * `process.env.STORYBOOK_POSTHOG_KEY` at build time, which means any variation
 * on that string silently defeats it.
 *
 * The previous implementation had both failure modes at once: it read
 * `import.meta.env` first (never substituted in this bundle) and fell back to
 * `process.env?.STORYBOOK_POSTHOG_KEY` — the optional chain makes the text no
 * longer match the define, so it was replaced by nothing and evaluated to
 * undefined in a browser that has no `process` at all.
 *
 * Verified against the deployed bundle: sb-addons/.../manager-bundle.js
 * contained the PostHog code but zero occurrences of `phc_`. The env var was
 * set in Vercel the whole time; the value simply had no way to reach the
 * bundle. Storybook had therefore never sent a single event.
 *
 * `import.meta.env` is still consulted, second, so the same module keeps
 * working if it is ever imported from the Vite-built preview bundle.
 */
function getKey(): string | null {
  try {
    const defined = process.env.STORYBOOK_POSTHOG_KEY;
    if (typeof defined === 'string' && defined.trim()) return defined.trim();

    const m = (
      import.meta as ImportMeta & {
        env?: Record<string, string | undefined>;
      }
    ).env;
    const key = m?.STORYBOOK_POSTHOG_KEY ?? m?.VITE_POSTHOG_KEY;
    return key?.trim() || null;
  } catch {
    return null;
  }
}

let initialised = false;

export function initStorybookPostHog(): typeof posthog | null {
  if (initialised) return posthog;
  if (!isTrackingAllowed()) return null;
  const key = getKey();
  if (!key) {
    // Visible, not silent. This is a static Storybook build: the key is baked
    // in at build time from VITE_POSTHOG_KEY, so a missing var produces a
    // deploy that looks completely healthy and reports nothing at all — which
    // is exactly how this surface went unmeasured. Say so in the console.
    if (import.meta.env?.DEV) {
      console.debug(
        '[posthog] VITE_POSTHOG_KEY is empty — Storybook analytics disabled',
      );
    }
    return null;
  }
  const config: Partial<PostHogConfig> = {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    capture_performance: true,
    capture_exceptions: true,
    autocapture: false,
    cross_subdomain_cookie: true,
    disable_session_recording: true,
    loaded: (ph) => {
      try {
        ph.register({ app: APP_ID });
      } catch {
        // never throw
      }
    },
  };
  try {
    posthog.init(key, config);
    initialised = true;
    return posthog;
  } catch {
    return null;
  }
}

export function trackManagerEvent(
  name: string,
  payload: Record<string, unknown>,
): void {
  if (!initialised) return;
  try {
    posthog.capture(name, payload);
  } catch {
    // swallow
  }
}

export function trackManagerPageview(extra?: Record<string, unknown>): void {
  if (!initialised) return;
  try {
    posthog.capture('$pageview', {
      $current_url:
        typeof window !== 'undefined' ? window.location.href : undefined,
      ...extra,
    });
  } catch {
    // swallow
  }
}
