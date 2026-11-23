/**
 * CTASection locks: band vs card surfaces, alignment, the decorative
 * background layer and the content slot under the actions.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CTASection } from "../src/patterns/cta-section.js";

const r = (el: React.ReactElement) => renderToStaticMarkup(el);
const sectionClass = (html: string) =>
  html.match(/<section[^>]*class="([^"]*)"/)![1]!;
const surfaceClass = (html: string) =>
  html.match(/data-slot="cta-section-surface" class="([^"]*)"/)![1]!;

describe("CTASection variants", () => {
  it("band paints the tone on the section and pads on the section rhythm", () => {
    const html = r(<CTASection title="Go" />);
    expect(html).toContain('data-variant="band"');
    expect(sectionClass(html)).toContain("bg-muted");
    expect(sectionClass(html)).toContain("py-section-comfortable");
    expect(surfaceClass(html)).not.toContain("rounded-2xl");
  });

  it("card paints the tone on a rounded surface and leaves the section bare", () => {
    const html = r(<CTASection title="Go" variant="card" tone="neutral" />);
    expect(html).toContain('data-variant="card"');
    expect(sectionClass(html)).not.toContain("bg-card");
    expect(surfaceClass(html)).toContain("rounded-2xl");
    expect(surfaceClass(html)).toContain("bg-card");
    expect(surfaceClass(html)).toContain("border");
  });

  it('align="start" puts the copy on the start edge', () => {
    const html = r(<CTASection title="Go" align="start" />);
    expect(html).toContain('data-align="start"');
    expect(html).toContain("text-start");
    expect(html).not.toContain("text-center");
  });

  it("hides the background layer from assistive tech and lets clicks through", () => {
    const html = r(<CTASection title="Go" variant="card" background={<i />} />);
    expect(html).toMatch(
      /data-slot="cta-section-background" aria-hidden="true" class="[^"]*pointer-events-none/,
    );
  });

  it("renders children under the actions", () => {
    const html = r(
      <CTASection title="Go" actions={<button>A</button>}>
        <input aria-label="Search" />
      </CTASection>,
    );
    expect(html.indexOf("cta-section-actions")).toBeLessThan(
      html.indexOf("cta-section-content"),
    );
    expect(html).toContain('aria-label="Search"');
  });

  it("sets the title on the section size of the fluid scale", () => {
    expect(r(<CTASection title="Go" />)).toContain("text-section");
  });

  it("names the section by its title, and leaves it unnamed without one", () => {
    const html = renderToStaticMarkup(<CTASection title="Book a session" />);
    const id = html.match(/<section[^>]*aria-labelledby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toMatch(
      new RegExp(`<h2[^>]*id="${id}"[^>]*>Book a session</h2>`),
    );
    expect(renderToStaticMarkup(<CTASection />)).not.toContain(
      "aria-labelledby",
    );
  });
});
