import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { TopbarMenu } from "@interlace/ui/patterns/topbar-menu";

const meta = {
  title: "Blocks/TopbarMenu",
  component: TopbarMenu,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The small-screen half of `Topbar`: a Menu button that opens the site links in a panel at the edge of the screen. On a phone a finger drags the panel back toward its edge to close it. `Topbar` renders it below 768px; it is exported for headers that compose their own row. Focus moves into the panel, Escape or a press outside closes it, and following a link closes it too.",
      },
    },
  },
  argTypes: {
    side: {
      control: "inline-radio",
      options: ["right", "left", "bottom"],
      table: { defaultValue: { summary: "right" } },
    },
  },
  args: {
    label: "Menu",
    children: (
      <>
        <a
          href="#home"
          aria-current="page"
          className="flex min-h-11 items-center rounded-md bg-muted px-3 font-semibold"
        >
          Home
        </a>
        <a
          href="#questions"
          className="flex min-h-11 items-center rounded-md px-3 font-medium"
        >
          Questions
        </a>
      </>
    ),
  },
} satisfies Meta<typeof TopbarMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Keyboard: Enter opens the panel with focus inside; Escape closes it and focus returns to the button. */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Menu" });
    button.focus();
    await userEvent.keyboard("{Enter}");
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog");
    await expect(
      within(dialog).getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(dialog.contains(canvasElement.ownerDocument.activeElement)).toBe(
        true,
      ),
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(button).toHaveFocus());
  },
};

/** Following a link closes the panel, so a client-side route change never leaves it open. */
export const ClosesOnNavigate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Menu" }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("link", { name: "Questions" }),
    );
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};

/** The panel can come from the left, or up from the bottom as a sheet with a handle. */
export const FromTheBottom: Story = {
  args: { side: "bottom" },
};
