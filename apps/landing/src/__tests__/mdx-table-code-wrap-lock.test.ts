/**
 * MDX table inline-code wrap lock.
 *
 * Why: long inline-code spans inside MDX table cells (e.g.
 * `@interlace/eslint-plugin-vercel-ai-security` in landscape.mdx) inherit
 * `<code>`'s default `word-break: normal`, which doesn't break mid-token.
 * On mobile (390px) this pushes table cells wider than the viewport,
 * shrinks neighbour columns into vertical text, and corrupts the
 * page layout. Repro: load /docs/reference/landscape at iPhone 14 width.
 *
 * Fix: `global.css` forces `overflow-wrap: anywhere` + `word-break:
 * break-word` on `<code>` *inside table cells only* (`.prose table code`
 * etc.). Body-prose inline code is unaffected.
 *
 * This lock keeps that rule in place. If someone strips it to "clean up"
 * `global.css`, mobile tables silently regress — the same failure mode
 * the CLAUDE.md regression-lock policy is meant to catch.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const GLOBAL_CSS = join(process.cwd(), "src/app/global.css");

describe("MDX table inline-code wrap rule", () => {
  const css = readFileSync(GLOBAL_CSS, "utf-8");

  it("global.css scopes the wrap rule to table cells (not body prose)", () => {
    // The selector must mention `table code` somewhere. Any of the
    // three scoping variants is acceptable so the rule survives small
    // structural refactors.
    const tableCodeSelectors = [
      /\.prose\s+table\s+code\b/,
      /\[class\*="prose"\]\s+table\s+code\b/,
      /\.fd-page\s+article\s+table\s+code\b/,
    ];
    const matched = tableCodeSelectors.filter((re) => re.test(css));
    expect(
      matched,
      "global.css must scope the wrap rule to `table code` so body-prose inline code is unaffected",
    ).not.toHaveLength(0);
  });

  it("the wrap rule sets overflow-wrap: anywhere", () => {
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it("the wrap rule sets word-break: break-word", () => {
    expect(css).toMatch(/word-break:\s*break-word/);
  });
});
