import { Button } from '@interlace/ui/button';
import { Sheen } from '@interlace/ui/effects/sheen';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Sheen> = {
  title: 'Effects/Sheen',
  component: Sheen,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A soft band of light that crosses its parent every few seconds. It is a layer, not a button: drop it inside the one `Button` a page most wants pressed, and the button keeps its variant, size, focus ring and name. It sits under the label, takes no clicks, and renders nothing under reduced motion.',
      },
    },
  },
  argTypes: {
    color: { control: 'text', table: { defaultValue: { summary: 'var(--primary-foreground)' } } },
    strength: { control: { type: 'range', min: 0, max: 1, step: 0.05 }, table: { defaultValue: { summary: '0.35' } } },
    duration: { control: { type: 'number', min: 0.2, step: 0.1 }, table: { defaultValue: { summary: '1.2' } } },
    rest: { control: { type: 'number', min: 0, step: 0.5 }, table: { defaultValue: { summary: '3' } } },
  },
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      <Button size="lg">
        <Sheen {...args} />
        Get started
      </Button>
      <Button size="lg" variant="outline">
        Read the method
      </Button>
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof Sheen>;

export const OnAPrimaryButton: Story = {};
export const OnHighlight: Story = {
  render: (args) => (
    <Button size="lg" variant="highlight">
      <Sheen {...args} color="var(--highlight-foreground)" />
      Ask a question
    </Button>
  ),
};
