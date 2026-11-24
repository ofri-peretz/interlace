/**
 * The heading scale is fluid at the top (h1–h3) and fixed below. Whatever the
 * width, each level must stay larger than the next, or a phone shows two
 * levels at one size and the outline flattens.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(__dirname, "../styles/structure/type.css"),
  "utf8",
);

/**
 * The size in px at a viewport width, for a rem value, a clamp(min, a + b·vw,
 * max), or that clamp capped by min(…, c·cqi). `root` is the root font size,
 * which a reader's text size or zoom raises; the cap is measured against a
 * full-width container.
 */
function size(level: string, width: number, root = 16): number {
  let decl = css.match(new RegExp(`--text-${level}: ([^;]+);`))![1]!.trim();
  let cap = Infinity;
  const capped = decl.match(/^min\((clamp\(.+\)), ([\d.]+)cqi\)$/);
  if (capped) {
    decl = capped[1]!;
    cap = (Number(capped[2]) / 100) * width;
  }
  const fixed = decl.match(/^([\d.]+)rem$/);
  if (fixed) return Number(fixed[1]) * root;
  const m = decl.match(/^clamp\(([\d.]+)rem, (.+), ([\d.]+)rem\)$/);
  expect(m, `${level} is a rem, a clamp, or a capped clamp`).not.toBeNull();
  const [min, max] = [Number(m![1]), Number(m![3])];
  // The preferred value: a rem term and a vw term, in either order.
  const rem = Number(m![2]!.match(/([\d.]+)rem/)![1]);
  const vw = Number(m![2]!.match(/([\d.]+)vw/)![1]);
  const [a, b] = [rem, vw];
  const fluid = Math.min(max * root, Math.max(min * root, a * root + (b / 100) * width));
  return Math.min(fluid, cap);
}

describe("fluid heading scale", () => {
  it.each([320, 360, 480, 768, 1024, 1440])(
    "every level is larger than the next at %ipx",
    (width) => {
      const levels = ["h1", "h2", "h3", "h4", "h5", "h6"];
      for (let i = 0; i < levels.length - 1; i++) {
        expect(
          size(levels[i]!, width),
          `${levels[i]} > ${levels[i + 1]}`,
        ).toBeGreaterThan(size(levels[i + 1]!, width));
      }
    },
  );

  it.each([320, 360, 480, 768, 1024, 1440])(
    "the display tiers sit around h1 at %ipx",
    (width) => {
      expect(size("display", width), "display > h1").toBeGreaterThan(
        size("h1", width),
      );
      expect(size("h1", width), "h1 > section").toBeGreaterThan(
        size("section", width),
      );
      expect(size("section", width), "section > h2").toBeGreaterThan(
        size("h2", width),
      );
    },
  );

  // A reader at 150% text size on a 390px phone: the two largest sizes must
  // stop short of the line, so one long word cannot run past the edge.
  it.each([
    ["display", 12.5],
    ["h1", 11.5],
  ])("%s stays under a phone line at 150%% text size", (level, share) => {
    expect(size(level as string, 390, 24)).toBeCloseTo((share as number) * 3.9, 5);
    expect(size(level as string, 390, 24)).toBeLessThan(size(level as string, 390, 16) * 1.5);
  });

  it("the cap never bites at 100% from 360px up", () => {
    for (const width of [360, 480, 768, 1024, 1440]) {
      for (const level of ["display", "h1"]) {
        const uncapped = css
          .match(new RegExp(`--text-${level}: min\\((clamp\\(.+\\)), [\\d.]+cqi\\);`))![1]!;
        expect(uncapped).toMatch(/^clamp/);
        expect(size(level, width)).toBeGreaterThanOrEqual(
          level === "display" ? 44 : 40,
        );
      }
    }
  });

  it("body text never scales with the viewport", () => {
    for (const level of ["body", "long", "ui", "ui-sm", "code", "caption"]) {
      expect(
        css.match(new RegExp(`--text-${level}: ([^;]+);`))![1],
      ).not.toMatch(/vw|clamp/);
    }
  });
});
