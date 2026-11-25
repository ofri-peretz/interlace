/**
 * Brand-Neutral Lock
 *
 * Interlace is copied into someone else's app, so no consumer's identity may ship inside a
 * component, style or token. A consumer brands through cssVars and props. This lock scans
 * everything under packages/ui/src and packages/ui/styles (the files the registry copies out), and
 * packages/native/src, for the names of the sites and products that consume Interlace today.
 *
 * A hit means a consumer's name, handle or product leaked into shipped code. Move it to the
 * consumer, or to a Storybook fixture, which never ships. When a new consumer adopts Interlace,
 * add its name to CONSUMER_NAMES.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, resolve } from "path";

const UI_ROOT = resolve(__dirname, "..");
const SHIPPED_DIRS = ["src", "styles"];
const SHIPPED_EXT = /\.(tsx?|css|json|mdx?)$/;

// The people, domains and products that consume Interlace. Matched case-insensitively as whole
// words (a hyphen counts as a boundary) so `ofri` does not hit inside an unrelated identifier.
const CONSUMER_NAMES = [
  "ofri",
  "peretz",
  "ofriperetz",
  "ofri-peretz",
  "burgee",
  "provedone",
  "truepass",
  "truefit",
  "replz",
  "hookset",
  "triggerlist",
  "contractdiff",
  // WhyLikeDis, the flagship site, under every spelling it goes by, and "Dugri", the name of its
  // identity. Its pieces were built here first and had to be made neutral after the fact (#123).
  "whylikedis",
  "why like dis",
  "why-like-dis",
  "dugri",
];
const ALTERNATION = [...CONSUMER_NAMES]
  .sort((a, b) => b.length - a.length)
  .join("|");
const CONSUMER = new RegExp(`(?<!\\w)(${ALTERNATION})(?!\\w)`, "gi");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return SHIPPED_EXT.test(name) ? [path] : [];
  });
}

export function consumerHits(
  files: string[],
  read = (p: string) => readFileSync(p, "utf8"),
) {
  return files.flatMap((file) =>
    read(file)
      .split("\n")
      .flatMap((line, i) =>
        [...line.matchAll(CONSUMER)].map(
          (m) => `${relative(UI_ROOT, file)}:${i + 1} names "${m[1]}"`,
        ),
      ),
  );
}

describe("brand-neutral lock", () => {
  it("the matcher still catches a consumer name (instrument check)", () => {
    const fake = {
      "a.tsx": 'title="By Ofri" for burgee',
      "b.css": "--brand: burgee-blue;",
      "c.ts": "const ofrix = 1;",
      "d.tsx": "// the Dugri band, as on WhyLikeDis and why-like-dis.fyi",
      "e.tsx": "// copy from the why like dis redesign",
    };
    const hits = consumerHits(
      Object.keys(fake).map((f) => join(UI_ROOT, f)),
      (p) => fake[relative(UI_ROOT, p) as keyof typeof fake],
    );
    expect(hits).toEqual([
      'a.tsx:1 names "Ofri"',
      'a.tsx:1 names "burgee"',
      'b.css:1 names "burgee"',
      'd.tsx:1 names "Dugri"',
      'd.tsx:1 names "WhyLikeDis"',
      'd.tsx:1 names "why-like-dis"',
      'e.tsx:1 names "why like dis"',
    ]);
  });

  it("no shipped component, style or token names a consumer", () => {
    const files = SHIPPED_DIRS.flatMap((d) => walk(join(UI_ROOT, d)));
    expect(files.length).toBeGreaterThan(100);
    expect(consumerHits(files)).toEqual([]);
  });

  // @interlace/native ships into a consumer's app the same way, so the same names stay out of it.
  it("no native component, theme or token names a consumer", () => {
    const files = walk(resolve(UI_ROOT, "..", "native", "src"));
    expect(files.length).toBeGreaterThan(10);
    expect(consumerHits(files)).toEqual([]);
  });
});
