/**
 * Numbers-manifest lock
 *
 * Plugin/rule counts shown on the landing page must come from
 * src/data/interlace-numbers.json — a committed copy of the manifest the
 * eslint repo generates from its actual package registry
 * (apps/docs/scripts/sync-plugin-stats.ts). Refresh with
 * `npm run sync:numbers -w landing`; never hand-edit it, and never
 * hand-type a count in a surface file.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import numbers from "../data/interlace-numbers.json";

const PROJECT_ROOT = process.cwd();

// Landing surfaces that make (or could make) plugin/rule count claims.
const COVERED_SURFACES = [
  "src/app/(home)/page.tsx",
  "src/components/home/landing-hero.tsx",
  "src/app/layout.tsx",
];

// A digit immediately followed by a plugins/rules noun is a hand-typed count.
const HAND_TYPED_COUNT =
  /\b\d+\+?\s+(?:specialized\s+|security\s+|quality\s+|eslint\s+)?(?:plugins?|rules)\b/gi;

describe("interlace-numbers.json manifest", () => {
  it("has schemaVersion 1 and internally consistent pillars", () => {
    expect(numbers.schemaVersion).toBe(1);
    expect(
      numbers.plugins.security + numbers.plugins.quality + numbers.plugins.react,
    ).toBe(numbers.plugins.total);
    expect(
      numbers.rules.security + numbers.rules.quality + numbers.rules.react,
    ).toBe(numbers.rules.total);
  });
});

describe("no hand-typed plugin/rule counts on landing surfaces", () => {
  for (const surface of COVERED_SURFACES) {
    it(surface, () => {
      const content = readFileSync(join(PROJECT_ROOT, surface), "utf-8");
      const matches = content.match(HAND_TYPED_COUNT) ?? [];
      expect(
        matches,
        `${surface} hand-types counts (${matches.join(", ")}) — render them from src/data/interlace-numbers.json instead`,
      ).toEqual([]);
    });
  }

  it("the home page renders counts from the manifest", () => {
    const content = readFileSync(
      join(PROJECT_ROOT, "src/app/(home)/page.tsx"),
      "utf-8",
    );
    expect(content).toMatch(/from "@\/data\/interlace-numbers\.json"/);
    expect(content).toContain("numbers.plugins.total");
  });
});
