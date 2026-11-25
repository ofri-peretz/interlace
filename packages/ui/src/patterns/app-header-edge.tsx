'use client';

/**
 * @interlace/ui — AppHeaderEdge
 *
 * The client half of `AppHeader`. It marks the header `data-scrolled` once
 * the page has moved off its top, so the bar gains its surface and border
 * only when content passes beneath it. With a large title it also marks the
 * header `data-collapsed` once that title has scrolled up under the bar, so
 * the small title in the bar can take over. AppHeader renders it for you;
 * it draws nothing itself.
 *
 * | Rule | Concept          | Where in this file                    |
 * | ---- | ---------------- | ------------------------------------- |
 * | R6   | data-slot        | `app-header-edge`                     |
 * | R25  | Client component | one passive scroll listener on window |
 */

import * as React from 'react';

export interface AppHeaderEdgeProps {
  /** Pixels of scroll before the header counts as scrolled. @default 4 */
  threshold?: number;
}

export function AppHeaderEdge({ threshold = 4 }: AppHeaderEdgeProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const header = ref.current?.closest<HTMLElement>('[data-slot="app-header"]');
    if (!header) return;
    const next = header.nextElementSibling;
    const large = next?.getAttribute('data-slot') === 'app-header-large' ? next : null;
    const update = () => {
      header.toggleAttribute('data-scrolled', window.scrollY > threshold);
      if (large) {
        header.toggleAttribute(
          'data-collapsed',
          large.getBoundingClientRect().bottom <= header.getBoundingClientRect().bottom,
        );
      }
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      header.removeAttribute('data-scrolled');
      header.removeAttribute('data-collapsed');
    };
  }, [threshold]);
  return <span ref={ref} hidden data-slot="app-header-edge" />;
}
