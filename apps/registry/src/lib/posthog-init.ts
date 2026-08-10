/**
 * PostHog init for apps/registry (ds.interlace.tools).
 *
 * Per-property duplicate of the shared contract; identical to apps/docs
 * except for the `APP_ID`. See ANALYTICS_PHILOSOPHY.md (no shared
 * wrapper package).
 */
import posthog, { type PostHogConfig } from 'posthog-js';

export const APP_ID = 'ds' as const;

// Same-eTLD+1 cookie scope so `*.interlace.tools` shares one anon id.
// `cross_subdomain_cookie: true` makes posthog-js set the cookie domain
// to the page's eTLD+1 automatically.
const COOKIE_DOMAIN = '.interlace.tools';
void COOKIE_DOMAIN;

const STRIP_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ph_distinct_id',
  'ref',
]);

function normaliseCurrentUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const k of STRIP_PARAMS) u.searchParams.delete(k);
    const sorted = new URLSearchParams();
    for (const k of [...u.searchParams.keys()].sort()) {
      for (const v of u.searchParams.getAll(k)) sorted.append(k, v);
    }
    u.search = sorted.toString() ? `?${sorted.toString()}` : '';
    return u.toString();
  } catch {
    return url;
  }
}

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
  // Local dev short-circuit (ANALYTICS_PHILOSOPHY principle 9).
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
 * Browser noise that is not an application error.
 *
 * "ResizeObserver loop completed with undelivered notifications" is emitted by
 * the browser itself when an observer callback dirties layout in the same
 * frame. It is unactionable, and it arrives in bursts — a single Safari
 * session produced 27 of them here, which is enough to outrank every real bug
 * in the error inbox.
 *
 * "Script error." is the opaque cross-origin placeholder: no stack, no file,
 * no message. There is nothing to fix and no way to tell two of them apart.
 *
 * Dropped at source rather than triaged forever, so the inbox keeps meaning
 * "something is broken".
 */
const NOISY_EXCEPTIONS: RegExp[] = [
  /^ResizeObserver loop/i,
  /^Script error\.?$/i,
];

function isNoisyException(properties?: Record<string, unknown>): boolean {
  const list = properties?.['$exception_list'];
  if (!Array.isArray(list) || list.length === 0) return false;
  const value = (list[0] as { value?: unknown } | undefined)?.value;
  return typeof value === 'string' && NOISY_EXCEPTIONS.some((re) => re.test(value));
}

let initialised = false;

export function initPostHog(): void {
  if (typeof window === 'undefined') return;
  if (initialised) return;
  if (!isTrackingAllowed()) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) {
    if (process.env.NODE_ENV !== 'production') {

      console.debug(
        '[posthog] NEXT_PUBLIC_POSTHOG_KEY is empty — analytics disabled',
      );
    }
    return;
  }
  const disableReplay = process.env.NEXT_PUBLIC_POSTHOG_DISABLE_REPLAY === '1';
  const config: Partial<PostHogConfig> = {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    capture_performance: true,
    capture_exceptions: true,
    autocapture: true,
    cross_subdomain_cookie: true,
    disable_session_recording: disableReplay,
    ...(disableReplay
      ? {}
      : {
          session_recording: {
            maskAllInputs: true,
            maskTextSelector: '[data-ph-mask]',
          },
        }),
    before_send: (event) => {
      if (!event) return event;
      if (
        event.event === '$exception' &&
        isNoisyException(event.properties as Record<string, unknown> | undefined)
      )
        return null;
      try {
        const props = event.properties as Record<string, unknown> | undefined;
        if (props && typeof props['$current_url'] === 'string') {
          props['$current_url'] = normaliseCurrentUrl(
            props['$current_url'] as string,
          );
        }
        if (props && typeof props['$referrer'] === 'string') {
          props['$referrer'] = normaliseCurrentUrl(props['$referrer'] as string);
        }
      } catch {
        // never block ingest
      }
      return event;
    },
    loaded: (ph) => {
      try {
        ph.register({ app: APP_ID });
        if (
          typeof localStorage !== 'undefined' &&
          localStorage.getItem('interlace_internal') === '1'
        ) {
          ph.people.set({ is_internal_user: true });
        }
      } catch {
        // never throw
      }
    },
  };
  try {
    posthog.init(key, config);
    initialised = true;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {

      console.warn('[posthog] init failed', err);
    }
  }
}

export { posthog };
