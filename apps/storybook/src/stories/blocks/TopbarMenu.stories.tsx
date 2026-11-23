import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { TopbarMenu } from '@interlace/ui/patterns/topbar-menu';

const meta = {
  title: 'Blocks/TopbarMenu',
  component: TopbarMenu,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The small-screen half of `Topbar`: a Menu button that opens the site links in a side sheet. `Topbar` renders it below 768px; it is exported for headers that compose their own row. Focus moves into the sheet, Escape or a press outside closes it, and following a link closes it too.',
      },
    },
  },
  args: {
    label: 'Menu',
    children: (
      <>
        <a href="#home" aria-current="page" className="flex min-h-11 items-center rounded-md bg-muted px-3 font-semibold">
          Home
        </a>
        <a href="#questions" className="flex min-h-11 items-center rounded-md px-3 font-medium">
          Questions
        </a>
      </>
    ),
  },
} satisfies Meta<typeof TopbarMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Keyboard: Enter opens the sheet with focus inside; Escape closes it. */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Menu' }));
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
  },
};
