import type { Meta, StoryObj } from '@storybook/react-vite';
import { FocusGrid } from '@interlace/ui/patterns/focus-grid';
import { withRtl } from '@/decorators';

// Picture-free placeholders: a token gradient stands in for a photo, so the
// story makes no claim about real places and needs no network.
const Swatch = ({ from, to }: { from: string; to: string }) => (
  <div aria-hidden className={`bg-linear-to-br ${from} ${to}`} />
);

const ITEMS = [
  { title: 'The harbour walk', description: '45 minutes, flat', from: 'from-primary', to: 'to-chart-2' },
  { title: 'Old town stairs', description: '1 hour, steep', from: 'from-chart-2', to: 'to-chart-4' },
  { title: 'River gardens', description: '30 minutes, shaded', from: 'from-chart-4', to: 'to-highlight' },
];

const meta = {
  title: 'Blocks/FocusGrid',
  component: FocusGrid,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A grid of picture cards where the one you point at or tab to stays bright and the others step back. Pure CSS (`:has()`): no state, no hydration, works before scripts load. Each card is one link when given `href`, its text sits on a scrim that stays dark in both schemes, and only the blur and scale are motion-gated; the dimming that carries the meaning always applies.',
      },
    },
  },
  args: { columns: 3 },
  argTypes: {
    columns: { control: 'inline-radio', options: [2, 3, 4], table: { defaultValue: { summary: '3' } } },
  },
  render: (args) => (
    <FocusGrid {...args}>
      {ITEMS.map((item) => (
        <FocusGrid.Item
          key={item.title}
          href={`#${item.title}`}
          title={item.title}
          description={item.description}
          media={<Swatch from={item.from} to={item.to} />}
        />
      ))}
    </FocusGrid>
  ),
} satisfies Meta<typeof FocusGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const RTL: Story = { decorators: [withRtl] };
