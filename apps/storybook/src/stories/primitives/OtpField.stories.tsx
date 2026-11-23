import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { OtpField } from "@interlace/ui/otp-field";
import { withRtl } from "@/decorators";

const meta: Meta<typeof OtpField> = {
  title: "Primitives/OtpField",
  component: OtpField,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A one-time code typed into a row of boxes. Paste the whole code into any box, or let the phone fill it from a message. " +
          "The first box takes the field's label; the value submits under `name`.",
      },
    },
  },
  argTypes: {
    length: { control: { type: "number", min: 4, max: 8 }, table: { category: "Content", defaultValue: { summary: "6" } } },
    groupSize: { control: { type: "number", min: 0, max: 4 }, table: { category: "Layout" } },
    size: { control: "inline-radio", options: ["sm", "default"], table: { category: "Layout", defaultValue: { summary: "default" } } },
    invalid: { control: "boolean", table: { category: "State" } },
    disabled: { control: "boolean", table: { category: "State" } },
  },
};

export default meta;
type Story = StoryObj<typeof OtpField>;

const Labelled = (args: React.ComponentProps<typeof OtpField>) => {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        Sign-in code
      </label>
      <OtpField id={id} aria-describedby={`${id}-d`} {...args} />
      <p id={`${id}-d`} className="text-muted-foreground text-sm">
        Enter the 6-digit code we emailed you.
      </p>
    </div>
  );
};

export const Default: Story = {
  render: (args) => <Labelled {...args} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step("typing moves through the boxes", async () => {
      await userEvent.click(canvas.getByLabelText("Sign-in code"));
      await userEvent.keyboard("4821");
      await expect(canvas.getByLabelText("Character 5 of 6")).toHaveFocus();
    });
  },
};

export const Grouped: Story = { args: { groupSize: 3, defaultValue: "482" }, render: (args) => <Labelled {...args} /> };
export const Invalid: Story = { args: { invalid: true, defaultValue: "482193" }, render: (args) => <Labelled {...args} /> };
export const Small: Story = { args: { size: "sm", length: 8, validationType: "alphanumeric" }, render: (args) => <Labelled {...args} /> };
export const Disabled: Story = { args: { disabled: true }, render: (args) => <Labelled {...args} /> };
export const Dark: Story = { ...Grouped, globals: { theme: "dark" } };
export const RTL: Story = { ...Grouped, decorators: [withRtl] };
