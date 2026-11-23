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

  it("calls onAnswer once even when a controlled parent sets the answer later", () => {
    const onAnswer = vi.fn();
    // The parent is still awaiting: `answer` stays null across both clicks.
    render(quiz({ answer: null, onAnswer }));
    act(() => fireEvent.click(option("Mars")));
    act(() => fireEvent.click(option("Jupiter")));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith("c", false);
  });

  it("takes a new answer after a controlled parent clears the old one", () => {
    const onAnswer = vi.fn();
    const { rerender } = render(quiz({ answer: "c", onAnswer }));
    rerender(quiz({ answer: null, onAnswer }));
    act(() => fireEvent.click(option("Jupiter")));
    expect(onAnswer).toHaveBeenCalledWith("b", true);
  });

  it("points aria-describedby only at an explanation that exists", () => {
    render(quiz({ explanation: undefined }));
    act(() => fireEvent.click(option("Mars")));
    for (const button of screen.getAllByRole("button")) {
      expect(button.hasAttribute("aria-describedby")).toBe(false);
    }
    cleanup();
    render(quiz());
    act(() => fireEvent.click(option("Mars")));
    const id = option("Mars").getAttribute("aria-describedby")!;
    expect(document.getElementById(id)).not.toBeNull();
  });

  it("starts answered with defaultAnswer and does not call onAnswer", () => {
    const onAnswer = vi.fn();
    render(quiz({ defaultAnswer: "b", onAnswer }));
    expect(option("Jupiter").dataset.result).toBe("right");
    expect(option("Jupiter").textContent).toContain("Your answer");
    act(() => fireEvent.click(option("Mars")));
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("uses the labels it is given", () => {
    render(quiz({ labels: { right: "Correct!", wrong: "Oops." } }));
    act(() => fireEvent.click(option("Mars")));
    expect(
      document.querySelector('[data-slot="guess-reveal-status"]')!.textContent,
    ).toBe("Oops.");
  });

  it("carries the answer in a details element for pages without JavaScript", () => {
    const html = renderToStaticMarkup(quiz());
    expect(html).toMatch(
      /<details data-slot="guess-reveal-fallback" class="[^"]*noscript:block/,
    );
    expect(html).toMatch(/<details[^]*Jupiter[^]*<\/details>/);
  });
});
