import { RotatingText } from '@interlace/ui/effects/rotating-text';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof RotatingText> = {
  title: 'Effects/RotatingText',
  component: RotatingText,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One word in a headline that changes every few seconds. Every word shares one grid cell, so the line never reflows (CLS 0). Assistive tech reads one stable label instead of the moving words. Rotation pauses on hover, on focus and in a hidden tab, and stays on the first word under reduced motion.',
      },
    },
  },
  argTypes: {
    words: { control: 'object' },
    interval: { control: { type: 'number', min: 1000, step: 200 }, table: { defaultValue: { summary: '2800' } } },
    pauseOnHover: { control: 'boolean', table: { defaultValue: { summary: 'true' } } },
    label: { control: 'text' },
  },
  args: { words: ['teams', 'founders', 'students', 'parents'] },
  render: (args) => (
    <h2 className="font-heading text-4xl font-bold">
      Built for <RotatingText {...args} className="text-primary" />
    </h2>
  ),
};

export default meta;
type Story = StoryObj<typeof RotatingText>;

export const Default: Story = {};
export const Slow: Story = { args: { interval: 4500 } };
