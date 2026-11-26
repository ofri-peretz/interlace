/**
 * Radius Token Lock
 *
 * A corner radius comes from the radius scale (`rounded-sm`, `rounded-md`,
 * `rounded-lg`, `rounded-full`…), which follows the consumer's `--radius`.
 * A literal like `rounded-[3px]` ignores the consumer's theme: a square
 * brand stays round in one corner of the UI, a soft brand stays sharp.
 *
 * The review checklist row "a radius comes from a token" was prose only,
 * and it slipped twice: CloserGame's `rounded-[3px]` (#168) and
 * UnderlineLink's `rounded-[0.125rem]` (#195). See docs/lessons.md.
 *
 * `KNOWN` lists the literals that shipped before this lock, per file. It
 * may only shrink: a new literal fails, and so does a known one that has
 * been fixed but is still listed (remove its entry). Most of them sit on
 * 16px-and-smaller parts where the scale's smallest step (`rounded-sm`,
 * `--radius` − 4px) would make a circle; the fix there is a smaller step
 * in the scale, not another literal.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, resolve } from "path";

const SRC = resolve(__dirname, "../src");

// Any side or corner form: rounded-[…], rounded-t-[…], rounded-ss-[…], …
// with a literal length. `rounded-[var(--x)]` and `rounded-[inherit]` pass.
const LITERAL_RADIUS_RE =
  /\brounded(?:-(?:t|r|b|l|s|e|ss|se|es|ee|tl|tr|br|bl))?-\[\s*-?\d*\.?\d+(?:px|rem|em|%)\s*\]/g;

/** File (relative to packages/ui/src) → literal radii it may still hold. */
const KNOWN: Record<string, string[]> = {
  "effects/underline-link.tsx": ["rounded-[0.125rem]"],
  "games/closer-game.tsx": ["rounded-[3px]"],
  "primitives/checkbox.tsx": ["rounded-[4px]", "rounded-[4px]"],
  "primitives/data-state.tsx": ["rounded-[2px]"],
  "primitives/tooltip.tsx": ["rounded-[2px]"],
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(full);
  }
  return out;
}

function found(): Record<string, string[]> {
  const hits: Record<string, string[]> = {};
  for (const file of walk(SRC)) {
    const matches = readFileSync(file, "utf8").match(LITERAL_RADIUS_RE);
    if (matches) hits[relative(SRC, file)] = matches.sort();
  }
  return hits;
}

describe("radius token lock", () => {
  const hits = found();

  it("adds no literal radius beyond the known list", () => {
    const extra: string[] = [];
    for (const [file, list] of Object.entries(hits)) {
      const allowed = [...(KNOWN[file] ?? [])];
      for (const hit of list) {
        const i = allowed.indexOf(hit);
        if (i === -1) extra.push(`${file}: ${hit}`);
        else allowed.splice(i, 1);
      }
    }
    expect(
      extra,
      "A literal corner radius ignores the consumer's --radius. Use the scale " +
        "(rounded-sm, rounded-md, rounded-lg, rounded-full) or a var(--radius-*) " +
        "token. If no step fits, grow the radius scale instead of adding a literal.\n\n" +
        extra.join("\n"),
    ).toEqual([]);
  });

  it("lists no literal that has been fixed (the known list only shrinks)", () => {
    const stale: string[] = [];
    for (const [file, list] of Object.entries(KNOWN)) {
      const left = [...(hits[file] ?? [])];
      for (const known of list) {
        const i = left.indexOf(known);
        if (i === -1) stale.push(`${file}: ${known}`);
        else left.splice(i, 1);
      }
    }
    expect(
      stale,
      "These literals are gone from the source. Remove them from KNOWN in " +
        "radius-token-lock.test.ts so they cannot come back.\n\n" +
        stale.join("\n"),
    ).toEqual([]);
  });

  it("catches every form of a literal radius", () => {
    const sample =
      "rounded-[3px] rounded-t-[0.5rem] rounded-ss-[4px] rounded-[50%] rounded-[var(--radius)] rounded-[inherit] rounded-md";
    expect(sample.match(LITERAL_RADIUS_RE)).toEqual([
      "rounded-[3px]",
      "rounded-t-[0.5rem]",
      "rounded-ss-[4px]",
      "rounded-[50%]",
    ]);
  });
});
