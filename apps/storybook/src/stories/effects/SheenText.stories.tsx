import { SheenText } from '@interlace/ui/effects/sheen-text';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof SheenText> = {
  title: 'Effects/SheenText',
  component: SheenText,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A few words painted with a slow, travelling gradient. The gradient is the text colour, so both stops must be text-grade on the surface; the defaults (`--primary`, `--primary-active`) are, in both schemes. Forced-colours mode drops the gradient. Under reduced motion it holds still.',
      },
    },
  },
  argTypes: {
    from: { control: 'text', table: { defaultValue: { summary: 'var(--primary)' } } },
    to: { control: 'text', table: { defaultValue: { summary: 'var(--primary-active)' } } },
    duration: { control: { type: 'number', min: 1, step: 1 }, table: { defaultValue: { summary: '6' } } },
    animated: { control: 'boolean', table: { defaultValue: { summary: 'true' } } },
  },
  args: { children: 'with their sources' },
  render: (args) => (
    <h2 className="font-heading max-w-prose text-center text-4xl font-bold">
      Answers <SheenText {...args} />
    </h2>
  ),
};

export default meta;
type Story = StoryObj<typeof SheenText>;

export const Default: Story = {};
export const Still: Story = { args: { animated: false } };
