"use client";

/**
 * @interlace/ui — TopbarScrollEdge
 *
 * The client half of `Topbar edge="scroll"`: it marks the header
 * `data-scrolled` once the page has moved off its top, so the bar can sit
 * clear over a hero and gain its surface and border only when content
 * passes beneath it. With `hide` it also marks the header `data-hidden` while
 * the reader scrolls down, so the bar slides away and returns on the first
 * scroll up. Topbar renders it for you; it draws nothing itself.
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
  /**
   * Also mark the header `data-hidden` while the reader scrolls down past it,
   * and clear it the moment they scroll back up. Never while focus or an open
   * panel is inside the header. @default false
   */
  hide?: boolean;
}

/** Scroll needed in one direction before the bar hides or returns. */
const HIDE_SLACK = 8;

export function TopbarScrollEdge({
  threshold = 4,
  hide = false,
}: TopbarScrollEdgeProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const header = ref.current?.closest<HTMLElement>('[data-slot="topbar"]');
    if (!header) return;
    let last = window.scrollY;
    const update = () => {
      const y = window.scrollY;
      if (y > threshold) header.setAttribute("data-scrolled", "");
      else header.removeAttribute("data-scrolled");
      if (!hide || Math.abs(y - last) < HIDE_SLACK) return;
      const busy =
        header.contains(document.activeElement) ||
        header.querySelector("[data-popup-open]") !== null;
      if (y > last && y > header.offsetHeight && !busy)
        header.setAttribute("data-hidden", "");
      else header.removeAttribute("data-hidden");
      last = y;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      header.removeAttribute("data-scrolled");
      header.removeAttribute("data-hidden");
    };
  }, [threshold, hide]);
  return <span ref={ref} hidden data-slot="topbar-scroll-edge" />;
}
