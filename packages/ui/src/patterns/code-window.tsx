'use client';

/**
 * @interlace/ui — CodeWindow + CodeWindowTitleBar
 *
 * macOS-style window chrome for wrapping editor, terminal, or code-preview
 * content: a bordered `bg-card` box plus an optional title bar with the three
 * traffic-light dots, a centred monospace filename, and an actions slot.
 *
 * It is chrome only — it renders whatever you nest inside it and has no
 * opinion about the content.
 *
 * Modeled on MagicUI's `Terminal` chrome (the dots + bar layout convention)
 * but reduced to the visual primitive — no animation, no terminal-specific
 * line emitter. Reach for MagicUI's `Terminal` when you want the typed-prompt
 * animation; reach for this when you want a window-shaped container.
 *
 * ## Anatomy
 *
 *   CodeWindow                       (div — data-slot="code-window")
 *     ├─ CodeWindowTitleBar          (div — data-slot="code-window-title-bar")
 *     │   ├─ span aria-hidden        (data-slot="code-window-traffic-lights")
 *     │   │   └─ 3 × span size-3     (bg-window-control-close/-minimize/-zoom)
 *     │   ├─ span                    (title — centred, font-mono text-xs)
 *     │   └─ span                    (actions — ml-auto)
 *     └─ children                    (the body: editor, <pre>, anything)
 *
 * ## No accessible name, deliberately
 *
 * The root is a bare `<div>`: no role, no label. That is the correct shape for
 * this component rather than a gap in it. It claims no role, so ARIA requires
 * it to expose no name — and an `aria-label` on a roleless `<div>` is ignored
 * by most of the mapping specs anyway, so adding one would buy a false sense
 * of coverage. Nothing is hidden either: the dots are `aria-hidden` because
 * they are ornament, while the `title` slot is an ordinary `<span>` whose text
 * is read in document order like any other text, and the body renders whatever
 * you nest with its own semantics intact.
 *
 * If a particular window needs to be announced AS a region — a labelled
 * landmark a screen-reader user can jump to — that is a call-site decision
 * about that page's structure, so give it a role and a name there. Baking one
 * in would make every code sample on a docs page a landmark.
 *
 * There is also no `MIN_VIEWPORT`: the chrome is one border and a 40px bar, so
 * it inherits whatever width its container gives it.
 *
 * | Rule | Concept                     | Where in this file                                        |
 * | ---- | --------------------------- | --------------------------------------------------------- |
 * | R4   | Extends native el           | `React.ComponentProps<'div'>` on both parts               |
 * | R6   | data-slot per part          | `code-window` / `-title-bar` / `-traffic-lights`          |
 * | R7   | className merged + ...rest  | `cn(BASE, className)` + `{...props}`                      |
 * | R10  | Composition seams           | `title` and `actions` are `ReactNode`, not strings        |
 * | R18  | Tailwind only               | zero inline `style`                                       |
 * | R19  | Tokens only                 | dots use `--window-control-*`, not the macOS hex literals |
 * | R25  | Client directive            | `'use client'` is declared although neither part uses a hook |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

function CodeWindow({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="code-window"
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card shadow-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CodeWindowTitleBarProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  /**
   * Optional title to display in the bar (typically a filename or rule id).
   * If omitted, the bar renders just the traffic-light dots — leaner for
   * cases where a separate header already names the content. Typed as
   * `ReactNode` (not the native HTML `title` attribute) so callers can
   * pass JSX such as a styled filename.
   */
  title?: React.ReactNode;
  /**
   * Optional trailing slot (right-aligned). Useful for a "copy" button or
   * a status indicator. Renders inside the title-bar row.
   */
  actions?: React.ReactNode;
}

function CodeWindowTitleBar({
  className,
  title,
  actions,
  ...props
}: CodeWindowTitleBarProps) {
  return (
    <div
      data-slot="code-window-title-bar"
      className={cn(
        'flex items-center gap-3 border-b border-border bg-muted/50 px-3 py-2',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        data-slot="code-window-traffic-lights"
        className="flex items-center gap-1.5"
      >
        <span className="size-3 rounded-full bg-window-control-close" />
        <span className="size-3 rounded-full bg-window-control-minimize" />
        <span className="size-3 rounded-full bg-window-control-zoom" />
      </span>
      {title && (
        <span className="flex-1 truncate text-center font-mono text-xs text-muted-foreground">
          {title}
        </span>
      )}
      {actions && (
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {actions}
        </span>
      )}
    </div>
  );
}

export { CodeWindow, CodeWindowTitleBar };
export type { CodeWindowTitleBarProps };
