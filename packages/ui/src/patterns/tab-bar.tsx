/**
 * @interlace/ui — TabBar
 *
 * The row of three to five destinations at the bottom of a phone screen,
 * where a thumb reaches. Each tab is a real link with an icon and a word;
 * the current one says so to assistive tech (`aria-current="page"`) and to
 * the eye with a filled pill behind its icon and a heavier label, never by
 * colour alone.
 *
 * ## Anatomy
 *
 *   <nav data-slot="tab-bar" aria-label="Primary">
 *     <ul>
 *       <li><a data-slot="tab-bar-item" aria-current="page">
 *         <span data-slot="tab-bar-icon">{icon}<span data-slot="tab-bar-badge" /></span>
 *         <span data-slot="tab-bar-label">{label}</span>
 *       </a></li>
 *     </ul>
 *   </nav>
 *
 * ## Placement
 *
 * The bar is `sticky` to the bottom of the viewport, so it sits after the
 * page's content and never covers the last line of it. Put it last inside
 * `AppShell` (or any column at least as tall as the screen). It pads itself
 * by the device's safe areas (`env(safe-area-inset-*)`), which needs
 * `viewport-fit=cover` in the page's viewport meta.
 *
 * `hideFrom` hides it from a width up (`md` by default), where a Topbar or
 * a sidebar takes over the same links. `hideFrom="never"` keeps it.
 *
 * ## Motion
 *
 * The current tab's pill grows in from the middle (150ms, `--ease-enter`)
 * when it changes, a press dips the icon slightly, and under reduced motion
 * the pill is simply there.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Five tabs share 320px at 64px each; a label longer than its tab wraps
 * onto a second line, hyphenated where the page sets `lang`, instead of being cut.
 *
 * | Rule | Concept                  | Where in this file                                |
 * | ---- | ------------------------ | ------------------------------------------------- |
 * | R4   | Extends native el        | `React.ComponentProps<'nav'>` + TabBar props      |
 * | R6   | data-slot per part       | tab-bar, tab-bar-item, -icon, -label, -badge      |
 * | R7   | className merged + rest  | `cn(BASE, className)` + `{...props}`              |
 * | R14  | Declares min viewport    | `data-min-viewport` + exported const              |
 * | R19  | Tokens only              | `bg-background`, `bg-muted`, `text-primary`       |
 * | R25  | Server component         | no hooks; links are plain or `renderLink`         |
 * | R26  | A11y from native el      | `<nav>` landmark, a list, `aria-current="page"`   |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

export interface TabBarItem {
  href: string;
  /** The tab's word. Always shown: an icon alone is a guess. */
  label: React.ReactNode;
  /** An outlined icon, decorative (hidden from assistive tech). */
  icon: React.ReactNode;
  /** The icon for the current tab, such as a filled version. Falls back to `icon`. */
  activeIcon?: React.ReactNode;
  /**
   * A count or a dot on the icon: a number shows the number (99+ above 99), `true`
   * shows a dot. Pair it with `badgeLabel`, since the mark itself is hidden.
   */
  badge?: number | boolean;
  /** Read after the label when there is a badge, such as "3 new". */
  badgeLabel?: string;
}

export interface TabBarLinkRenderProps {
  href: string;
  className: string;
  children: React.ReactNode;
  'aria-current'?: 'page';
  'data-slot': 'tab-bar-item';
  'data-active'?: '';
}

export interface TabBarProps extends Omit<React.ComponentProps<'nav'>, 'children'> {
  /** Three to five destinations, in order. */
  items: TabBarItem[];
  /**
   * The current page's href. The tab with this href is current; a deeper page
   * (`/answers/42` under `/answers`) keeps its tab current. `/` matches only itself.
   */
  currentHref?: string;
  /**
   * The width from which the bar is hidden, because a Topbar or sidebar shows the
   * same links there. @default 'md'
   */
  hideFrom?: 'sm' | 'md' | 'lg' | 'xl' | 'never';
  /**
   * Render-prop for links, for a framework's router link. Spread the rest so
   * `aria-current` and the data attributes reach the element.
   */
  renderLink?: (props: TabBarLinkRenderProps) => React.ReactElement;
}

const defaultRenderLink: NonNullable<TabBarProps['renderLink']> = ({ href, children, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
);

/** Each breakpoint spelled out, so Tailwind sees every class it needs. */
const HIDE_FROM = {
  sm: 'sm:hidden',
  md: 'md:hidden',
  lg: 'lg:hidden',
  xl: 'xl:hidden',
  never: '',
} as const;

const ITEM = cn(
  'group/tab relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5',
  'text-muted-foreground text-xs font-medium',
  'hover:text-foreground data-active:text-foreground data-active:font-semibold',
  'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
  'motion-safe:transition-colors motion-safe:duration-(--duration-fast)',
  '[-webkit-tap-highlight-color:transparent]',
);

/** Whether `href` is the current page or one of its children. */
export function isTabCurrent(href: string, currentHref: string | undefined): boolean {
  if (currentHref === undefined) return false;
  const path = currentHref.split(/[?#]/)[0]!;
  if (href === '/') return path === '/';
  const base = href.replace(/\/+$/, '');
  return path === base || path.startsWith(`${base}/`);
}

function badgeText(badge: number): string {
  return badge > 99 ? '99+' : String(badge);
}

function TabBar({
  items,
  currentHref,
  hideFrom = 'md',
  renderLink = defaultRenderLink,
  className,
  'aria-label': ariaLabel = 'Primary',
  ...props
}: TabBarProps) {
  // The longest matching href wins, so `/answers/saved` beats `/answers`.
  const current = items
    .filter((item) => isTabCurrent(item.href, currentHref))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav
      data-slot="tab-bar"
      data-min-viewport={String(MIN_VIEWPORT)}
      aria-label={ariaLabel}
      className={cn(
        'border-border bg-background/90 supports-backdrop-filter:bg-background/75 sticky bottom-0 z-header border-t backdrop-blur',
        'px-[max(env(safe-area-inset-left,0px),env(safe-area-inset-right,0px))] pb-[env(safe-area-inset-bottom,0px)]',
        HIDE_FROM[hideFrom],
        className,
      )}
      {...props}
    >
      <ul className="mx-auto grid max-w-(--container-content) auto-cols-fr grid-flow-col px-1">
        {items.map((item) => {
          const active = item.href === current;
          const hasBadge = item.badge !== undefined && item.badge !== false && item.badge !== 0;
          return (
            <li key={item.href} className="flex min-w-0 flex-col">
              {renderLink({
                href: item.href,
                className: ITEM,
                'data-slot': 'tab-bar-item',
                ...(active ? { 'aria-current': 'page' as const, 'data-active': '' as const } : {}),
                children: (
                  <>
                    <span aria-hidden data-slot="tab-bar-icon" className="relative flex h-8 w-14 items-center justify-center">
                      <span
                        aria-hidden
                        data-slot="tab-bar-pill"
                        className={cn(
                          'bg-muted absolute inset-0 scale-x-50 rounded-full opacity-0',
                          'group-data-active/tab:scale-x-100 group-data-active/tab:opacity-100',
                          'motion-safe:transition-[scale,opacity] motion-safe:duration-(--duration-base) motion-safe:ease-enter',
                        )}
                      />
                      <span
                        aria-hidden
                        className="relative flex motion-safe:transition-transform motion-safe:duration-(--duration-fast) group-active/tab:scale-90 [&_svg]:size-6"
                      >
                        {active ? (item.activeIcon ?? item.icon) : item.icon}
                      </span>
                      {hasBadge ? (
                        <span
                          aria-hidden
                          data-slot="tab-bar-badge"
                          className={cn(
                            'bg-primary text-primary-foreground ring-background absolute rounded-full ring-2',
                            item.badge === true
                              ? 'end-3 top-0.5 size-2.5'
                              : 'start-[calc(50%+0.25rem)] -top-0.5 min-w-5 px-1 text-center text-[0.6875rem] leading-5 font-semibold tabular-nums',
                          )}
                        >
                          {item.badge === true ? null : badgeText(item.badge as number)}
                        </span>
                      ) : null}
                    </span>
                    <span data-slot="tab-bar-label" className="max-w-full text-center leading-tight hyphens-auto">
                      {item.label}
                      {hasBadge && item.badgeLabel ? <span className="sr-only">, {item.badgeLabel}</span> : null}
                    </span>
                  </>
                ),
              })}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
TabBar.displayName = 'TabBar';

export { TabBar };
