import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { AppHeaderEdge } from '@interlace/ui/patterns/app-header-edge';

const meta = {
  title: 'Blocks/AppHeaderEdge',
  component: AppHeaderEdge,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The client half of `AppHeader`. It draws nothing: it marks its header `data-scrolled` once the page moves, and `data-collapsed` once a large title has scrolled under the bar. `AppHeader` renders it for you; see Blocks/AppHeader → LargeTitle for the effect.',
      },
    },
  },
  args: { threshold: 4 },
} satisfies Meta<typeof AppHeaderEdge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Inside a header with `data-slot="app-header"`, styled from its `data-scrolled` attribute. */
export const Default: Story = {
  render: (args) => (
    <header
      data-slot="app-header"
      className="data-scrolled:border-border data-scrolled:bg-muted border-b border-transparent px-6 py-4 text-sm"
    >
      <AppHeaderEdge {...args} />
      The header gains a surface and border once the page scrolls.
    </header>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot="app-header-edge"]')).not.toBeNull();
  },
};
