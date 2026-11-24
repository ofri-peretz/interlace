/**
 * Brand token lock: the landing site takes its brand tokens from the baseline, never its own copy.
 *
 * `src/app/global.css` imports `.interlace/css/brand.css`. Redefining one of its custom properties
 * here (the old duplicate-with-!important pattern) shipped dark-mode contrast bugs when the
 * baseline moved a value the copy did not. Until 2026-11-24 apps/landing/AGENTS.md said "do not
 * redefine brand variables here"; this test is that rule now.
 *
 * Fix a failure by editing `.interlace/css/brand.css` instead, and deleting the copy here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (file: string): string => readFileSync(join(ROOT, file), "utf8");

/** Custom property names declared in a stylesheet (`--name:`), comments removed. */
function declared(css: string): Set<string> {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return new Set([...code.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]!));
}

describe("brand tokens come from the baseline", () => {
  const global = read("src/app/global.css");
  const brand = declared(read(".interlace/css/brand.css"));

  it("global.css imports the baseline's brand.css", () => {
    expect(global).toContain('@import "../../.interlace/css/brand.css";');
  });

  it("global.css redefines none of brand.css's custom properties", () => {
    expect(brand.size).toBeGreaterThan(20);
    const copies = [...declared(global)].filter((name) => brand.has(name));
    expect(copies, "edit .interlace/css/brand.css instead").toEqual([]);
  });

  it("global.css never forces a value over the cascade", () => {
    expect(global.replace(/\/\*[\s\S]*?\*\//g, "")).not.toContain("!important");
  });

  it("finds a redefinition when there is one (the check is live)", () => {
    const name = [...brand][0]!;
    expect(
      [...declared(`:root { ${name}: red; }`)].filter((n) => brand.has(n)),
    ).toEqual([name]);
  });
});
