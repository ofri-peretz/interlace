import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { BrandMark } from "@/components/brand-mark";

/**
 * Shared layout options for the Interlace apex landing site.
 * Used by both the (home) and docs layouts.
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          {/* Canonical Interlace lockup — two-bar mark + lowercase mono
           * wordmark, identical to eslint.interlace.tools and
           * ds.interlace.tools (packages/ui/src/patterns/brand-logo.tsx). */}
          <BrandMark />
          <span className="font-mono font-semibold lowercase tracking-tight">
            interlace
          </span>
        </>
      ),
      transparentMode: "top",
    },
    links: [
      {
        text: "Concepts",
        url: "/docs/concepts/what-is-interlace",
        active: "nested-url",
      },
      {
        text: "Products",
        url: "/#products",
      },
      {
        text: "Evidence",
        url: "/docs/concepts/evidence-philosophy",
      },
    ],
  };
}
