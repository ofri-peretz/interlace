import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Testimonial,
  TestimonialGrid,
} from '@interlace/ui/patterns/testimonial';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof Testimonial> = {
  title: 'Blocks/Testimonial',
  component: Testimonial,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Quote + attribution surfaces. Single Testimonial renders a blockquote with author avatar; TestimonialGrid lays them out 1-3 columns.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Testimonial>;

const sampleItem = {
  quote:
    'Interlace made it dead-simple to ship our blog. We dropped one template and inherited the streaming, error-boundary, and skeleton contract.',
  authorName: 'Ada Lovelace',
  authorRole: 'Engineer @ Acme',
};

export const Default: Story = {
  args: sampleItem,
  render: (args) => (
    <div className="w-[420px]">
      <Testimonial {...args} />
    </div>
  ),
};

export const Grid: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <TestimonialGrid
      title="What people are saying"
      lead="Real quotes from real consumers (well, almost)."
      items={[sampleItem, { ...sampleItem, authorName: 'Grace Hopper' }, { ...sampleItem, authorName: 'Tim Berners-Lee' }]}
    />
  ),
};

export const Loading: Story = {
  args: { ...sampleItem, loading: true },
  render: (args) => (
    <div className="w-[420px]">
      <Testimonial {...args} />
    </div>
  ),
};

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
