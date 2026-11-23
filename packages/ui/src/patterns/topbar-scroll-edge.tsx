"use client";

/**
 * @interlace/ui — TopbarScrollEdge
 *
 * The client half of `Topbar edge="scroll"`: it marks the header
 * `data-scrolled` once the page has moved off its top, so the bar can sit
 * clear over a hero and gain its surface and border only when content
 * passes beneath it. Topbar renders it for you; it draws nothing itself.
 *
 * | Rule | Concept           | Where in this file                                  |
 * | ---- | ----------------- | --------------------------------------------------- |
 * | R6   | data-slot         | `topbar-scroll-edge`                                |
 * | R25  | Client component  | one passive scroll listener on `window`             |
 */

import * as React from "react";

export interface TopbarScrollEdgeProps {
  /** Pixels of scroll before the header counts as scrolled. @default 4 */
  threshold?: number;
}

export function TopbarScrollEdge({ threshold = 4 }: TopbarScrollEdgeProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const header = ref.current?.closest<HTMLElement>('[data-slot="topbar"]');
    if (!header) return;
    const update = () => {
      if (window.scrollY > threshold) header.setAttribute("data-scrolled", "");
      else header.removeAttribute("data-scrolled");
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      header.removeAttribute("data-scrolled");
    };
  }, [threshold]);
  return <span ref={ref} hidden data-slot="topbar-scroll-edge" />;
}
