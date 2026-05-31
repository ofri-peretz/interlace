/**
 * @interlace/ui — Topbar
 *
 * Site-wide horizontal navigation. The first pattern every landing /
 * docs / dashboard surface needs: logo (left), primary nav (middle/right),
 * action cluster (right). One row, sticky to the top, semi-transparent
 * backdrop blur so content scrolls visibly beneath without colour bleed.
 *
 * ## Anatomy
 *
 *   <header data-slot="topbar" data-min-viewport="320">
 *     <div className="container">
 *       <div className="logo">{logo}</div>
 *       <nav>{links.map(...)} </nav>
 *       <div className="actions">{actions}</div>
 *     </div>
 *   </header>
 *
 * ## MIN_VIEWPORT — 320
 *
 * Below 768, primary nav collapses (consumer can wire a Sheet+Drawer
 * compose for the hamburger menu). Above 768, the nav row is visible.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'header'>` + Topbar props             |
 * | R6   | data-slot on root                | `data-slot="topbar"`                                        |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R10  | Composition seam (slots)         | `logo` / `links` / `actions` ReactNode props                |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes only                   |
 * | R19  | Tokens only                      | `bg-background` / `border-border` / `text-muted-foreground` |
 * | R20  | AA contrast                      | semantic foregrounds on backdrop-blur background            |
 * | R25  | Server component                 | No hooks                                                    |
 * | R26  | A11y from native el              | `<header>` landmark, `<nav>` for the link cluster           |
 */

import * as React from 'react';
import Link from 'next/link';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

interface TopbarLink {
  href: string;
  label: React.ReactNode;
  external?: boolean;
}

interface TopbarProps extends React.ComponentProps<'header'> {
  /**
   * Logo / wordmark. Receives a `<Link href="/">…</Link>` typically.
   * No `href` default — consumer decides where the logo points.
   */
  logo: React.ReactNode;
  /** Primary nav link cluster. Hidden below md (768px). */
  links?: TopbarLink[];
  /** Right-aligned actions (Buttons, ThemeToggle, etc.). */
  actions?: React.ReactNode;
  /**
   * Container max-width. Defaults to `'wide'` (1280px). Set to
   * `'content'` (1024px) for narrower docs surfaces.
   */
  containerSize?: 'wide' | 'content' | 'prose';
}

const CONTAINER_CLASSES = {
  wide: 'max-w-(--container-wide)',
  content: 'max-w-(--container-content)',
  prose: 'max-w-(--container-prose)',
} as const;

function Topbar({
  logo,
  links = [],
  actions,
  containerSize = 'wide',
  className,
  ...props
}: TopbarProps) {
  return (
    <header
      data-slot="topbar"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        'border-border bg-background/80 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 border-b backdrop-blur',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'mx-auto flex h-14 items-center justify-between px-md',
          CONTAINER_CLASSES[containerSize],
        )}
      >
        <div className="flex items-center gap-sm">{logo}</div>
        {links.length > 0 ? (
          <nav
            aria-label="Primary"
            className="hidden items-center gap-md text-sm md:flex"
          >
            {links.map((link) =>
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
        ) : null}
        {actions ? (
          <div className="flex items-center gap-sm">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
Topbar.displayName = 'Topbar';

export { Topbar };
export type { TopbarProps, TopbarLink };
