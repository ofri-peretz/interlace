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
 *       <nav>{links.map(...)} </nav>          (md and up)
 *       <div className="actions">{actions}</div>
 *       <TopbarMenu>{links}</TopbarMenu>      (below md, mobileNav="menu")
 *     </div>
 *     <nav>{links}</nav>                      (below md, mobileNav="wrap")
 *     </div>
 *   </header>
 *
 * ## MIN_VIEWPORT — 320
 *
 * Below 768 the links never disappear. By default they move into a "Menu"
 * button that opens a side sheet (`TopbarMenu`); `mobileNav="wrap"` shows
 * them as a second, wrapping row instead, which suits sites with three or
 * four short links. Above 768, the nav row is visible.
 *
 * ## Current page
 *
 * Pass `currentHref` and the matching link gets `aria-current="page"` and a
 * visible current style (foreground colour and an underline), in both the
 * row and the menu. `renderLink` receives `aria-current` so a framework link
 * forwards it.
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
 * | R25  | Server component                 | No hooks; the menu's open state lives in `TopbarMenu`       |
 * | R26  | A11y from native el              | `<header>` landmark, `<nav>` for the link cluster           |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { TopbarMenu } from './topbar-menu.js';

export const MIN_VIEWPORT = 320 as const;

interface TopbarLink {
  href: string;
  label: React.ReactNode;
  external?: boolean;
}

interface TopbarLinkRenderProps {
  href: string;
  className: string;
  children: React.ReactNode;
  'aria-current'?: 'page';
}

interface TopbarProps extends React.ComponentProps<'header'> {
  /**
   * Logo / wordmark. Receives a `<a href="/">…</a>` or a framework-
   * specific Link (Next.js Link, React Router NavLink, etc.) — the DS
   * is platform-agnostic so the consumer decides which.
   */
  logo: React.ReactNode;
  /** Primary nav links. A row from md up; below md, see `mobileNav`. */
  links?: TopbarLink[];
  /** Right-aligned actions (Buttons, ThemeToggle, etc.). */
  actions?: React.ReactNode;
  /**
   * Container max-width. Defaults to `'wide'` (1280px). Set to
   * `'content'` (1024px) for narrower docs surfaces.
   */
  containerSize?: 'wide' | 'content' | 'prose';
  /**
   * The current page's href. The link with this exact href is marked
   * `aria-current="page"` and styled as current.
   */
  currentHref?: string;
  /**
   * What the links do below md: `menu` puts them behind a Menu button in a
   * side sheet, `wrap` shows them as a second row, `none` hides them (only
   * when the page offers another way to reach them). @default 'menu'
   */
  mobileNav?: 'menu' | 'wrap' | 'none';
  /** Label of the small-screen menu button. @default 'Menu' */
  menuLabel?: string;
  /**
   * Render-prop slot for internal links. Defaults to a plain `<a>`. A
   * Next.js consumer passes `({ href, className, children, ...rest }) =>
   * <Link href={href} className={className} {...rest}>{children}</Link>`
   * to enable SPA navigation; spreading `rest` forwards `aria-current`.
   * External links (`link.external === true`) always use a plain
   * `<a target="_blank">` regardless of this slot.
   */
  renderLink?: (props: TopbarLinkRenderProps) => React.ReactElement;
}

const defaultRenderLink: NonNullable<TopbarProps['renderLink']> = ({ href, className, children, ...rest }) => (
  <a href={href} className={className} {...rest}>
    {children}
  </a>
);

const CONTAINER_CLASSES = {
  wide: 'max-w-(--container-wide)',
  content: 'max-w-(--container-content)',
  prose: 'max-w-(--container-prose)',
} as const;

/** Link styles per place. Current = foreground + underline, never colour alone. */
const LINK = {
  row: 'text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-[1.15rem] transition-colors',
  wrap: 'text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-4 inline-flex min-h-11 items-center transition-colors',
  menu: 'text-foreground hover:bg-muted aria-[current=page]:bg-muted flex min-h-11 items-center rounded-md px-3 font-medium aria-[current=page]:font-semibold',
} as const;

function renderLinks(
  links: TopbarLink[],
  place: keyof typeof LINK,
  currentHref: string | undefined,
  renderLink: NonNullable<TopbarProps['renderLink']>,
) {
  return links.map((link) => {
    const className = LINK[place];
    if (link.external) {
      return (
        <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
          {link.label} <span aria-hidden>↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      );
    }
    const current = currentHref !== undefined && link.href === currentHref;
    return (
      <React.Fragment key={link.href}>
        {renderLink({
          href: link.href,
          className,
          children: link.label,
          ...(current ? { 'aria-current': 'page' as const } : {}),
        })}
      </React.Fragment>
    );
  });
}

function Topbar({
  logo,
  links = [],
  actions,
  containerSize = 'wide',
  currentHref,
  mobileNav = 'menu',
  menuLabel = 'Menu',
  renderLink = defaultRenderLink,
  className,
  ...props
}: TopbarProps) {
  const hasLinks = links.length > 0;
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
          'mx-auto flex h-14 items-center justify-between gap-4 px-6',
          CONTAINER_CLASSES[containerSize],
        )}
      >
        <div className="flex items-center gap-4">{logo}</div>
        {hasLinks ? (
          <nav aria-label="Primary" className="hidden items-center gap-6 text-sm md:flex">
            {renderLinks(links, 'row', currentHref, renderLink)}
          </nav>
        ) : null}
        {actions || (hasLinks && mobileNav === 'menu') ? (
          <div className="flex items-center gap-2 md:gap-4">
            {actions}
            {hasLinks && mobileNav === 'menu' ? (
              <div className="md:hidden">
                <TopbarMenu label={menuLabel}>{renderLinks(links, 'menu', currentHref, renderLink)}</TopbarMenu>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {hasLinks && mobileNav === 'wrap' ? (
        <nav
          aria-label="Primary"
          data-slot="topbar-wrap-nav"
          className="flex flex-wrap items-center gap-x-5 px-6 pb-1 text-sm md:hidden"
        >
          {renderLinks(links, 'wrap', currentHref, renderLink)}
        </nav>
      ) : null}
    </header>
  );
}
Topbar.displayName = 'Topbar';

export { Topbar };
export type { TopbarProps, TopbarLink, TopbarLinkRenderProps };
