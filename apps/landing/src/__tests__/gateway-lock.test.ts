/**
 * Gateway lock — interlace.tools is the front door to every product.
 *
 * Caught on 2026-10-11: burgee 1.0 and all nine family packages were on npm
 * and burgee.interlace.tools was live, yet the home page still said
 * "Coming soon" and linked to the GitHub repo. Every product card must link
 * to its own site, and the downloads line must come from the profile README
 * token, never a hand-typed number. See docs/intents/landing-gateway.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseDownloads } from "../lib/downloads";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const page = readFileSync(join(PROJECT_ROOT, "src/app/(home)/page.tsx"), "utf-8");
const hero = readFileSync(
  join(PROJECT_ROOT, "src/components/home/landing-hero.tsx"),
  "utf-8",
);

// Each card is read up to its `status` prop, so `name`, `badge` and `href`
// must come before `status` in the JSX (they do today). A card missing
// `status` would not be matched at all, and the "lists burgee" check would fail.
const cards = [...page.matchAll(/<ProductCard\s([\s\S]*?status="[^"]*")/g)].map((m) => m[1]);
const prop = (card: string, key: string) =>
  card.match(new RegExp(`${key}="([^"]*)"`))?.[1];

describe("product cards", () => {
  it("lists burgee", () => {
    expect(cards.map((c) => prop(c, "name"))).toContain("burgee");
  });

  for (const card of cards) {
    const name = prop(card, "name");
    it(`${name} links to its own interlace.tools site and is shipping`, () => {
      const badge = prop(card, "badge");
      expect(badge).toMatch(/^[a-z]+\.interlace\.tools$/);
      expect(prop(card, "href")).toMatch(new RegExp(`^https://${badge}/`));
      expect(prop(card, "status")).toBe("shipping");
    });
  }
});

describe("downloads line", () => {
  it("is not hand-typed in the hero", () => {
    expect(hero).not.toMatch(/\d(?:\.\d+)?[KM]\+/);
  });

  it("reads the milestone token the profile workflow writes", () => {
    expect(parseDownloads("— 0.75M+ npm downloads and")).toBe("0.75M+");
    expect(parseDownloads("475K+ npm downloads")).toBe("475K+");
    expect(parseDownloads("1M+ npm downloads")).toBe("1M+");
    expect(parseDownloads("no stats here")).toBeNull();
  });
});
