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
          <span className="font-semibold">Interlace</span>
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
        url: "/docs/reference/landscape",
      },
    ],
  };
}
