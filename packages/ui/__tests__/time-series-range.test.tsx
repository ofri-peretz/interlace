/**
 * TimeSeries range comparison — the "two points, one delta" gesture.
 *
 * These drive the KEYBOARD path on purpose. The pointer path resolves through
 * the same `select()` call, and a jsdom SVG has no layout — `getBoundingClientRect`
 * returns an all-zero box, so `slotFrom` correctly refuses to guess and every
 * pointer assertion here would be testing the shim rather than the component.
 * The pointer path is gated in Storybook, where boxes are real.
 *
 * What is worth locking is the arithmetic and the honesty rules around it: a
 * single mark is not a comparison, a point compared with itself is not a
 * comparison, and a gap at either end is not a zero.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimeSeries } from "../src/charts/time-series.js";
import type { Point } from "../src/charts/scale.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom does no layout, so every box is 0x0 and `slotFrom` correctly refuses
// to guess a slot from it. Give the plot a real box and the pointer path
// becomes reachable — without this the click-to-compare gesture is untested,
// which for a feature whose headline use is "click two points" is not a gap
// worth accepting.
// jsdom implements no `PointerEvent`, so Testing Library falls back to a
// generic Event and every coordinate arrives `undefined` — the pointer path
// then resolves a NaN slot and proves nothing. (strand-field.test carries the
// same shim, for the same reason.)
if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEventShim extends MouseEvent {
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? "";
    }
  }
  globalThis.PointerEvent = PointerEventShim as unknown as typeof PointerEvent;
}

const PLOT_WIDTH = 900;
function withLayout(svg: Element) {
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: PLOT_WIDTH,
    bottom: 220,
    width: PLOT_WIDTH,
    height: 220,
    toJSON: () => ({}),
  } as DOMRect);
}

/** clientX for a slot, mirroring the component: viewBox x = PAD_LEFT + plot.x. */
const PAD_LEFT = 44;
const xFor = (slot: number, slots: number) =>
  PAD_LEFT + (slot / (slots - 1)) * (PLOT_WIDTH - PAD_LEFT);

const RISING: Point[] = [
  { t: "2026-06-01", v: 100 },
  { t: "2026-06-08", v: 150 },
  { t: "2026-06-15", v: 200 },
];

const readout = () => document.querySelector("output")?.textContent ?? "";
const plot = () => screen.getByRole("img");

/** Focus the chart and put the crosshair on `slot` via Home + ArrowRight. */
function cursorTo(slot: number) {
  const svg = plot();
  svg.focus();
  fireEvent.keyDown(svg, { key: "Home" });
  for (let i = 0; i < slot; i++) fireEvent.keyDown(svg, { key: "ArrowRight" });
}

function mark() {
  fireEvent.keyDown(plot(), { key: "Enter" });
}

describe("TimeSeries range comparison", () => {
  it("one mark is a reading, not a comparison", () => {
    render(
      <TimeSeries points={RISING} label="npm downloads" unit="downloads" />,
    );
    cursorTo(0);
    mark();
    // The arrow is the comparison's signature. Asserting its ABSENCE is the
    // point: an off-by-one would compare slot 0 with itself and report 0%.
    expect(readout()).not.toContain("→");
  });

  it("two marks report the absolute change and the percentage", () => {
    render(
      <TimeSeries points={RISING} label="npm downloads" unit="downloads" />,
    );
    cursorTo(0);
    mark();
    cursorTo(2);
    mark();
    expect(readout()).toContain("2026-06-01");
    expect(readout()).toContain("2026-06-15");
    expect(readout()).toContain("100"); // 200 - 100
    expect(readout()).toContain("100.0%"); // doubled — Delta prints one decimal
  });

  it("states the direction as data, not only as colour (WCAG 1.4.1)", () => {
    render(
      <TimeSeries points={RISING} label="npm downloads" unit="downloads" />,
    );
    cursorTo(0);
    mark();
    cursorTo(2);
    mark();
    expect(
      document
        .querySelector("[data-direction]")
        ?.getAttribute("data-direction"),
    ).toBe("up");
  });

  it("reads a fall as a fall, whichever end was marked first", () => {
    render(
      <TimeSeries points={RISING} label="npm downloads" unit="downloads" />,
    );
    // Mark the LATER point first. The comparison must still read
    // earlier → later, so the direction describes time, not click order.
    cursorTo(2);
    mark();
    cursorTo(0);
    mark();
    expect(readout().indexOf("2026-06-01")).toBeLessThan(
      readout().indexOf("2026-06-15"),
    );
    expect(
      document
        .querySelector("[data-direction]")
        ?.getAttribute("data-direction"),
    ).toBe("up");
  });

  it("refuses to compare a point with itself", () => {
    render(
      <TimeSeries points={RISING} label="npm downloads" unit="downloads" />,
    );
    cursorTo(1);
    mark();
    mark(); // same slot — clears rather than claiming a 0% change
    expect(readout()).not.toContain("→");
  });

  it("refuses to compare across a gap rather than inventing a value", () => {
    // A gap needs TWO series to exist at all, and finding that out is why this
    // test earns its place. `keys` is the union of the dates each series
    // actually carries, so a lone `v: null` never becomes a slot — it vanishes,
    // and the chart has no gap to mishandle. Give a second series the missing
    // day and slot 1 becomes a real hole in the primary.
    const sparse: Point[] = [
      { t: "2026-06-01", v: 100 },
      { t: "2026-06-15", v: 200 },
    ];
    const dense: Point[] = [
      { t: "2026-06-01", v: 10 },
      { t: "2026-06-08", v: 20 },
      { t: "2026-06-15", v: 30 },
    ];
    render(
      <TimeSeries
        points={sparse}
        compare={[{ points: dense, label: "other" }]}
        label="npm downloads"
        unit="downloads"
      />,
    );
    cursorTo(0);
    mark();
    cursorTo(1); // the primary has no reading here
    mark();
    // Bridging the hole would report a change that never happened, which is
    // the one failure mode worth being strict about.
    expect(readout()).not.toContain("→");
  });

  it("a third mark starts a new range", () => {
    render(
      <TimeSeries points={RISING} label="npm downloads" unit="downloads" />,
    );
    cursorTo(0);
    mark();
    cursorTo(2);
    mark();
    expect(readout()).toContain("→");
    cursorTo(1);
    mark();
    expect(readout()).not.toContain("→");
  });

  it("Escape clears the selection, not just the crosshair", () => {
    render(
      <TimeSeries points={RISING} label="npm downloads" unit="downloads" />,
    );
    cursorTo(0);
    mark();
    cursorTo(2);
    mark();
    fireEvent.keyDown(plot(), { key: "Escape" });
    expect(readout()).toBe("");
  });

  it("draws the band only once a range exists", () => {
    const { container } = render(
      <TimeSeries points={RISING} label="npm downloads" unit="downloads" />,
    );
    const band = () =>
      container.querySelector('[data-slot="time-series-range"]');
    expect(band()).toBeNull();
    cursorTo(0);
    mark();
    // One mark plus a live cursor is already a previewable range.
    expect(band()).not.toBeNull();
  });

  describe("the pointer path selects the same way the keyboard does", () => {
    it("two clicks produce the same comparison two Enters do", () => {
      render(
        <TimeSeries points={RISING} label="npm downloads" unit="downloads" />,
      );
      const svg = plot();
      withLayout(svg);
      fireEvent.pointerUp(svg, { clientX: xFor(0, 3), pointerType: "mouse" });
      expect(readout()).not.toContain("→");
      fireEvent.pointerUp(svg, { clientX: xFor(2, 3), pointerType: "mouse" });
      expect(readout()).toContain("2026-06-01");
      expect(readout()).toContain("2026-06-15");
      expect(readout()).toContain("100.0%");
    });

    it("a touch places the crosshair before selecting, because a finger never hovered", () => {
      render(
        <TimeSeries points={RISING} label="npm downloads" unit="downloads" />,
      );
      const svg = plot();
      withLayout(svg);
      // No pointermove first — exactly what a tap looks like. The readout has
      // to name the tapped date, which only happens if the touch branch moved
      // the cursor itself.
      fireEvent.pointerUp(svg, { clientX: xFor(1, 3), pointerType: "touch" });
      expect(readout()).toContain("2026-06-08");
    });

    it("ignores a pointer event before the plot has been laid out", () => {
      // The un-stubbed 0x0 box. Guessing a slot from it would select an
      // arbitrary point on the first frame after mount.
      render(
        <TimeSeries points={RISING} label="npm downloads" unit="downloads" />,
      );
      fireEvent.pointerUp(plot(), { clientX: 400, pointerType: "mouse" });
      expect(readout()).toBe("");
    });
  });

  it("Enter with no crosshair yet marks the first observation", () => {
    // `cursor ?? 0`. Focus and press Enter without arrowing first — the
    // gesture has to start somewhere, and silently doing nothing would look
    // like the key was not handled.
    render(
      <TimeSeries points={RISING} label="npm downloads" unit="downloads" />,
    );
    const svg = plot();
    svg.focus();
    fireEvent.keyDown(svg, { key: "Enter" });
    fireEvent.keyDown(svg, { key: "End" });
    fireEvent.keyDown(svg, { key: "Enter" });
    expect(readout()).toContain("2026-06-01"); // the anchor defaulted to slot 0
    expect(readout()).toContain("2026-06-15");
  });

  it("ignores a pointer event that carries no coordinates", () => {
    // A laid-out box but no clientX — which is precisely what a PointerEvent
    // looks like in an environment that does not implement one. Without the
    // finite check this resolves a NaN slot and paints NaN into every x
    // attribute on the plot.
    render(
      <TimeSeries points={RISING} label="npm downloads" unit="downloads" />,
    );
    const svg = plot();
    withLayout(svg);
    fireEvent(svg, new Event("pointerup", { bubbles: true }));
    expect(readout()).toBe("");
  });
});
