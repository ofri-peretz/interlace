/**
 * SocialSignIn locks: a plain form that submits `provider=<id>` without
 * JavaScript, the last-used provider first and tagged, extra providers as
 * named icon buttons, callbacks that intercept the submit, and the sent state
 * as a live region.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SocialSignIn, orderProviders } from "../src/patterns/social-sign-in.js";

afterEach(cleanup);

const providerButtons = () =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-slot="social-sign-in-provider"]'),
  );

describe("SocialSignIn", () => {
  it("server-renders a form whose buttons submit provider=<id>, so it works without JavaScript", () => {
    const html = renderToStaticMarkup(<SocialSignIn action="/auth/sign-in" />);
    expect(html).toContain('data-slot="social-sign-in"');
    expect(html).toContain('action="/auth/sign-in"');
    const doc = new DOMParser().parseFromString(html, "text/html");
    const buttons = Array.from(doc.querySelectorAll("button"));
    expect(buttons.map((b) => [b.type, b.name, b.value])).toEqual(
      ["google", "apple", "facebook", "x"].map((id) => ["submit", "provider", id]),
    );
  });

  it("features four or fewer providers by name, and puts the rest in a row of named icon buttons", () => {
    render(
      <SocialSignIn providers={["google", "apple", "facebook", "x", "tiktok", "microsoft"]} />,
    );
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Apple" })).toBeTruthy();
    const more = document.querySelector('[data-slot="social-sign-in-more"]')!;
    const icons = Array.from(more.querySelectorAll("button"));
    expect(icons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Continue with Facebook",
      "Continue with X",
      "Continue with TikTok",
      "Continue with Microsoft",
    ]);
    // Every icon button is 44px square.
    for (const b of icons) expect(b.className).toContain("size-11");
  });

  it("moves the last-used provider first and tags it", () => {
    render(<SocialSignIn providers={["google", "apple", "x"]} lastUsed="x" />);
    const [first] = providerButtons();
    expect(first.dataset.provider).toBe("x");
    expect(first.hasAttribute("data-last-used")).toBe(true);
    expect(first.textContent).toContain("Last used");
    expect(orderProviders(["google", "apple"], "nope").map((p) => p.id)).toEqual([
      "google",
      "apple",
    ]);
  });

  it("takes custom providers by id, name and icon", () => {
    render(
      <SocialSignIn
        providers={[{ id: "custom:acme", name: "Acme", icon: <svg data-testid="acme" /> }]}
      />,
    );
    const [button] = providerButtons();
    expect(button.value).toBe("custom:acme");
    expect(button.textContent).toContain("Continue with Acme");
    expect(screen.getByTestId("acme")).toBeTruthy();
  });

  it("calls onProviderSelect instead of submitting, and keeps that button busy until the promise settles", async () => {
    let resolve!: () => void;
    const onProviderSelect = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<SocialSignIn providers={["google", "apple"]} onProviderSelect={onProviderSelect} />);
    const google = screen.getByRole("button", { name: "Continue with Google" });
    await act(async () => {
      fireEvent.click(google);
    });
    expect(onProviderSelect).toHaveBeenCalledWith("google");
    expect(google.hasAttribute("data-loading")).toBe(true);
    // The other button is disabled while one runs.
    expect(
      (screen.getByRole("button", { name: "Continue with Apple" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await act(async () => resolve());
    expect(google.hasAttribute("data-loading")).toBe(false);
  });

  it("provider buttons skip validation, so an empty email field never blocks them", () => {
    render(<SocialSignIn email />);
    for (const b of providerButtons()) expect(b.formNoValidate).toBe(true);
    const field = screen.getByLabelText("Email") as HTMLInputElement;
    expect(field.required).toBe(true);
    expect(field.autocomplete).toBe("email");
  });

  it("sends the trimmed email to onEmailSubmit", async () => {
    const onEmailSubmit = vi.fn();
    render(<SocialSignIn email onEmailSubmit={onEmailSubmit} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " a@b.co " } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    });
    expect(onEmailSubmit).toHaveBeenCalledWith("a@b.co");
  });

  it("replaces the form with a live 'check your inbox' note once sent", () => {
    const onUseAnotherEmail = vi.fn();
    render(<SocialSignIn email sentTo="a@b.co" onUseAnotherEmail={onUseAnotherEmail} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Check your inbox");
    expect(status.textContent).toContain("a@b.co");
    expect(document.querySelector('[data-slot="social-sign-in"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use a different email" }));
    expect(onUseAnotherEmail).toHaveBeenCalled();
  });

  it("announces an error and describes the form with it", () => {
    render(<SocialSignIn error="That sign-in was cancelled." />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("That sign-in was cancelled.");
    const form = document.querySelector('[data-slot="social-sign-in"]')!;
    expect(form.getAttribute("aria-describedby")).toBe(alert.id);
  });
});
