import * as React from 'react';

import { cn } from '../lib/cn.js';

/**
 * @interlace/ui — SkipLink
 *
 * The "jump to main content" link that satisfies WCAG 2.4.1 (Bypass Blocks).
 * Renders as a visually-hidden focusable anchor at the top of the document;
 * when a keyboard user hits Tab on page load, it pops into the top-left
 * corner as a focus-visible button that jumps past header / nav landmarks
 * to the page's main content. After that first Tab, sighted mouse users
 * never see it.
 *
 * Pair this with a `<main id="main">` (or whichever target you point at).
 * The target MUST be focusable (set `tabIndex={-1}` on `<main>` so the skip
 * action moves focus into it, not just the scroll position).
 *
 * ## Anatomy
 *
 *   SkipLink                          (anchor — data-min-viewport=320)
 *     └─ children                     (default: "Skip to main content")
 *
 * ## MIN_VIEWPORT — 320
 *
 * The first interactive element a keyboard user encounters on the page.
 * Must work on every device that ships a physical keyboard or assistive-tech
 * tab-stop emulator — i.e. all of them.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'a'> & SkipLinkProps`                 |
 * | R6   | data-slot on root                | `data-slot="skip-link"`                                     |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R8   | No isXxx                         | n/a — no boolean variants                                   |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes only                   |
 * | R19  | Tokens only                      | bg-background / text-foreground / focus-visible:ring-ring   |
 * | R20  | AA contrast                      | Visible state uses semantic tokens that clear AA / AAA      |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | `<a href>` is the native element; focus + activation inherit |
 */

export const MIN_VIEWPORT = 320 as const;

type SkipLinkProps = React.ComponentProps<'a'> & {
  /**
   * Hash target for the skip action. Defaults to `#main` — pair with a
   * `<main id="main" tabIndex={-1}>` so focus moves into the content
   * region, not just the scroll position.
   */
  href?: string;
};

export const SkipLink = React.forwardRef<HTMLAnchorElement, SkipLinkProps>(
  ({ className, href = '#main', children, ...props }, ref) => (
    <a
      ref={ref}
      href={href}
      data-slot="skip-link"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        // Visually hidden by default — same technique as VisuallyHidden but
        // explicitly inline so this primitive carries no implicit dep.
        'sr-only',
        // Pop into view when focus-visible. Top-left corner, above sticky
        // headers (`z-50`), with the DS focus ring contract.
        'focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50',
        'focus-visible:rounded-md focus-visible:border focus-visible:border-border',
        'focus-visible:bg-background focus-visible:px-4 focus-visible:py-2',
        'focus-visible:text-sm focus-visible:font-medium focus-visible:text-foreground',
        'focus-visible:shadow-lg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    >
      {children ?? 'Skip to main content'}
    </a>
  ),
);
SkipLink.displayName = 'SkipLink';
