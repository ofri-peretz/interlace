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
    // Only the media wrapper: an icon in another slot may be aria-hidden.
    const wrapper = html.match(/<div[^>]*data-slot="hero-media"[^>]*>/)?.[0];
    expect(wrapper).toBeDefined();
    expect(wrapper).not.toContain("aria-hidden");
  });

  it("hides decorative media", () => {
    const html = renderToStaticMarkup(
      <Hero headline="Calm" mediaRole="decorative" media={<div />} />,
    );
    expect(html).toMatch(/data-slot="hero-media"[^>]*aria-hidden="true"/);
  });

  it("names the section by its headline", () => {
    const html = renderToStaticMarkup(<Hero headline="Find an answer" />);
    const id = html.match(/<section[^>]*aria-labelledby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toMatch(
      new RegExp(`<h1[^>]*id="${id}"[^>]*>Find an answer</h1>`),
    );
  });

  it("pads on the fluid section rhythm, not stepped utilities", () => {
    const html = renderToStaticMarkup(<Hero headline="Hi" />);
    expect(html).toContain("py-section-comfortable");
    expect(html).not.toMatch(/\bpy-16\b|xs:py-24/);
  });
});
