import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReadingTime, MIN_VIEWPORT } from '@interlace/ui/reading-time';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Primitives/ReadingTime',
  component: ReadingTime,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Compact "<N> min read" badge for article metadata rows. Inline `<span>` so it composes next to dates, authors, and tags without forcing block layout. Numeric value is mirrored on `data-reading-time` for analytics + JSON-LD consumers.',
      },
    },
  },
  argTypes: {
    minutes: { control: { type: 'number', min: 1, max: 60 } },
    showIcon: { control: 'boolean' },
  },
} satisfies Meta<typeof ReadingTime>;

export default meta;
type Story = StoryObj<typeof meta>;

const Sample = ({
  minutes,
  showIcon,
}: {
  minutes: number;
  showIcon?: boolean;
}) => (
  <div className="flex items-center gap-3 bg-background text-foreground">
    <span className="text-sm font-medium">Article title</span>
    <span aria-hidden className="text-muted-foreground">
      ·
    </span>
    <ReadingTime minutes={minutes} showIcon={showIcon} />
  </div>
);

export const Default: Story = {
  args: { minutes: 3 },
  render: (args) => <ReadingTime {...args} />,
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-3 bg-background text-foreground">
      <Sample minutes={1} />
      <Sample minutes={3} />
      <Sample minutes={7} showIcon />
      <Sample minutes={12} showIcon />
    </div>
  ),
};

export const Dark: Story = {
  ...Variants,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Variants,
  decorators: [withRtl],
};

export const BelowMinViewport: Story = {
  render: () => (
    <div
      data-interlace-dev
      style={{ width: MIN_VIEWPORT - 1 }}
      className="border-2 border-dashed border-muted p-3"
    >
      <Sample minutes={5} showIcon />
    </div>
  ),
};
