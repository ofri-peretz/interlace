import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

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
           * ds.interlace.tools (packages/ui/src/patterns/brand-logo.tsx).
           * Inlined because the landing app consumes the synced
           * `.interlace/` baseline, not `@interlace/ui`. Bar fills read
           * `--brand-mark-bar-*` from global.css. */}
          <svg
            viewBox="0 0 100 100"
            width={22}
            height={22}
            aria-hidden="true"
            className="shrink-0"
          >
            <g transform="rotate(-30 50 50)">
              <rect
                x="10"
                y="18"
                width="62"
                height="28"
                rx="14"
                fill="var(--brand-mark-bar-o)"
              />
              <rect
                x="28"
                y="54"
                width="62"
                height="28"
                rx="14"
                fill="var(--brand-mark-bar-g)"
              />
            </g>
          </svg>
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
