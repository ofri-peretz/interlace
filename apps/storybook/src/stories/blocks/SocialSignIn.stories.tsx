import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { SocialSignIn } from "@interlace/ui/patterns/social-sign-in";
import { withRtl } from "@/decorators";

const meta: Meta<typeof SocialSignIn> = {
  title: "Blocks/SocialSignIn",
  component: SocialSignIn,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Continue with Google, Apple, X and the rest, plus an optional email link, in one form. " +
          "The first providers get a full-width button and the rest share a row of icon buttons; the one used last time moves first with a tag. " +
          "Without JavaScript it is a plain form that submits `provider=<id>`; with callbacks, the pressed button spins until its promise settles. " +
          "It knows nothing about any auth library.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-96">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    providers: {
      control: "object",
      description:
        "Provider ids in order, or `{ id, name, icon }` for any other provider.",
      table: {
        category: "Content",
        defaultValue: { summary: "['google', 'apple', 'facebook', 'x']" },
      },
    },
    featured: {
      control: { type: "number", min: 0, max: 8 },
      description:
        "How many get a full-width button when there are more than four.",
      table: { category: "Layout", defaultValue: { summary: "2" } },
    },
    lastUsed: {
      control: "text",
      description: "The provider id (or 'email') used last time.",
      table: { category: "State" },
    },
    email: {
      control: "boolean",
      table: { category: "Content", defaultValue: { summary: "false" } },
    },
    sentTo: {
      control: "text",
      description: "Once set, the form becomes a 'check your inbox' note.",
      table: { category: "State" },
    },
    error: { control: "text", table: { category: "State" } },
    disabled: { control: "boolean", table: { category: "State" } },
  },
};

export default meta;
type Story = StoryObj<typeof SocialSignIn>;

const wait = () => new Promise((r) => setTimeout(r, 1200));

export const Default: Story = {
  args: { onProviderSelect: wait },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const google = canvas.getByRole("button", { name: "Continue with Google" });
    await step("pressing a provider keeps that button busy", async () => {
      await userEvent.click(google);
      await expect(google).toHaveAttribute("data-loading");
      await waitFor(() => expect(google).not.toHaveAttribute("data-loading"), {
        timeout: 3000,
      });
    });
  },
};

/** Every built-in provider: two featured, the rest as icon buttons. */
export const AllProviders: Story = {
  args: {
    providers: [
      "google",
      "apple",
      "facebook",
      "x",
      "tiktok",
      "microsoft",
      "linkedin",
      "github",
    ],
    onProviderSelect: wait,
  },
};

/** The visitor used X last time: it moves first and is tagged. */
export const LastUsed: Story = {
  args: {
    providers: ["google", "apple", "facebook", "x", "tiktok", "microsoft"],
    lastUsed: "x",
    onProviderSelect: wait,
  },
};

const EmailFlow = () => {
  const [sentTo, setSentTo] = React.useState<string>();
  return (
    <SocialSignIn
      email
      onProviderSelect={wait}
      onEmailSubmit={async (address) => {
        await wait();
        setSentTo(address);
      }}
      sentTo={sentTo}
      onUseAnotherEmail={() => setSentTo(undefined)}
      footer={
        <>
          By continuing you agree to the <a href="#terms">terms</a> and the{" "}
          <a href="#privacy">privacy notice</a>.
        </>
      }
    />
  );
};

/** Providers, then an email link; sending swaps in a 'check your inbox' note. */
export const WithEmail: Story = {
  render: () => <EmailFlow />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step("an empty field blocks only the email button", async () => {
      await userEvent.type(canvas.getByLabelText("Email"), "parent@example.com");
      await userEvent.click(
        canvas.getByRole("button", { name: "Email me a sign-in link" }),
      );
      await waitFor(() => expect(canvas.getByRole("status")).toBeVisible(), {
        timeout: 3000,
      });
      await expect(canvas.getByRole("status")).toHaveTextContent(
        "parent@example.com",
      );
    });
  },
};

const brief = () => new Promise((r) => setTimeout(r, 300));

const JourneyFlow = () => {
  const [sentTo, setSentTo] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  return (
    <SocialSignIn
      email
      providers={["google", "apple"]}
      onProviderSelect={async () => {
        setError(undefined);
        await brief();
        setError("That sign-in was cancelled. Try again, or use another way in.");
      }}
      onEmailSubmit={async (address) => {
        setError(undefined);
        await brief();
        setSentTo(address);
      }}
      sentTo={sentTo}
      onUseAnotherEmail={() => setSentTo(undefined)}
      error={error}
    />
  );
};

/**
 * The journey: a provider that comes back cancelled, then the email link,
 * the "check your inbox" note, and back to try another address.
 */
export const Journey: Story = {
  render: () => <JourneyFlow />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step("pending, then error: the provider was cancelled", async () => {
      const google = canvas.getByRole("button", { name: "Continue with Google" });
      await userEvent.click(google);
      await expect(google).toHaveAttribute("data-loading");
      await expect(await canvas.findByRole("alert", {}, { timeout: 2000 })).toHaveTextContent("cancelled");
    });
    await step("sent: the email link went out", async () => {
      await userEvent.type(canvas.getByLabelText("Email"), "parent@example.com");
      await userEvent.click(canvas.getByRole("button", { name: "Email me a sign-in link" }));
      await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("parent@example.com"), {
        timeout: 2000,
      });
    });
    await step("choose: back to the form for another address", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Use a different email" }));
      await expect(canvas.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    });
  },
};

export const Sent: Story = {
  args: { email: true, sentTo: "parent@example.com", onUseAnotherEmail: () => {} },
};

export const WithError: Story = {
  args: {
    email: true,
    error: "That sign-in was cancelled. Try again, or use another way in.",
  },
};

export const Dark: Story = {
  ...AllProviders,
  globals: { theme: "dark" },
};

export const RTL: Story = {
  ...LastUsed,
  decorators: [withRtl],
};
