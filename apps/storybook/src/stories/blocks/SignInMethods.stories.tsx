import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { SignInMethods, type SignInMethod } from "@interlace/ui/patterns/sign-in-methods";
import { withRtl } from "@/decorators";

const meta: Meta<typeof SignInMethods> = {
  title: "Blocks/SignInMethods",
  component: SignInMethods,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The ways someone can sign in, each with Connect or Disconnect. Disconnecting asks once more in place, " +
          "and the last connected method is locked with the reason beside it, so nobody locks themselves out.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-(--container-prose)">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SignInMethods>;

const wait = () => new Promise((r) => setTimeout(r, 900));

const Live = ({ initial }: { initial: SignInMethod[] }) => {
  const [methods, setMethods] = React.useState(initial);
  const set = (id: string, connected: boolean) =>
    setMethods((ms) =>
      ms.map((m) => (m.id === id ? { ...m, connected, detail: connected ? "parent@example.com" : undefined } : m)),
    );
  return (
    <SignInMethods
      methods={methods}
      onConnect={async (id) => {
        await wait();
        set(id, true);
      }}
      onDisconnect={async (id) => {
        await wait();
        set(id, false);
      }}
    />
  );
};

const SEVERAL: SignInMethod[] = [
  { id: "google", connected: true, detail: "parent@example.com" },
  { id: "apple", connected: false },
  { id: "facebook", connected: false },
  { id: "x", connected: true, detail: "@parent" },
  { id: "email", connected: true, detail: "parent@example.com" },
];

export const Default: Story = {
  render: () => <Live initial={SEVERAL} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step("disconnect asks once more", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Disconnect X" }));
      await expect(canvas.getByRole("button", { name: "Yes, disconnect" })).toHaveFocus();
      await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    });
  },
};

/** Only one method left: it cannot be disconnected, and the hint says why. */
export const LastMethod: Story = {
  render: () => (
    <Live
      initial={[
        { id: "google", connected: true, detail: "parent@example.com" },
        { id: "apple", connected: false },
        { id: "email", connected: false },
      ]}
    />
  ),
};

export const Dark: Story = { ...Default, globals: { theme: "dark" }, play: undefined };
export const RTL: Story = { ...Default, decorators: [withRtl], play: undefined };
