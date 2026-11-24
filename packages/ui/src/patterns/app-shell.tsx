/**
 * @interlace/ui — AppShell
 *
 * The frame of an app-like page on a phone: a header that sticks to the
 * top, the view's content, and a tab bar that sticks to the bottom. It is a
 * column at least as tall as the screen (`100dvh`, so the browser's own bars
 * coming and going never hide the tab bar), with a `<main>` that takes the
 * room between. Nothing in it is fixed-position, so the content's last line
 * always scrolls clear of the tab bar and an on-screen keyboard never drags
 * a bar into the middle of the page.
 *
 * ## Anatomy
 *
 *   <div data-slot="app-shell">
 *     {header}                         (AppHeader or Topbar)
 *     <main id="main" data-slot="app-shell-main">{children}</main>
 *     {tabBar}                         (TabBar)
 *   </div>
 *
 * ## Installable
 *
 * For a page added to a home screen, set `viewport-fit=cover` in the
 * viewport meta so the bars can reach under the notch and the home
 * indicator; AppHeader, TabBar and the main column pad themselves by the
 * safe areas. `InstallPrompt` offers the install itself.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                 | Where in this file                       |
 * | ---- | ----------------------- | ---------------------------------------- |
 * | R4   | Extends native el       | `React.ComponentProps<'div'>`            |
 * | R6   | data-slot per part      | app-shell, app-shell-main                |
 * | R7   | className merged + rest | `cn(BASE, className)` + `{...props}`     |
 * | R14  | Declares min viewport   | `data-min-viewport` + exported const     |
 * | R25  | Server component        | layout only                              |
 * | R26  | A11y from native el     | one `<main>`, a SkipLink target          |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

export interface AppShellProps extends React.ComponentProps<'div'> {
  /** The top of the frame: an `AppHeader`, or a `Topbar` on wider screens. */
  header?: React.ReactNode;
  /** The bottom of the frame: a `TabBar`. */
  tabBar?: React.ReactNode;
  /** The id of `<main>`, the target of the page's SkipLink. @default 'main' */
  mainId?: string;
  /** Props for the `<main>` element. */
  mainProps?: Omit<React.ComponentProps<'main'>, 'id' | 'children'>;
}

function AppShell({ header, tabBar, mainId = 'main', mainProps, children, className, ...props }: AppShellProps) {
  return (
    <div
      data-slot="app-shell"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex min-h-dvh flex-col', className)}
      {...props}
    >
      {header}
      <main
        id={mainId}
        data-slot="app-shell-main"
        {...mainProps}
        className={cn(
          'flex min-w-0 flex-1 flex-col px-[max(env(safe-area-inset-left,0px),env(safe-area-inset-right,0px))] focus:outline-hidden',
          mainProps?.className,
        )}
        tabIndex={mainProps?.tabIndex ?? -1}
      >
        {children}
      </main>
      {tabBar}
    </div>
  );
}
AppShell.displayName = 'AppShell';

export { AppShell };
