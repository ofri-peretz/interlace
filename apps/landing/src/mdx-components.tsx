import type { MDXComponents } from "mdx/types";
import { getDefaultMDXComponents } from "#interlace/lib/mdx-components";

/**
 * Next.js MDX component registry. Discovered automatically by Next.js MDX.
 *
 * Baseline components come from `#interlace/lib/mdx-components`. Add
 * site-specific components below the spread.
 */
export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...getDefaultMDXComponents(),
    ...components,
  };
}
