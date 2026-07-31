import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import { PostHogProvider } from '@/components/posthog-provider';
import { PostHogPageviewTracker } from '@/components/posthog-pageview-tracker';

export const metadata: Metadata = {
  title: {
    default: 'Interlace Design System Registry',
    template: '%s — Interlace DS',
  },
  description:
    'Shadcn-compatible component registry for @interlace/ui. Production-grade React primitives, drop-in via the shadcn CLI.',
  metadataBase: new URL('https://ds.interlace.tools'),
  openGraph: {
    title: 'Interlace Design System Registry',
    description: 'Production-grade React primitives, shadcn-compatible.',
    url: 'https://ds.interlace.tools',
    siteName: 'Interlace DS',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Interlace Design System Registry',
    description: 'Production-grade React primitives, shadcn-compatible.',
  },
};

/**
 * System-following dark mode. The DS dark variant is class-based
 * (`@custom-variant dark (&:is(.dark *))`), but this app shipped with
 * nothing ever SETTING the class — dark-preference users got the light
 * theme forever. No toggle UI (the registry is a docs surface, not an
 * app): we follow `prefers-color-scheme`, live-updating on OS switch.
 * Inline + blocking so the first paint is already correct (no flash);
 * `suppressHydrationWarning` on <html> already covers the class mutation.
 */
const THEME_SCRIPT = `(function () {
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  var apply = function () {
    document.documentElement.classList.toggle('dark', mq.matches);
  };
  apply();
  mq.addEventListener('change', apply);
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <PostHogProvider>
          <PostHogPageviewTracker />
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
