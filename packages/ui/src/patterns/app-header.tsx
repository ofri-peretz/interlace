/**
 * @interlace/ui — AppHeader, AppHeaderBack
 *
 * The bar at the top of an app-like view on a phone: a way back at the
 * start, the view's title in the middle, one or two actions at the end. It
 * sticks to the top, clears the notch or status bar
 * (`env(safe-area-inset-top)`), and shows its surface and border only once
 * content scrolls beneath it.
 *
 * ## Anatomy
 *
 *   <header data-slot="app-header">                       (sticky)
 *     <div data-slot="app-header-bar">
 *       <div data-slot="app-header-start">{start}</div>
 *       <h1 data-slot="app-header-title">{title}</h1>
 *       <div data-slot="app-header-end">{end}</div>
 *     </div>
 *   </header>
 *   <div data-slot="app-header-large">                    (largeTitle, scrolls away)
 *     <h1 data-slot="app-header-large-title">{title}</h1>
 *   </div>
 *
 * ## Large title
 *
 * `largeTitle` sets the title big under the bar, the way a phone app opens a
 * top-level view. Once it scrolls up under the bar, the small title fades
 * into the bar (`data-collapsed`). The large title is the heading; the small
 * one is then hidden from assistive tech, so the title is read once.
 *
 * ## Motion
 *
 * The surface and border fade in (250ms, `--ease-move`); the small title
 * fades and rises 4px (150ms, `--ease-enter`). Reduced motion: both simply
 * change.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The start and end columns share the room left by the title, which is cut
 * with an ellipsis in the bar (the large title wraps instead).
 *
 * | Rule | Concept                 | Where in this file                              |
 * | ---- | ----------------------- | ----------------------------------------------- |
 * | R4   | Extends native el       | `React.ComponentProps<'header'>`                |
 * | R6   | data-slot per part      | app-header, -bar, -start, -title, -end          |
 * | R7   | className merged + rest | `cn(BASE, className)` + `{...props}`            |
 * | R14  | Declares min viewport   | `data-min-viewport` + exported const            |
 * | R25  | Server component        | scroll state lives in `AppHeaderEdge`           |
 * | R26  | A11y from native el     | `<header>`, one heading, a named back link      |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { AppHeaderEdge } from './app-header-edge.js';

export const MIN_VIEWPORT = 320 as const;

export interface AppHeaderProps extends Omit<React.ComponentProps<'header'>, 'title'> {
  /** The view's name. */
  title: React.ReactNode;
  /** The start of the bar: usually `AppHeaderBack`, or a menu button. */
  start?: React.ReactNode;
  /** The end of the bar: one or two icon buttons. */
  end?: React.ReactNode;
  /** Set the title large under the bar, collapsing into the bar on scroll. @default false */
  largeTitle?: boolean;
  /**
   * The element of the title. The view's main heading by default; pass `'p'` when the
   * page already has its own h1. @default 'h1'
   */
  titleAs?: 'h1' | 'h2' | 'p';
  /**
   * When the bar shows its surface and border: `scroll` once content passes under it,
   * `always` from the start. @default 'scroll'
   */
  edge?: 'scroll' | 'always';
}

function AppHeader({
  title,
  start,
  end,
  largeTitle = false,
  titleAs: Title = 'h1',
  edge = 'scroll',
  className,
  ...props
}: AppHeaderProps) {
  return (
    <>
      <header
        data-slot="app-header"
        data-min-viewport={String(MIN_VIEWPORT)}
        data-edge={edge}
        className={cn(
          'group/app-header sticky top-0 z-header border-b pt-[env(safe-area-inset-top,0px)]',
          'px-[max(env(safe-area-inset-left,0px),env(safe-area-inset-right,0px))]',
          'motion-safe:transition-[background-color,border-color] motion-safe:duration-(--duration-medium) motion-safe:ease-move',
          edge === 'always'
            ? 'border-border bg-background/90 supports-backdrop-filter:bg-background/75 backdrop-blur'
            : 'data-scrolled:border-border data-scrolled:bg-background/90 supports-backdrop-filter:data-scrolled:bg-background/75 border-transparent data-scrolled:backdrop-blur',
          className,
        )}
        {...props}
      >
        {edge === 'scroll' || largeTitle ? <AppHeaderEdge /> : null}
        <div
          data-slot="app-header-bar"
          className="mx-auto grid min-h-14 max-w-(--container-content) grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2"
        >
          <div data-slot="app-header-start" className="flex min-w-0 items-center justify-start gap-1">
            {start}
          </div>
          {largeTitle ? (
            <p
              aria-hidden
              data-slot="app-header-title"
              className={cn(
                'max-w-[60vw] truncate text-center text-base font-semibold',
                'translate-y-1 opacity-0 group-data-collapsed/app-header:translate-y-0 group-data-collapsed/app-header:opacity-100',
                'motion-safe:transition-[opacity,translate] motion-safe:duration-(--duration-base) motion-safe:ease-enter',
              )}
            >
              {title}
            </p>
          ) : (
            <Title data-slot="app-header-title" className="max-w-[60vw] truncate text-center text-base font-semibold">
              {title}
            </Title>
          )}
          <div data-slot="app-header-end" className="flex min-w-0 items-center justify-end gap-1">
            {end}
          </div>
        </div>
      </header>
      {largeTitle ? (
        <div
          data-slot="app-header-large"
          className="px-[max(env(safe-area-inset-left,0px),env(safe-area-inset-right,0px))]"
        >
          <Title
            data-slot="app-header-large-title"
            className="font-heading mx-auto max-w-(--container-content) px-4 pt-2 pb-3 text-3xl font-bold tracking-tight text-balance"
          >
            {title}
          </Title>
        </div>
      ) : null}
    </>
  );
}
AppHeader.displayName = 'AppHeader';

export interface AppHeaderBackLinkRenderProps {
  href: string;
  className: string;
  children: React.ReactNode;
  'aria-label'?: string;
  'data-slot': 'app-header-back';
}

export interface AppHeaderBackProps {
  /** Where back goes: the parent view. */
  href: string;
  /** The word shown beside the arrow, such as the parent's name. @default 'Back' */
  label?: string;
  /** Show only the arrow, with the label as its accessible name. @default false */
  iconOnly?: boolean;
  /** Render-prop for a framework's router link. Spread the rest. */
  renderLink?: (props: AppHeaderBackLinkRenderProps) => React.ReactElement;
}

const defaultBackLink: NonNullable<AppHeaderBackProps['renderLink']> = ({ href, children, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
);

/** The start of an AppHeader: an arrow that points the reading direction's way back, and a word. */
function AppHeaderBack({ href, label = 'Back', iconOnly = false, renderLink = defaultBackLink }: AppHeaderBackProps) {
  return renderLink({
    href,
    'data-slot': 'app-header-back',
    className: cn(
      'text-primary hover:bg-muted -ms-1 inline-flex min-h-11 min-w-11 items-center gap-0.5 rounded-md pe-2 text-base font-medium',
      'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
      iconOnly && 'justify-center pe-0',
    ),
    ...(iconOnly ? { 'aria-label': label } : {}),
    children: (
      <>
        <svg
          aria-hidden
          focusable="false"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-6 shrink-0 rtl:-scale-x-100"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        {iconOnly ? null : <span className="truncate">{label}</span>}
      </>
    ),
  });
}
AppHeaderBack.displayName = 'AppHeaderBack';

export { AppHeader, AppHeaderBack };
