/**
 * @interlace/ui — Footer
 *
 * Site footer with grouped link columns + copyright row. Composes with
 * a primary brand mark, 1-4 link groups (each a sub-heading + list of
 * links), and a tail row for copyright + social. Server component.
 *
 * ## Anatomy
 *
 *   <footer data-slot="footer" data-min-viewport="320">
 *     <div className="container">
 *       <div className="grid">{logo}{groups.map(...)}</div>
 *       <div className="tail">{copyright}{social}</div>
 *     </div>
 *   </footer>
 *
 * ## MIN_VIEWPORT — 320
 *
 * Link groups stack on mobile, grid out on md+. The tail row stacks too.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'footer'>` + Footer props             |
 * | R6   | data-slot on root                | `data-slot="footer"`                                        |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R10  | Composition seam (slots)         | `brand` / `groups` / `social` / `copyright` ReactNode props |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes only                   |
 * | R19  | Tokens only                      | `bg-card` / `border-border` / `text-muted-foreground`       |
 * | R20  | AA contrast                      | semantic foregrounds                                        |
 * | R25  | Server component                 | No hooks                                                    |
 * | R26  | A11y from native el              | `<footer>` landmark, `<nav>` per group                      |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

interface FooterLink {
  href: string;
  label: React.ReactNode;
  external?: boolean;
}

interface FooterGroup {
  title: string;
  links: FooterLink[];
}

interface FooterProps extends React.ComponentProps<'footer'> {
  /** Brand mark + tagline. Renders left of the link groups. */
  brand?: React.ReactNode;
  /** 1-4 grouped link columns. */
  groups?: FooterGroup[];
  /** Copyright line (left of the tail row). */
  copyright?: React.ReactNode;
  /** Social icons / extra links (right of the tail row). */
  social?: React.ReactNode;
  /** Container size. Defaults to `wide`. */
  containerSize?: 'wide' | 'content' | 'prose';
  /**
   * Render-prop slot for internal links. Defaults to plain `<a>`. A
   * Next.js consumer passes `({ href, className, children }) => <Link
   * href={href} className={className}>{children}</Link>` for SPA
   * navigation. External links always use plain `<a target="_blank">`.
   */
  renderLink?: (props: {
    href: string;
    className: string;
    children: React.ReactNode;
  }) => React.ReactElement;
}

const defaultRenderLink: NonNullable<FooterProps['renderLink']> = ({
  href,
  className,
  children,
}) => (
  <a href={href} className={className}>
    {children}
  </a>
);

const CONTAINER_CLASSES = {
  wide: 'max-w-(--container-wide)',
  content: 'max-w-(--container-content)',
  prose: 'max-w-(--container-prose)',
} as const;

function Footer({
  brand,
  groups = [],
  copyright,
  social,
  containerSize = 'wide',
  renderLink = defaultRenderLink,
  className,
  ...props
}: FooterProps) {
  return (
    <footer
      data-slot="footer"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        'border-border bg-card text-card-foreground border-t',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'mx-auto px-md py-xl',
          CONTAINER_CLASSES[containerSize],
        )}
      >
        {brand || groups.length > 0 ? (
          <div
            className={cn(
              'grid gap-lg',
              groups.length === 1 && 'md:grid-cols-[1fr_1fr]',
              groups.length === 2 && 'md:grid-cols-[1fr_1fr_1fr]',
              groups.length === 3 && 'md:grid-cols-[1.5fr_1fr_1fr_1fr]',
              groups.length >= 4 && 'md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]',
            )}
          >
            {brand ? <div>{brand}</div> : null}
            {groups.map((group, i) => (
              <nav key={i} aria-label={group.title}>
                <h2 className="font-body text-ui font-semibold mb-sm">
                  {group.title}
                </h2>
                <ul className="flex flex-col gap-xs text-sm">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label} ↗
                        </a>
                      ) : (
                        renderLink({
                          href: link.href,
                          className:
                            'text-muted-foreground hover:text-foreground transition-colors',
                          children: link.label,
                        })
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        ) : null}
        {(copyright || social) ? (
          <div className="border-border mt-lg flex flex-col items-center justify-between gap-sm border-t pt-md md:flex-row">
            {copyright ? (
              <div className="text-muted-foreground text-sm">{copyright}</div>
            ) : null}
            {social ? <div className="flex items-center gap-sm">{social}</div> : null}
          </div>
        ) : null}
      </div>
    </footer>
  );
}
Footer.displayName = 'Footer';

export { Footer };
export type { FooterProps, FooterGroup, FooterLink };
