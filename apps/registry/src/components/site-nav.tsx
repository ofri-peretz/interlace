import Link from 'next/link';

import { BrandLogo } from '@interlace/ui/patterns/brand-logo';

/**
 * Shared header nav for every page on ds.interlace.tools.
 *
 * Single source of truth — Phase 5 of the 5-layer DS architecture
 * extracted this from `apps/registry/src/app/page.tsx` so adding a new
 * docs route (e.g. `/css-contract`) becomes a one-line edit instead of
 * a hunt across N page files.
 *
 * Routes mounted under `apps/registry/src/app/<slug>/page.tsx` get a
 * SiteNav at the top by importing this component. The sitemap.ts
 * auto-pickup keeps `/<slug>` in the XML output without further
 * coordination.
 */
const STORYBOOK_URL = 'https://storybook.interlace.tools';
const REPO_URL = 'https://github.com/ofri-peretz/interlace';

interface NavLink {
  href: string;
  label: string;
  /** External (renders with ↗ + opens in new tab). */
  external?: boolean;
}

const LINKS: NavLink[] = [
  { href: '/getting-started', label: 'Getting started' },
  { href: '/css-contract', label: 'CSS contract' },
  { href: '/theme-authoring', label: 'Theme authoring' },
  { href: '/semantics-catalog', label: 'Semantics' },
  { href: '/changelog', label: 'Changelog' },
  { href: STORYBOOK_URL, label: 'Storybook', external: true },
  { href: REPO_URL, label: 'GitHub', external: true },
];

export function SiteNav() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-10">
      <div className="mx-auto flex min-h-14 max-w-wide flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-2 sm:py-0">
        <Link href="/" className="flex items-center gap-2">
          <BrandLogo />
          <span className="text-muted-foreground hidden text-sm font-normal sm:inline">
            · shadcn registry
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:gap-5">
          {LINKS.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label} ↗
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
