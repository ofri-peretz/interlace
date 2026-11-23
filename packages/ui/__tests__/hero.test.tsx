/**
 * Hero locks: the media slot is read by assistive tech unless the caller says
 * it is decorative, and the padding follows the section rhythm.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Hero } from "../src/patterns/hero.js";

describe("Hero media", () => {
  it("keeps interactive media in the accessibility tree by default", () => {
    const html = renderToStaticMarkup(
      <Hero headline="Find an answer" media={<input aria-label="Search" />} />,
    );
    expect(html).toContain('data-slot="hero-media"');
    expect(html).toContain('data-media-role="content"');
    expect(html).not.toContain("aria-hidden");
  });

  it("hides decorative media", () => {
    const html = renderToStaticMarkup(
      <Hero headline="Calm" mediaRole="decorative" media={<div />} />,
    );
    expect(html).toMatch(/data-slot="hero-media"[^>]*aria-hidden="true"/);
  });

  it("pads on the fluid section rhythm, not stepped utilities", () => {
    const html = renderToStaticMarkup(<Hero headline="Hi" />);
    expect(html).toContain("py-section-comfortable");
    expect(html).not.toMatch(/\bpy-16\b|xs:py-24/);
  });
});
