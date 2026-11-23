import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { TopbarScrollEdge } from "@interlace/ui/patterns/topbar-scroll-edge";

const meta = {
  title: "Blocks/TopbarScrollEdge",
  component: TopbarScrollEdge,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          'The client half of `Topbar edge="scroll"`. It draws nothing: it marks its header `data-scrolled` once the page moves off its top, so the bar can stay clear over a hero and bring in its surface and border only when content passes beneath. `Topbar` renders it for you; see Blocks/Topbar → ClearUntilScroll for the effect.',
      },
    },
  },
  args: { threshold: 4 },
} satisfies Meta<typeof TopbarScrollEdge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Inside a header with `data-slot="topbar"`, styled from its `data-scrolled` attribute. */
export const Default: Story = {
  render: (args) => (
    <header
      data-slot="topbar"
      className="data-scrolled:border-border data-scrolled:bg-muted border-b border-transparent px-6 py-4 text-sm"
    >
      <TopbarScrollEdge {...args} />
      The header gains a surface and border once the page scrolls.
    </header>
  ),
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector("header")!;
    await expect(
      header.querySelector('[data-slot="topbar-scroll-edge"]'),
    ).not.toBeNull();
  },
};
