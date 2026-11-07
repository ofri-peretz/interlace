/**
 * Gateway lock — interlace.tools is the front door to every product.
 *
 * Caught on 2026-10-11: burgee 1.0 and all nine family packages were on npm
 * and burgee.interlace.tools was live, yet the home page still said
 * "Coming soon" and linked to the GitHub repo. Every product card must link
 * to its own site, and the downloads line must come from the profile README
 * token, never a hand-typed number. See docs/intents/landing-gateway.
 *
 * Product copy now lives in src/data/brand-messages.json (published at
 * /brand.json), so the card rules are checked there.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseDownloads } from "../lib/downloads";
import messages from "../data/brand-messages.json";
import { renderBrand } from "../lib/brand";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const hero = readFileSync(
  join(PROJECT_ROOT, "src/components/home/landing-hero.tsx"),
  "utf-8",
);

describe("product cards", () => {
  const ids = messages.products.map((p) => p.id);

  it("lists every shipping product, oxmutate and burgee included", () => {
    expect(ids).toEqual(expect.arrayContaining(["eslint", "oxmutate", "burgee", "serverless", "ui"]));
  });

  // The front-page rule (intent: landing-gateway): one install command per
  // product, so a visitor can start without leaving the page.
  for (const product of messages.products) {
    it(`${product.id} has an install command and its own interlace.tools site`, () => {
      expect(product.install).toMatch(/^(?:npm i|npx) \S+/);
      expect(product.site).toMatch(/^[a-z]+\.interlace\.tools$/);
    });
  }

  it("core products each answer a question with a linked proof", () => {
    for (const p of messages.products.filter((p) => p.tier === "core")) {
      expect(p.question, p.id).toMatch(/\?$/);
      expect(p.proof?.url, p.id).toMatch(/^https:\/\//);
    }
  });
});

describe("brand messages", () => {
  it("fills every placeholder", () => {
    expect(JSON.stringify(renderBrand("1M+"))).not.toMatch(/\{[\w.]+\}/);
  });

  it("the hero renders the brand headline, not hand-typed copy", () => {
    expect(hero).toContain("{brand.headline}");
    expect(hero).toContain("{brand.subhead}");
  });

  // The banner, tagline, hero, OG card and bios all say what Interlace is in
  // the same words; a reworded copy is drift.
  it("every surface that describes Interlace uses the one descriptor", () => {
    const d = messages.descriptor.toLowerCase();
    for (const text of [messages.tagline, messages.subhead, messages.bios.github]) {
      expect(text.toLowerCase(), text).toContain(d);
    }
    const og = readFileSync(join(PROJECT_ROOT, "src/app/opengraph-image.tsx"), "utf-8");
    expect(og).toContain("messages.descriptor");
    expect(og).toContain("messages.headline");
    expect(og).not.toContain("coding agents ship");
  });

  it("the LinkedIn tagline fits LinkedIn's 120-character limit", () => {
    expect(messages.tagline.length).toBeLessThanOrEqual(120);
  });

  it("the GitHub bio fits GitHub's 160-character limit", () => {
    expect(messages.bios.github.length).toBeLessThanOrEqual(160);
  });
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
