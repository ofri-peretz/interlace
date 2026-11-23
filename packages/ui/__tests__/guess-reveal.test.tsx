/**
 * GuessReveal locks: one answer only, the result marked in words, the
 * explanation inert until the pick, the live status, the no-JS details
 * fallback, and the controlled prop.
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

import { GuessReveal } from "../src/patterns/guess-reveal.js";

afterEach(cleanup);

const OPTIONS = [
  { id: "a", label: "Mercury" },
  { id: "b", label: "Jupiter", correct: true },
  { id: "c", label: "Mars" },
];

const quiz = (
  props: Partial<React.ComponentProps<typeof GuessReveal>> = {},
) => (
  <GuessReveal
    question="Which planet has the shortest day?"
    options={OPTIONS}
    explanation={<a href="#s">Jupiter turns in under ten hours.</a>}
    {...props}
  />
);

const option = (name: string) =>
  screen.getByRole("button", { name: new RegExp(name) });

describe("GuessReveal", () => {
  it("labels the options group with the question and keeps the explanation inert until a pick", () => {
    render(quiz());
    const group = screen.getByRole("group", {
      name: "Which planet has the shortest day?",
    });
    expect(group.querySelectorAll("button")).toHaveLength(3);
    const explanation = document.querySelector(
      '[data-slot="guess-reveal-explanation"]',
    )!;
    expect(explanation.hasAttribute("inert")).toBe(true);
  });

  it("a wrong pick is marked in words, the right answer is shown, and the status is announced", () => {
    const onAnswer = vi.fn();
    render(quiz({ onAnswer }));
    act(() => fireEvent.click(option("Mars")));
    expect(onAnswer).toHaveBeenCalledWith("c", false);
    expect(option("Mars").dataset.result).toBe("wrong");
    expect(option("Mars").textContent).toContain("Your answer");
    expect(option("Jupiter").dataset.result).toBe("right");
    expect(option("Jupiter").textContent).toContain("The answer");
    const status = document.querySelector('[data-slot="guess-reveal-status"]')!;
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("Not quite.");
    expect(
      document
        .querySelector('[data-slot="guess-reveal-explanation"]')!
        .hasAttribute("inert"),
    ).toBe(false);
  });

  it("takes one answer only, and the options stay focusable", () => {
    const onAnswer = vi.fn();
    render(quiz({ onAnswer }));
    act(() => fireEvent.click(option("Jupiter")));
    act(() => fireEvent.click(option("Mercury")));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith("b", true);
    expect(
      document.querySelector('[data-slot="guess-reveal-status"]')!.textContent,
    ).toBe("Right.");
    for (const b of screen.getAllByRole("button")) {
      expect(b.getAttribute("aria-disabled")).toBe("true");
      expect(b.hasAttribute("disabled")).toBe(false);
    }
  });

  it("honours the controlled prop", () => {
    const { rerender } = render(quiz({ answer: null }));
    act(() => fireEvent.click(option("Mars")));
    expect(
      document
        .querySelector('[data-slot="guess-reveal"]')!
        .getAttribute("data-state"),
    ).toBe("open");
    rerender(quiz({ answer: "b" }));
    expect(
      document
        .querySelector('[data-slot="guess-reveal"]')!
        .getAttribute("data-state"),
    ).toBe("answered");
  });

  it("carries the answer in a details element for pages without JavaScript", () => {
    const html = renderToStaticMarkup(quiz());
    expect(html).toMatch(
      /<details data-slot="guess-reveal-fallback" class="[^"]*noscript:block/,
    );
    expect(html).toMatch(/<details[^]*Jupiter[^]*<\/details>/);
  });
});
