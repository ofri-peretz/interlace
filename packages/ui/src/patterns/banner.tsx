'use client';

/**
 * @interlace/ui — Banner
 *
 * A thin, full-width bar above the site header for a message that applies to
 * the whole site: "This site is still being written", a scheduled outage, a
 * new release. One line of text, an optional link, and an optional close
 * button.
 *
 * ## Anatomy
 *
 *   Banner                            (div role=region — data-tone, data-min-viewport=320)
 *     ├─ icon?                        (decorative, aria-hidden)
 *     ├─ children                     (the message; links inside are fine)
 *     ├─ action?                      (a link or button after the message)
 *     └─ dismiss button?              (when `dismissible`)
 *
 * ## Tones
 *
 * `muted` for neutral notices, `info`, `success`, `warning` and `highlight`.
 * The tone colours the bar; the words carry the meaning, so nothing depends
 * on colour alone. Every tone pairs a surface token with its `-foreground`.
 *
 * ## Dismissing
 *
 * `dismissible` adds a close button with an accessible name. The banner
 * manages its own visibility, or a caller controls it with `open` and
 * `onOpenChange` (for example to remember the choice in storage).
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `div` props                                          |
 * | R6   | data-slot per part      | banner / -message / -action / -dismiss                |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R8   | Enums, not booleans     | `tone`                                               |
 * | R14  | Declares min viewport   | `data-min-viewport` + exported const                  |
 * | R19  | Tokens only             | tone surface + foreground pairs                       |
 * | R25  | Client component        | dismiss state                                        |
 * | R26  | A11y from native el     | labelled region, `<button>` with a name               |
 */

import { XIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

export type BannerTone = 'muted' | 'info' | 'success' | 'warning' | 'highlight';

const TONE: Record<BannerTone, string> = {
  muted: 'bg-muted text-foreground border-border',
  info: 'bg-info text-info-foreground border-transparent',
  success: 'bg-success text-success-foreground border-transparent',
  warning: 'bg-warning text-warning-foreground border-transparent',
  highlight: 'bg-highlight text-highlight-foreground border-transparent',
};

export interface BannerProps extends Omit<React.ComponentProps<'div'>, 'role'> {
  /** Colour of the bar. The text carries the meaning. @default 'muted' */
  tone?: BannerTone;
  /** A decorative icon before the message. */
  icon?: React.ReactNode;
  /** A link or button after the message. */
  action?: React.ReactNode;
  /** Show a close button. @default false */
  dismissible?: boolean;
  /** Accessible name of the close button. @default 'Dismiss' */
  dismissLabel?: string;
  /** Accessible name of the banner region. @default 'Announcement' */
  label?: string;
  /** Controlled visibility. */
  open?: boolean;
  /** Called when the close button is pressed. */
  onOpenChange?: (open: boolean) => void;
}

export function Banner({
  tone = 'muted',
  icon,
  action,
  dismissible = false,
  dismissLabel = 'Dismiss',
  label = 'Announcement',
  open: openProp,
  onOpenChange,
  className,
  children,
  ...props
}: BannerProps) {
  const [openState, setOpenState] = React.useState(true);
  const open = openProp ?? openState;
  if (!open) return null;

  return (
    <div
      role="region"
      aria-label={label}
      data-slot="banner"
      data-tone={tone}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('border-b px-4 py-2 text-sm', TONE[tone], className)}
      {...props}
    >
      <div className="mx-auto flex max-w-(--container-wide) items-center justify-center gap-x-3 gap-y-1">
        {icon ? (
          <span aria-hidden className="shrink-0 [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
        <p data-slot="banner-message" className="text-center text-pretty [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2">
          {children}
        </p>
        {action ? (
          <span data-slot="banner-action" className="shrink-0 font-medium [&_a]:underline [&_a]:underline-offset-2">
            {action}
          </span>
        ) : null}
        {dismissible ? (
          <button
            type="button"
            data-slot="banner-dismiss"
            aria-label={dismissLabel}
            onClick={() => {
              if (openProp === undefined) setOpenState(false);
              onOpenChange?.(false);
            }}
            className="focus-visible:ring-ring -my-1 ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md opacity-80 hover:opacity-100 focus-visible:ring-[3px] focus-visible:outline-hidden"
          >
            <XIcon aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
