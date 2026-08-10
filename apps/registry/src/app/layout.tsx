import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { THEME_SCRIPT } from '@interlace/ui/theme-script';

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
 * The no-flash theme bootstrap — the DS one, not a local copy.
 *
 * This app used to inline its own three-line script that did half the job:
 * it toggled `.dark` off `prefers-color-scheme` and knew nothing about the
 * `[data-theme]` axis or about a stored preference, because at the time
 * there was no switcher and no second theme. Both now exist (Phase 8.3),
 * and the moment a reader can CHOOSE, a bootstrap that only reads the OS is
 * worse than none: every reload repaints their choice away for a frame
 * before React catches up — the single most visible way a theme system
 * fails, demoed to every visitor of the page that sells the theme system.
 *
 * `THEME_SCRIPT` (packages/ui/src/lib/theme-script.ts) reads the stored
 * theme + scheme, validates both against the registry, falls back to
 * `prefers-color-scheme` when the user has expressed no preference, and
 * sets `style.color-scheme` so the browser's own chrome (scrollbars, form
 * controls) matches. Importing it — rather than re-typing it — is also what
 * keeps this page honest when a theme is added: the script is derived from
 * `THEMES`, so a new theme cannot leave the registry site behind.
 *
 * `suppressHydrationWarning` on <html> is required and stays: the script
 * deliberately mutates the element React is about to hydrate.
 */
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
