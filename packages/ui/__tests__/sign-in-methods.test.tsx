/**
 * OtpField and SignInMethods locks. OtpField: one box per character, the
 * first takes the field's label, groups get a decorative dash, invalid
 * reaches every box. SignInMethods: built-in names and marks, a confirm step
 * before disconnecting, and the last method locked with its reason.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OtpField } from "../src/primitives/otp-field.js";
import { SignInMethods } from "../src/patterns/sign-in-methods.js";

afterEach(cleanup);

const slots = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>('[data-slot="otp-field-slot"]'));

describe("OtpField", () => {
  it("renders one box per character; boxes after the first are named 'Character n of N'", () => {
    render(<OtpField id="code" />);
    const boxes = slots();
    expect(boxes).toHaveLength(6);
    expect(boxes[0].getAttribute("aria-label")).toBeNull();
    expect(boxes[0].getAttribute("autocomplete")).toBe("one-time-code");
    expect(boxes[5].getAttribute("aria-label")).toBe("Character 6 of 6");
  });

  it("splits into groups with a dash", () => {
    render(<OtpField groupSize={3} />);
    expect(document.querySelectorAll('[data-slot="otp-field-separator"]')).toHaveLength(1);
  });

  it("marks every box invalid", () => {
    render(<OtpField length={4} invalid />);
    for (const b of slots()) expect(b.getAttribute("aria-invalid")).toBe("true");
  });

  it("fires onValueComplete when a whole code is pasted", async () => {
    const onValueComplete = vi.fn();
    render(<OtpField onValueComplete={onValueComplete} />);
    const first = slots()[0];
    await act(async () => {
      first.focus();
      fireEvent.paste(first, { clipboardData: { getData: () => "123456" } });
    });
    expect(onValueComplete).toHaveBeenCalled();
    expect(onValueComplete.mock.calls[0][0]).toBe("123456");
  });
});

describe("SignInMethods", () => {
  const methods = [
    { id: "google", connected: true, detail: "a@b.co" },
    { id: "apple", connected: false },
    { id: "email", connected: true, detail: "a@b.co" },
  ];

  it("names built-in methods and shows 'Not connected' for the rest", () => {
    render(<SignInMethods methods={methods} />);
    const rows = Array.from(document.querySelectorAll('[data-slot="sign-in-method"]'));
    expect(rows.map((r) => r.querySelector("p")!.textContent)).toEqual(["Google", "Apple", "Email"]);
    expect(rows[1].textContent).toContain("Not connected");
    expect(screen.getByRole("button", { name: "Connect Apple" })).toBeTruthy();
  });

  it("asks once more before disconnecting, then calls onDisconnect", async () => {
    const onDisconnect = vi.fn();
    render(<SignInMethods methods={methods} onDisconnect={onDisconnect} />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));
    expect(onDisconnect).not.toHaveBeenCalled();
    const confirm = screen.getByRole("button", { name: "Yes, disconnect" });
    expect(document.activeElement).toBe(confirm);
    await act(async () => fireEvent.click(confirm));
    expect(onDisconnect).toHaveBeenCalledWith("google");
  });

  it("locks the last connected method and says why", () => {
    render(
      <SignInMethods
        methods={[
          { id: "google", connected: true },
          { id: "apple", connected: false },
        ]}
      />,
    );
    const b = screen.getByRole("button", { name: "Disconnect Google" }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    const hint = document.querySelector('[data-slot="sign-in-methods-hint"]')!;
    expect(b.getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("keeps the connecting row busy until the promise settles", async () => {
    let resolve!: () => void;
    const onConnect = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<SignInMethods methods={methods} onConnect={onConnect} />);
    const b = screen.getByRole("button", { name: "Connect Apple" });
    await act(async () => fireEvent.click(b));
    expect(onConnect).toHaveBeenCalledWith("apple");
    expect(b.hasAttribute("data-loading")).toBe(true);
    await act(async () => resolve());
    expect(b.hasAttribute("data-loading")).toBe(false);
  });

  it("absorbs a rejected onDisconnect and clears the busy state", async () => {
    const onDisconnect = vi.fn(() => Promise.reject(new Error("auth failed")));
    render(<SignInMethods methods={methods} onDisconnect={onDisconnect} />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, disconnect" }));
    });
    expect(onDisconnect).toHaveBeenCalledWith("google");
    expect(
      screen.getByRole("button", { name: "Disconnect Google" }).hasAttribute("data-loading"),
    ).toBe(false);
  });

  it("closes the confirmation even when no onDisconnect is given", () => {
    render(<SignInMethods methods={methods} />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, disconnect" }));
    expect(screen.queryByRole("button", { name: "Yes, disconnect" })).toBeNull();
  });
});
