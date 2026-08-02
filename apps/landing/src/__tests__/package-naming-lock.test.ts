/**
 * Package-naming lock
 *
 * The ESLint plugins are published UNSCOPED (`eslint-plugin-jwt`, …) because
 * ESLint resolves plugins by that name convention. `@interlace/eslint-plugin-*`
 * and `@interlace/eslint-*` are packages that do not exist — a reader who
 * copies them off this site gets E404. The only scoped ESLint package is
 * `@interlace/eslint-devkit`.
 *
 * This shipped wrong once (every product surface said `@interlace/eslint-*`);
 * the lock is here so it cannot come back.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** Any `@interlace/eslint-…` other than the real `@interlace/eslint-devkit`. */
const BAD_SCOPED_ESLINT = /@interlace\/eslint-(?!devkit\b)[\w*-]*/g;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(p);
    return /\.(tsx?|mdx|json)$/.test(e.name) ? [p] : [];
  });
}

// Reader-facing surfaces only — this test file names the bad pattern on
// purpose, so `src/__tests__` is excluded.
const SURFACES = [
  ...walk(join(PROJECT_ROOT, "content")),
  ...walk(join(PROJECT_ROOT, "src")).filter((p) => !p.includes("__tests__")),
];

describe("no non-existent @interlace/eslint-* package names", () => {
  it("scans a non-empty set of surfaces", () => {
    expect(SURFACES.length).toBeGreaterThan(0);
  });

  for (const file of SURFACES) {
    const rel = file.slice(PROJECT_ROOT.length + 1);
    it(rel, () => {
      const hits = readFileSync(file, "utf-8").match(BAD_SCOPED_ESLINT) ?? [];
      expect(
        hits,
        `${rel} references ${hits.join(", ")} — the plugins are unscoped (eslint-plugin-*)`,
      ).toEqual([]);
    });
  }
});
