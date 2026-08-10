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
          'The "how long is this?" signal a reader checks before committing — for article headers, list cards and docs index rows. An inline `<span>`, so it drops into a metadata row next to a date or an author without imposing block layout, and it mirrors the raw number onto `data-reading-time` so analytics and JSON-LD builders never have to parse the label. The string is English-only by design: localise by wrapping this primitive, not by extending it.',
      },
    },
  },
  argTypes: {
    minutes: {
      control: { type: 'range', min: 1, max: 60, step: 1 },
      description:
        'Whole minutes. Rendered verbatim into "<N> min read" and mirrored on `data-reading-time` — round before passing, the primitive does no maths.',
      table: { type: { summary: 'number' }, category: 'Data' },
    },
    showIcon: {
      control: 'boolean',
      description:
        'Prefix a 14px lucide clock. Decorative (`aria-hidden`) — the text carries the meaning, so this is purely a density choice for the row it sits in.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'Appearance' },
    },
    loading: {
      control: 'boolean',
      description:
        'Swap in a text skeleton shaped to the badge footprint, so a metadata row reserves its space while the estimate is still being computed.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    className: {
      control: 'text',
      description:
        'Merged after `inline-flex items-center gap-1 text-muted-foreground text-sm` — the seam for a card that wants the badge smaller or in a different tone.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
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

/**
 * Shown in the metadata row it ships in — the badge on its own in a wide
 * canvas hides the only thing that matters about it, how it sits inline
 * beside its neighbours.
 */
export const Default: Story = {
  args: { minutes: 6, showIcon: true, loading: false },
  render: (args) => (
    <div className="bg-background text-foreground flex items-center gap-3">
      <span className="text-sm font-medium">Article title</span>
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      <ReadingTime {...args} />
    </div>
  ),
};

/**
 * Loading — the skeleton keeps the badge's footprint so the metadata row
 * doesn't reflow once the estimate lands.
 */
export const Loading: Story = {
  args: { loading: true },
  render: (args) => (
    <div className="bg-background text-foreground flex items-center gap-3">
      <span className="text-sm font-medium">Article title</span>
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      <ReadingTime {...args} />
    </div>
  ),
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
