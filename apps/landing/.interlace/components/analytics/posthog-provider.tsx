/**
 * AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Source: apps/interlace-docs-baseline/ in the agents repo.
 * Edit there, then run `npm run sync` to redistribute.
 * Local edits will be overwritten on next sync (or refused without --force).
 */
"use client";

/**
 * PostHog client provider — wires `posthog-js` once at the app shell and
 * captures a `$pageview` event on every route change.
 *
 * One shared PostHog project (id 428927) serves all our apps; the `app`
 * prop is registered as a super-property so every event carries its
 * source. PostHog dashboards filter on `properties.app` to scope by
 * site (blog / interlace-landing / storybook) or compare across.
 *
 * Next.js App Router doesn't fire a navigation event posthog-js can
 * hook (PostHog's `capture_pageview: true` only works on hard loads +
 * popstate). The `usePathname()` effect below fills the gap so SPA
 * route transitions count.
 *
 * Required Vercel env (Production scope on each app):
 *   NEXT_PUBLIC_POSTHOG_KEY  — publishable project key, starts `phc_...`
 *                              Safe to expose client-side by design.
 *   NEXT_PUBLIC_POSTHOG_HOST — optional override; defaults to `/ingest`,
 *                              the same-origin reverse proxy (see below)
 *
 * If `NEXT_PUBLIC_POSTHOG_KEY` is missing the provider is a no-op — site
 * still renders, no analytics. Same defensive pattern the scorecard
 * Supabase fetchers use.
 *
 * Naming + tracking conventions live in `ANALYTICS_PHILOSOPHY.md` at the
 * agents repo root. Read it before adding new events / properties.
 */

import posthog from "posthog-js";
import { PostHogProvider as Provider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// Defaults to the same-origin reverse proxy (ANALYTICS_PHILOSOPHY §9): ad
// blockers match on the `*.i.posthog.com` hostname, so going direct silently
// loses ~30-40% of visitors. Consuming apps MUST carry the matching
// `/ingest/*` rewrites in their next.config — an app without them can opt back
// out by setting NEXT_PUBLIC_POSTHOG_HOST to the absolute PostHog host.
// Truthy-or, not nullish-coalescing. The Vercel production env defines
// NEXT_PUBLIC_POSTHOG_HOST as an EMPTY STRING on at least one project, and
// ?? only falls back on null/undefined — a blank value would sail straight
// through and set api_host to "", silently breaking ingest on the flagship
// site. Trim-and-truthy treats "declared but blank" as "not declared".
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "/ingest";
// Relative api_host means posthog-js can no longer infer where the PostHog UI
// lives; without this, toolbar/session links point at our own origin and 404.
const POSTHOG_UI_HOST = "https://us.posthog.com";

export type AppName =
  | "blog"
  | "interlace-landing"
  | "baseline-storybook"
  | "eslint-docs"
  | "serverless-docs";

export interface PostHogProviderProps {
  /**
   * App identifier — registered as a super-property so every event from
   * this app carries `properties.app = '<name>'`. Required because we
   * use ONE shared PostHog project across all sites.
   */
  app: AppName;
  children: React.ReactNode;
}

/**
 * Browser noise that is not an application error.
 *
 * "ResizeObserver loop completed with undelivered notifications" is emitted by
 * the browser itself when an observer callback dirties layout in the same
 * frame. It is unactionable and arrives in bursts — one Safari session
 * produced 27 of them, enough to outrank every real bug in the shared inbox.
 *
 * "Script error." is the opaque cross-origin placeholder: no stack, no file,
 * no message. There is nothing to fix and no way to tell two of them apart.
 *
 * This lives in the provider, not just in the standalone `posthog-init.ts`
 * apps, because `capture_exceptions` is enabled here too — so without it the
 * two highest-traffic properties (blog and the landing site) were the only
 * ones still reporting the noise the other four had already filtered out.
 *
 * Anchored regexes against the first frame, deliberately, rather than a
 * substring match: a genuine error whose message merely mentions
 * ResizeObserver must still report.
 */
const NOISY_EXCEPTIONS: RegExp[] = [
  /^ResizeObserver loop/i,
  /^Script error\.?$/i,
];

function isNoisyException(properties?: Record<string, unknown>): boolean {
  const list = properties?.["$exception_list"];
  if (!Array.isArray(list) || list.length === 0) return false;
  const value = (list[0] as { value?: unknown } | undefined)?.value;
  return (
    typeof value === "string" && NOISY_EXCEPTIONS.some((re) => re.test(value))
  );
}

let initialized = false;
function ensureInit(app: AppName): void {
  if (initialized || typeof window === "undefined" || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    // Inside its own guard, and never allowed to throw: dropping noise must
    // not become a way to drop real events.
    before_send: (event) => {
      if (!event) return event;
      try {
        if (
          event.event === "$exception" &&
          isNoisyException(
            event.properties as Record<string, unknown> | undefined,
          )
        ) {
          return null;
        }
      } catch {
        /* never block ingest */
      }
      return event;
    },
    api_host: POSTHOG_HOST,
    ui_host: POSTHOG_UI_HOST,
    person_profiles: "identified_only",
    // Cookie-free: no ph_ cookie → no GDPR consent banner needed for EU.
    persistence: "memory",
    // Manual `$pageview` capture via PageviewTracker below.
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    // Error capturing — unhandled exceptions + promise rejections land in
    // PostHog Error Tracking as `$exception` events (ANALYTICS_PHILOSOPHY).
    capture_exceptions: true,
    // Web vitals — LCP / CLS / INP / FCP / TTFB captured as `$web_vitals`
    // events, powering the performance dashboard without a separate tool.
    capture_performance: true,
  });
  // Super-property: attached to every event from this app for the lifetime
  // of the JS session (no localStorage — matches `persistence: "memory"`).
  posthog.register({ app });
  initialized = true;
}

export function PostHogProvider({ app, children }: PostHogProviderProps) {
  if (typeof window !== "undefined") ensureInit(app);
  if (!POSTHOG_KEY) return <>{children}</>;
  return (
    <Provider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </Provider>
  );
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
