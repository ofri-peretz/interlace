import * as React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Prose } from "../src/primitives/prose.js";

afterEach(cleanup);

const Simple = () => (
  <table>
    <thead>
      <tr>
        <th>Question</th>
        <th>State</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Is it true?</td>
        <td>
          <span data-status="success">supported</span>
        </td>
        <td>no header</td>
      </tr>
    </tbody>
  </table>
);

describe("Prose tables", () => {
  it("names each body cell after its column, so a phone can stack the rows", () => {
    const { container } = render(
      <Prose>
        <Simple />
      </Prose>,
    );
    const cells = container.querySelectorAll("td");
    expect(cells[0].getAttribute("data-label")).toBe("Question");
    expect(cells[1].getAttribute("data-label")).toBe("State");
    // A column with no name gets no label.
    expect(cells[2].hasAttribute("data-label")).toBe(false);
  });

  it("pins the table roles that a stacked layout would otherwise lose", () => {
    const { container } = render(
      <Prose>
        <Simple />
      </Prose>,
    );
    expect(container.querySelector("table")?.getAttribute("role")).toBe(
      "table",
    );
    expect(container.querySelector("thead")?.getAttribute("role")).toBe(
      "rowgroup",
    );
    expect(container.querySelector("tr")?.getAttribute("role")).toBe("row");
    expect(container.querySelector("th")?.getAttribute("role")).toBe(
      "columnheader",
    );
    expect(container.querySelector("td")?.getAttribute("role")).toBe("cell");
  });

  it("keeps labels and roles the author wrote", () => {
    const { container } = render(
      <Prose>
        <table role="grid">
          <thead>
            <tr>
              <th>Card</th>
              <th>Missing</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td data-label="Which card">a</td>
              <td>b</td>
            </tr>
          </tbody>
        </table>
      </Prose>,
    );
    const cells = container.querySelectorAll("td");
    expect(cells[0].getAttribute("data-label")).toBe("Which card");
    expect(cells[1].hasAttribute("data-label")).toBe(false);
    expect(container.querySelector("table")?.getAttribute("role")).toBe("grid");
  });

  it("leaves tables with merged cells or no header row alone", () => {
    const { container } = render(
      <Prose>
        <table id="merged">
          <thead>
            <tr>
              <th colSpan={2}>Both</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>a</td>
              <td>b</td>
            </tr>
          </tbody>
        </table>
        <table id="headless">
          <tbody>
            <tr>
              <td>a</td>
            </tr>
          </tbody>
        </table>
      </Prose>,
    );
    for (const id of ["merged", "headless"]) {
      const table = container.querySelector(`#${id}`)!;
      expect(table.hasAttribute("role")).toBe(false);
      expect(table.querySelector("td")!.hasAttribute("data-label")).toBe(false);
    }
  });
});
