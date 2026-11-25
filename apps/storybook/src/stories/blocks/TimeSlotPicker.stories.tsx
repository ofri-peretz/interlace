import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { TimeSlotPicker } from '@interlace/ui/patterns/time-slot-picker';
import { withRtl } from '@/decorators';

// Invented times for a sample day.
const SLOTS = [
  { value: '09:00' },
  { value: '09:30', disabled: true },
  { value: '10:00', note: '2 places left' },
  { value: '11:30' },
  { value: '13:00' },
  { value: '14:30' },
  { value: '16:00', disabled: true },
  { value: '18:00' },
  { value: '19:30', note: 'Last one today' },
];

const meta = {
  title: 'Blocks/TimeSlotPicker',
  component: TimeSlotPicker,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The times open on one day, as tiles to pick one from, next to a `Calendar`. Built on Base UI’s radio group: one tab stop, arrows between open times, and the picked `value` posted under `name`.\n\n' +
          '**Values.** A slot’s `value` is your store’s key. `HH:MM` is read as a wall-clock time at the venue; an ISO instant is shown in `timeZone`. Anything else needs a `label`.\n\n' +
          '**States.** `loading` shows tile-shaped placeholders; no slots shows `labels.empty`; a `disabled` slot is dashed, struck through and named “Full”.\n\n' +
          '**Layout.** The tiles query the picker’s own width: two columns in a phone column, three from 28rem, four from 42rem. `groupBy="period"` adds morning, afternoon and evening headings.\n\n' +
          '**Motion.** A new day’s times fade up once (200ms); nothing moves under reduced motion.',
      },
    },
  },
  args: {
    label: 'Wednesday, November 25',
    description: 'Times are in Eastern Time',
    slots: SLOTS,
    defaultValue: '10:00',
    locale: 'en-US',
    name: 'time',
  },
  argTypes: {
    groupBy: { control: 'inline-radio', options: ['none', 'period'], table: { category: 'Layout' } },
    loading: { control: 'boolean', table: { category: 'State' } },
    hour12: { control: 'boolean', table: { category: 'Content' } },
    locale: { control: 'text', table: { category: 'Content' } },
  },
  render: (args) => (
    <div className="max-w-prose">
      <TimeSlotPicker {...args} />
    </div>
  ),
} satisfies Meta<typeof TimeSlotPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A day of times, one picked, two full. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('radiogroup', { name: 'Wednesday, November 25' });
    await expect(group).toBeTruthy();
    await userEvent.click(canvas.getByRole('radio', { name: /1:00/ }));
    await expect(canvas.getByRole('radio', { name: /1:00/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
  },
};

/** Headings for morning, afternoon and evening. */
export const ByPartOfDay: Story = {
  args: { groupBy: 'period' },
};

/** A 24-hour clock. */
export const TwentyFourHour: Story = {
  args: { locale: 'en-GB', hour12: false, description: 'Times are in London time' },
};

/** While the day's times load. */
export const Loading: Story = {
  args: { loading: true },
};

/** A day with nothing left. */
export const Empty: Story = {
  args: { slots: [] },
};

export const RightToLeft: Story = {
  args: {
    locale: 'ar-EG',
    label: 'الأربعاء ٢٥ نوفمبر',
    description: 'الأوقات بتوقيت القاهرة',
    labels: { unavailable: 'ممتلئ' },
  },
  decorators: [withRtl],
};
