/**
 * FlipCard locks: a disclosure with both faces in the DOM, the turned-away
 * face inert after hydration, focus following the turn, and the no-JS and
 * reduced-motion fallbacks expressed in classes.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FlipCard } from "../src/patterns/flip-card.js";

afterEach(cleanup);

const card = (props: Partial<React.ComponentProps<typeof FlipCard>> = {}) => (
  <FlipCard front={<p>Q</p>} back={<a href="#s">Source</a>} {...props} />
);

describe("FlipCard", () => {
  it("server-renders both faces with nothing inert, so a page without JavaScript reads both", () => {
    const html = renderToStaticMarkup(card());
    expect(html).toContain('data-slot="flip-card-front"');
    expect(html).toContain('data-slot="flip-card-back"');
    expect(html).toContain("Source");
    expect(html).not.toContain("inert");
    // Without scripting the faces stack and the buttons hide.
    expect(html).toContain("noscript:row-start-2");
    expect(html).toContain("noscript:hidden");
  });

  it("is a disclosure: aria-expanded on the toggle, aria-controls pointing at the back", () => {
    render(card());
    const reveal = screen.getByRole("button", { name: /show answer/i });
    const back = document.querySelector('[data-slot="flip-card-back"]')!;
    expect(reveal.getAttribute("aria-expanded")).toBe("false");
    expect(reveal.getAttribute("aria-controls")).toBe(back.id);
    expect(back.hasAttribute("inert")).toBe(true);
  });

  it("turns over, makes the front inert and moves focus to the back", () => {
    const onFlippedChange = vi.fn();
    render(card({ onFlippedChange }));
    act(() =>
      fireEvent.click(screen.getByRole("button", { name: /show answer/i })),
    );
    expect(onFlippedChange).toHaveBeenCalledWith(true);
    const root = document.querySelector('[data-slot="flip-card"]')!;
    expect(root.hasAttribute("data-flipped")).toBe(true);
    expect(
      document
        .querySelector('[data-slot="flip-card-front"]')!
        .hasAttribute("inert"),
    ).toBe(true);
    expect(
      document
        .querySelector('[data-slot="flip-card-back"]')!
        .hasAttribute("inert"),
    ).toBe(false);
    expect(document.activeElement?.textContent).toContain("Show question");
  });

  it("honours the controlled prop", () => {
    const { rerender } = render(card({ flipped: false }));
    act(() =>
      fireEvent.click(screen.getByRole("button", { name: /show answer/i })),
    );
    // Controlled and not updated by the parent: it stays on the front.
    expect(
      document
        .querySelector('[data-slot="flip-card"]')!
        .hasAttribute("data-flipped"),
    ).toBe(false);
    rerender(card({ flipped: true }));
    expect(
      document
        .querySelector('[data-slot="flip-card"]')!
        .hasAttribute("data-flipped"),
    ).toBe(true);
  });

  it("rotates only when motion is allowed and cross-fades otherwise", () => {
    const html = renderToStaticMarkup(card());
    expect(html).toContain("motion-safe:group-data-flipped/flip:rotate-y-180");
    expect(html).toContain("motion-reduce:group-data-flipped/flip:opacity-0");
    expect(html).toContain("motion-reduce:group-data-flipped/flip:opacity-100");
  });
});
