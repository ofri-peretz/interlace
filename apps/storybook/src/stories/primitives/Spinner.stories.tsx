import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from '@interlace/ui/spinner';
import { expect, within } from 'storybook/test';

const meta: Meta<typeof Spinner> = {
  title: 'Primitives/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Something is working and there is no number to show yet. Announced once as a status ("Loading", or your `label`). Inside something that already says it is busy, pass `decorative`. It holds still under reduced motion.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg'],
      table: { defaultValue: { summary: 'sm' } },
    },
    label: { control: 'text', table: { defaultValue: { summary: 'Loading' } } },
    decorative: { control: 'boolean', table: { defaultValue: { summary: 'false' } } },
  },
};

export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  },
};

/** The three sizes, side by side. */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
    </div>
  ),
};

/** It takes the colour of the text around it. */
export const InText: Story = {
  render: () => (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-foreground flex items-center gap-2">
        <Spinner decorative />
        Saving your changes
      </p>
      <p className="text-muted-foreground flex items-center gap-2">
        <Spinner label="Checking" />
        Checking the address
      </p>
    </div>
  ),
};
