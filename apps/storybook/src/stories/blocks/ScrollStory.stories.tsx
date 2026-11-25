import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { DotPlot, type DotRow, type DotSeries } from '@interlace/ui/charts/dot-plot';
import { ScrollStory, ScrollStoryStep } from '@interlace/ui/patterns/scroll-story';
import { withRtl } from '@/decorators';

// An invented survey: share of residents who walk or cycle to work, by district, ten years apart.
const BEFORE: DotSeries = { id: 'before', label: 'Ten years ago' };
const NOW: DotSeries = { id: 'now', label: 'This year' };

const ROWS: DotRow[] = [
  { label: 'Old Town', values: { before: 0.31, now: 0.47 } },
  { label: 'Riverside', values: { before: 0.18, now: 0.33 } },
  { label: 'Harbour', values: { before: 0.22, now: 0.29 } },
  { label: 'Hillcrest', values: { before: 0.09, now: 0.21 } },
  { label: 'Parkside', values: { before: 0.12, now: 0.16 } },
];

/** One chart state per step: the past, then the change, then the change sorted. */
const graphic = (step: number) => (
  <DotPlot
    label="Walk or cycle to work, by district (invented data)"
    series={step === 0 ? [BEFORE] : [BEFORE, NOW]}
    rows={ROWS}
    order={step >= 2 ? 'change' : 'given'}
    domain={[0, 0.5]}
    format={{ style: 'percent', maximumFractionDigits: 0 }}
    locale="en-US"
  />
);

const meta = {
  title: 'Blocks/ScrollStory',
  component: ScrollStory,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A chart that stays in view while the story beside it scrolls. Each step the reader reaches changes the chart through `graphic(step)`.\n\n' +
          '**Steps, not scroll position.** The chart changes when a step crosses the middle of the screen, never in proportion to scroll, so nothing moves while the reader holds still and scrolling back steps back.\n\n' +
          '**Content first.** Every step is in the server HTML in reading order and the chart is drawn for the first step. Write each step so it states its point in words: that is the story for a screen reader.\n\n' +
          '**By container.** At 48rem of its own box the steps and the chart sit side by side (`side` picks the chart’s column). Narrower, the chart stays at the top and the steps pass over it as cards. `--scroll-story-offset` clears a sticky page header.',
      },
    },
  },
  args: {
    graphic,
    side: 'end',
    children: null,
  },
  argTypes: {
    side: { control: 'inline-radio', options: ['start', 'end'], table: { category: 'Layout' } },
    graphic: { control: false, table: { category: 'Content' } },
    children: { control: false, table: { category: 'Content' } },
  },
  render: (args) => (
    <ScrollStory {...args}>
      <ScrollStoryStep>
        <p>Ten years ago, fewer than one resident in three walked or cycled to work in every district.</p>
      </ScrollStoryStep>
      <ScrollStoryStep>
        <p>This year the share is higher in all five. Old Town passed 45%.</p>
      </ScrollStoryStep>
      <ScrollStoryStep>
        <p>Sorted by the change, Old Town and Riverside rose most, and Parkside least.</p>
      </ScrollStoryStep>
    </ScrollStory>
  ),
} satisfies Meta<typeof ScrollStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Scroll: the chart adds this year, then sorts by the change. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-slot="scroll-story-step"]')).toHaveLength(3);
    await expect(canvasElement.querySelector('[data-slot="scroll-story-step"]')?.hasAttribute('data-active')).toBe(true);
  },
};

/** The chart in the start column. */
export const ChartFirst: Story = { args: { side: 'start' } };

export const Dark: Story = { globals: { theme: 'dark' } };

export const Rtl: Story = { decorators: [withRtl] };
