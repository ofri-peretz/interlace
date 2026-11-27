import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Storybook must not load fonts from Google at runtime.
 *
 * Google serves different font bytes over time for the same request, which
 * makes the nightly visual QA (screenshots of this Storybook) report diffs
 * nobody changed. Fonts are committed under `public/fonts/` and declared with
 * a local `@font-face` in `.storybook/preview-head.html`.
 */
const root = join(__dirname, "..", "..");
const REMOTE_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
const referencesRemoteFont = (text: string) =>
  REMOTE_HOSTS.some((host) => text.includes(host));
const SKIP = new Set(["node_modules", "storybook-static", "dist"]);
const TEXT = /\.(html|css|mdx?|tsx?|jsx?|mjs|cjs|json)$/;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (TEXT.test(name)) yield path;
  }
}

describe("no remote fonts in Storybook", () => {
  it("references neither fonts.googleapis.com nor fonts.gstatic.com", () => {
    const offenders = [
      ...walk(join(root, ".storybook")),
      ...walk(join(root, "src")),
    ]
      .filter((file) => !file.endsWith("no-remote-fonts.lock.test.ts"))
      .filter((file) => referencesRemoteFont(readFileSync(file, "utf8")))
      .map((file) => relative(root, file));
    expect(offenders).toEqual([]);
  });

  it("serves Space Grotesk from committed files with a licence", () => {
    const head = readFileSync(
      join(root, ".storybook", "preview-head.html"),
      "utf8",
    );
    const files = [...head.matchAll(/url\(\.\/(fonts\/[^)]+)\)/g)].map(
      (m) => m[1],
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(statSync(join(root, "public", file)).size).toBeGreaterThan(0);
    }
    expect(
      readFileSync(join(root, "public/fonts/space-grotesk/OFL.txt"), "utf8"),
    ).toMatch(/^Copyright .*Space Grotesk Project Authors/);
  });
});
