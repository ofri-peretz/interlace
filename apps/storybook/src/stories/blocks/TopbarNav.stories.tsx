import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { TopbarNav } from "@interlace/ui/patterns/topbar-nav";

const item = (href: string, label: string, description: string) => (
  <li key={href}>
    <a
      href={href}
      className="hover:bg-muted focus-visible:bg-muted flex flex-col gap-0.5 rounded-lg p-3"
    >
      <span className="text-foreground text-sm font-medium">{label}</span>
      <span className="text-muted-foreground text-sm">{description}</span>
    </a>
  </li>
);

const meta = {
  title: "Blocks/TopbarNav",
  component: TopbarNav,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The wide-screen half of `Topbar` when its links hold groups: plain links and group triggers in one row, where a group opens a panel of its items. Built on Base UI NavigationMenu, so arrow keys move between triggers, Enter opens a panel, Escape closes it and returns focus. `Topbar` renders it for you; the links arrive already rendered, as `entries`.",
      },
    },
  },
  args: {
    entries: [
      {
        kind: "group",
        key: "products",
        label: "Products",
        node: (
          <ul className="grid gap-1">
            {item(
              "#reports",
              "Reports",
              "Every number, with the source beside it.",
            )}
            {item("#data", "Data", "Download the tables behind each report.")}
          </ul>
        ),
      },
      {
        kind: "link",
        key: "pricing",
        node: (
          <a
            href="#pricing"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Pricing
          </a>
        ),
      },
    ],
  },
} satisfies Meta<typeof TopbarNav>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opening a group shows its panel; Escape closes it and focus returns to the trigger. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Products",
    });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const body = within(canvasElement.ownerDocument.body);
    await body.findByRole("link", { name: /Reports/ });
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("false"),
    );
  },
};
