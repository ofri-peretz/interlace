import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Calendar } from '@interlace/ui/calendar';
import { addDays, weekdayOf } from '@interlace/ui/calendar-model';
import { withRtl } from '@/decorators';

// A fixed "today", so the screenshots never move with the clock.
const TODAY = '2026-11-24';
const weekend = (d: string) => weekdayOf(d) === 0 || weekdayOf(d) === 6;
// Invented availability: every weekday has times except the 26th, which is full.
const FULL = new Set(['2026-11-26']);

const meta = {
  title: 'Primitives/Calendar',
  component: Calendar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One month of days to pick one from: a booking page, a date field’s popup, a “when” step. Days are plain `YYYY-MM-DD` strings (`calendar-model`), so the day a reader picks is the day the server stores, in every time zone.\n\n' +
          '**Keyboard.** The WAI-ARIA date grid: one tab stop, arrows by a day or a week (following the reading direction), Home and End to the week’s edges, Page Up and Page Down by a month, with Shift by a year. Focus never leaves `min`–`max`.\n\n' +
          '**Days.** `isDateUnavailable` strikes a day through and says so; `isDateMarked` puts a dot under a day (say what it means in `labels.marked`). Today is semibold with a short bar and `aria-current="date"`. Pass `today` from the server so the server HTML and the browser agree.\n\n' +
          '**Locale.** Month, weekday and day names come from `Intl` in `locale`, and the week starts where the locale starts it (`weekStartsOn` to override).\n\n' +
          '**Motion.** A new month slides in from the side it came from (200ms), mirrored in RTL, and is simply there under reduced motion. Always six rows, so nothing below moves.',
      },
    },
  },
  args: {
    today: TODAY,
    defaultValue: '2026-11-25',
    min: TODAY,
    max: addDays(TODAY, 90),
    locale: 'en-US',
    isDateUnavailable: (d: string) => weekend(d) || FULL.has(d),
    isDateMarked: (d: string) => !weekend(d),
    labels: { marked: 'Times available' },
  },
  argTypes: {
    value: { control: 'text', table: { category: 'State' } },
    defaultValue: { control: 'text', table: { category: 'State' } },
    min: { control: 'text', table: { category: 'Bounds' } },
    max: { control: 'text', table: { category: 'Bounds' } },
    locale: { control: 'text', table: { category: 'Content' } },
    weekStartsOn: { control: { type: 'number', min: 0, max: 6 }, table: { category: 'Content' } },
  },
  render: (args) => (
    <div className="max-w-prose">
      <Calendar {...args} />
    </div>
  ),
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A booking month: past days and weekends closed, open days marked. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByRole('grid', { name: 'November 2026' });
    await expect(grid).toBeTruthy();
    const picked = canvas.getByRole('button', { name: /Wednesday, November 25, 2026/ });
    await expect(picked.getAttribute('tabindex')).toBe('0');
  },
};

/** Arrow keys move by a day; Page Down moves a month and slides it in. */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /November 25, 2026/ }));
    await userEvent.keyboard('{ArrowRight}');
    await expect(document.activeElement?.getAttribute('data-date')).toBe('2026-11-26');
    await userEvent.keyboard('{PageDown}');
    await expect(canvas.getByRole('grid', { name: 'December 2026' })).toBeTruthy();
    await expect(document.activeElement?.getAttribute('data-date')).toBe('2026-12-26');
    // Let the month slide settle, so the a11y scan reads the days at full opacity.
    await Promise.all(canvasElement.getAnimations({ subtree: true }).map((a) => a.finished));
  },
};

/** No bounds and no marks: a plain date picker. */
export const Plain: Story = {
  args: {
    min: undefined,
    max: undefined,
    isDateUnavailable: undefined,
    isDateMarked: undefined,
    defaultValue: null,
  },
};

/** The week starts on Monday in British English. */
export const WeekStartsMonday: Story = {
  args: { locale: 'en-GB' },
};

/** Arabic (Egypt): Arabic digits, the week from Saturday, arrows mirrored. */
export const RightToLeft: Story = {
  args: { locale: 'ar-EG', labels: { previousMonth: 'الشهر السابق', nextMonth: 'الشهر التالي' } },
  decorators: [withRtl],
};
