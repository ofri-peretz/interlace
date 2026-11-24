import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ShareChart, type ShareCategory, type ShareRow } from '@interlace/ui/charts/share-chart';
import { DotPlot, type DotRow } from '@interlace/ui/charts/dot-plot';
import { TimeSlider, type TimeFrame } from '@interlace/ui/charts/time-slider';
import { withRtl } from '@/decorators';

// An invented travel survey: how residents of three districts get to work, every other year.
const MODES: ShareCategory[] = [
  { id: 'walk', label: 'Walk or cycle' },
  { id: 'transit', label: 'Bus or train' },
  { id: 'car', label: 'Car' },
];

const YEARS = [2016, 2018, 2020, 2022, 2024] as const;

const SURVEY: Record<number, ShareRow[]> = {
  2016: [
    { label: 'Old Town', values: { walk: 31, transit: 38, car: 31 } },
    { label: 'Riverside', values: { walk: 18, transit: 34, car: 48 } },
    { label: 'Hillcrest', values: { walk: 9, transit: 22, car: 69 } },
  ],
  2018: [
    { label: 'Old Town', values: { walk: 34, transit: 38, car: 28 } },
    { label: 'Riverside', values: { walk: 21, transit: 36, car: 43 } },
    { label: 'Hillcrest', values: { walk: 11, transit: 24, car: 65 } },
  ],
  2020: [
    { label: 'Old Town', values: { walk: 42, transit: 29, car: 29 } },
    { label: 'Riverside', values: { walk: 27, transit: 27, car: 46 } },
    { label: 'Hillcrest', values: { walk: 14, transit: 17, car: 69 } },
  ],
  2022: [
    { label: 'Old Town', values: { walk: 44, transit: 33, car: 23 } },
    { label: 'Riverside', values: { walk: 30, transit: 33, car: 37 } },
    { label: 'Hillcrest', values: { walk: 17, transit: 25, car: 58 } },
  ],
  2024: [
    { label: 'Old Town', values: { walk: 47, transit: 35, car: 18 } },
    { label: 'Riverside', values: { walk: 33, transit: 36, car: 31 } },
    { label: 'Hillcrest', values: { walk: 21, transit: 29, car: 50 } },
  ],
};

const meta = {
  title: 'Charts/TimeSlider',
  component: TimeSlider,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Step any chart through time: a play button, a slider with one stop per frame, and the frame printed beside them. The chart is drawn by `children(frame, index)`, so every chart in the data tier works inside it.\n\n' +
          '**Content first.** The server HTML holds the chart for the opening frame (the latest, unless `defaultValue` says otherwise).\n\n' +
          '**Play is the reader’s.** It never starts on its own, steps every `frameDuration` ms (at least 250), stops on the last frame or loops with `loop`, and touching the slider stops it.\n\n' +
          '**Words.** The thumb speaks the frame, not its index; the printed frame is announced while paused and quiet while playing. Numbers print in `locale` without grouping; `formatFrame` prints anything else.\n\n' +
          '**Right to left.** In an RTL page time runs from right to left and the arrow keys follow it.',
      },
    },
  },
  args: {
    frames: [...YEARS],
    locale: 'en-US',
    labels: { slider: 'Year' },
    children: (frame: TimeFrame, _index: number) => (
      <ShareChart
        label={`How residents get to work, ${frame} (invented data)`}
        categories={MODES}
        rows={SURVEY[frame as number] ?? []}
        locale="en-US"
      />
    ),
  },
  argTypes: {
    frames: { control: 'object', table: { category: 'Data' } },
    defaultValue: { control: 'number', table: { category: 'State' } },
    frameDuration: { control: 'number', table: { category: 'Play' } },
    loop: { control: 'boolean', table: { category: 'Play' } },
    locale: { control: 'text', table: { category: 'Content' } },
    labels: { control: 'object', table: { category: 'Content' } },
    children: { control: false, table: { category: 'Content' } },
  },
  render: (args) => (
    <div className="max-w-prose">
      <TimeSlider {...args} />
    </div>
  ),
} satisfies Meta<typeof TimeSlider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A stacked share chart stepped through five survey years. */
export const Default: Story = {};

/** Home jumps to the first year; the thumb speaks the year. */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const slider = canvas.getByRole('slider', { name: 'Year' });
    await expect(slider.getAttribute('aria-valuetext')).toBe('2024');
    slider.focus();
    await userEvent.keyboard('{Home}');
    await expect(canvas.getByText('2016', { selector: 'output' })).toBeTruthy();
    await expect(canvas.getByRole('button', { name: 'Play' })).toBeTruthy();
  },
};

/** Opens on the first year; play loops. */
export const Looping: Story = { args: { defaultValue: 0, loop: true, frameDuration: 800 } };

// The same survey as dots, one district per row, a single series per year.
const DOT_ROWS = (year: number): DotRow[] =>
  (SURVEY[year] ?? []).map((row) => ({ label: row.label, values: { walk: (row.values.walk ?? 0) / 100 } }));

/** Any chart goes inside: a dot plot with a fixed axis, so the dots move against it. */
export const WithDotPlot: Story = {
  args: {
    children: (frame) => (
      <DotPlot
        label={`Walk or cycle to work, ${frame} (invented data)`}
        series={[{ id: 'walk', label: 'Walk or cycle' }]}
        rows={DOT_ROWS(frame as number)}
        domain={[0, 0.5]}
        format={{ style: 'percent', maximumFractionDigits: 0 }}
        locale="en-US"
      />
    ),
  },
};

/** Frames that are not numbers print as given. */
export const Seasons: Story = {
  args: {
    frames: ['Spring', 'Summer', 'Autumn', 'Winter'],
    labels: { slider: 'Season' },
    children: (frame, index) => (
      <ShareChart
        label={`How residents get to work, ${frame} (invented data)`}
        categories={MODES}
        rows={SURVEY[YEARS[index + 1] ?? 2024] ?? []}
        locale="en-US"
      />
    ),
  },
};

/** Arabic digits and words, right to left. */
export const Rtl: Story = {
  args: { locale: 'ar-EG', labels: { slider: 'السنة', play: 'تشغيل', pause: 'إيقاف مؤقت' } },
  decorators: [withRtl],
};

export const Dark: Story = { globals: { theme: 'dark' } };
