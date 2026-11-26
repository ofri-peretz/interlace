/**
 * Z-index Lock
 *
 * Every z-index in Interlace is a name from the layer scale
 * (styles/structure/layer.css): `z-raised`, `z-header`, `z-modal`…
 *
 * A number says nothing about what it must beat. The Topbar was `z-10`, and
 * so were a Section overlap band, a ScrollStory's steps and a Dialogue
 * speaker. Equal z-index ties, and the later element in the page wins, so on
 * a consumer's home page the story cards and speaker labels scrolled OVER
 * the sticky header. See docs/lessons.md.
 *
 * This lock fails any numeric z-index in packages/ui/src (`z-10`, `-z-10`,
 * `z-[1]`, `z-index: 5`) and holds the scale's order, so a step cannot be
 * renumbered under another.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, resolve } from "path";

const SRC = resolve(__dirname, "../src");
const LAYER_CSS = resolve(__dirname, "../styles/structure/layer.css");

// `z-10`, `-z-10`, `md:z-20`, `z-[1]`, `z-[var(--x)]`, and a CSS or style
// `z-index: 3` / `zIndex: 3`. The named utilities (`z-header`) and `z-auto`
// pass.
const NUMERIC_Z_RE =
  /(?<![\w-])-?z-(?:\d+|\[[^\]]*\])(?![\w-])|z-index\s*:\s*-?\d+|zIndex\s*:\s*-?\d+/g;

/** The scale, bottom to top. A step added to layer.css goes here too. */
const ORDER = [
  "backdrop",
  "base",
  "raised",
  "sticky",
  "header",
  "indicator",
  "overlay",
  "modal",
  "popover",
  "toast",
  "tooltip",
  "skip-link",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(full);
  }
  return out;
}

function scale(): Record<string, number> {
  const css = readFileSync(LAYER_CSS, "utf8");
  const out: Record<string, number> = {};
  for (const [, name, value] of css.matchAll(
    /--z-index-([\w-]+)\s*:\s*(-?\d+)\s*;/g,
  )) {
    out[name] = Number(value);
  }
  return out;
}

describe("z-index lock", () => {
  it("uses no numeric z-index in packages/ui/src", () => {
    const hits: string[] = [];
    for (const file of walk(SRC)) {
      const matches = readFileSync(file, "utf8").match(NUMERIC_Z_RE);
      if (matches)
        hits.push(...matches.map((m) => `${relative(SRC, file)}: ${m}`));
    }
    expect(
      hits,
      "A numeric z-index ties with every other part that picked the same " +
        "number, and the later one in the page wins. Use a layer name from " +
        "styles/structure/layer.css (z-raised, z-sticky, z-header, z-overlay, " +
        "z-modal, z-popover, z-toast, z-tooltip…). If no layer fits, add one " +
        "there, with a comment saying what it sits between.\n\n" +
        hits.join("\n"),
    ).toEqual([]);
  });

  it("declares every layer, in order, with in-component layers below the page's", () => {
    const s = scale();
    expect(Object.keys(s).sort()).toEqual([...ORDER].sort());
    const values = ORDER.map((name) => s[name]);
    expect(
      values,
      "layer.css must list strictly increasing values in ORDER",
    ).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size, "two layers share a value, so they tie").toBe(
      values.length,
    );
    // A part inside a component must never reach the page's chrome.
    expect(s.raised).toBeLessThan(s.sticky);
    // A select inside a dialog opens over it.
    expect(s.popover).toBeGreaterThan(s.modal);
  });

  it("catches every numeric form and passes the names", () => {
    const sample =
      "z-10 -z-10 md:z-20 z-[1] z-[var(--x)] z-index: 5 zIndex: 3 z-header z-auto z-raised size-10 fuzz-10";
    expect(sample.match(NUMERIC_Z_RE)).toEqual([
      "z-10",
      "-z-10",
      "z-20",
      "z-[1]",
      "z-[var(--x)]",
      "z-index: 5",
      "zIndex: 3",
    ]);
  });
});
