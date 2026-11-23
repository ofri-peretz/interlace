import { CountUp } from '@interlace/ui/effects/count-up';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof CountUp> = {
  title: 'Effects/CountUp',
  component: CountUp,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A number that counts to its value the first time it scrolls into view. The server renders the final figure, assistive tech reads one stable label, and the box is as wide as the final value from the start, so nothing shifts. `format` takes any `Intl.NumberFormat` options. Under reduced motion the final value shows at once.',
      },
    },
  },
  argTypes: {
    value: { control: 'number' },
    from: { control: 'number', table: { defaultValue: { summary: '0' } } },
    duration: { control: { type: 'number', min: 0, step: 100 }, table: { defaultValue: { summary: '1200' } } },
    start: { control: 'inline-radio', options: ['visible', 'mount'], table: { defaultValue: { summary: 'visible' } } },
    format: { control: 'object' },
    locale: { control: 'text' },
  },
  args: { value: 1280, locale: 'en-US' },
  render: (args) => (
    <p className="font-heading text-5xl font-semibold">
      <CountUp {...args} />
    </p>
  ),
};

export default meta;
type Story = StoryObj<typeof CountUp>;

export const Default: Story = {};
export const Compact: Story = { args: { value: 48200, format: { notation: 'compact', maximumFractionDigits: 1 } } };
export const Percent: Story = { args: { value: 0.98, format: { style: 'percent' } } };
export const Currency: Story = { args: { value: 12500, format: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } };
export const InASentence: Story = {
  render: (args) => (
    <p className="max-w-prose text-lg">
      Every answer cites at least three sources. So far that is <CountUp {...args} /> sources checked by hand.
    </p>
  ),
  args: { value: 1280 },
};
