import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  MultiStepForm,
  MultiStepFormStep,
  MultiStepFormSummary,
} from '@interlace/ui/patterns/multi-step-form';
import { TimeSlotPicker } from '@interlace/ui/patterns/time-slot-picker';
import { Calendar } from '@interlace/ui/calendar';
import { addDays, toUtcDate, weekdayOf } from '@interlace/ui/calendar-model';
import { Field, FieldControl, FieldError, FieldLabel } from '@interlace/ui/form';
import { Input } from '@interlace/ui/input';
import { Textarea } from '@interlace/ui/textarea';
import { withRtl } from '@/decorators';

// A fixed "today" and invented availability, so the demo claims nothing
// and the screenshots never move with the clock.
const TODAY = '2026-11-24';
const weekend = (d: string) => weekdayOf(d) === 0 || weekdayOf(d) === 6;
const TIMES = ['09:00', '10:30', '13:00', '14:30', '16:00', '18:30'];
const slotsFor = (date: string | null) =>
  date
    ? TIMES.map((value, i) => ({
        value,
        disabled: (Number(date.slice(-2)) + i) % 4 === 0,
      }))
    : [];

const dayName = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' }).format(toUtcDate(date))
    : '';

function BookingFlow({
  onSubmit,
  defaultStep,
  defaultDate = '2026-11-25',
  defaultTime = '13:00',
}: {
  onSubmit?: (data: FormData) => void;
  defaultStep?: string;
  defaultDate?: string | null;
  defaultTime?: string | null;
}) {
  const [date, setDate] = React.useState<string | null>(defaultDate);
  const [time, setTime] = React.useState<string | null>(defaultTime);
  const [who, setWho] = React.useState({ name: 'Sam Rivera', email: 'sam@example.com', group: '12' });
  return (
    <MultiStepForm
      defaultStep={defaultStep}
      labels={{ submit: 'Book the session' }}
      onSubmit={(data) => onSubmit?.(data)}
    >
      <MultiStepFormStep
        id="when"
        title="Pick a day and time"
        description="Sessions are 90 minutes. Times are in Eastern Time."
        validate={() => (!date || !time ? 'Pick a day and a time to go on.' : null)}
      >
        <div className="grid gap-6 @2xl:grid-cols-2">
          <Calendar
            today={TODAY}
            min={TODAY}
            max={addDays(TODAY, 60)}
            locale="en-US"
            value={date}
            onValueChange={(d) => {
              setDate(d);
              setTime(null);
            }}
            isDateUnavailable={weekend}
            isDateMarked={(d) => !weekend(d)}
            labels={{ marked: 'Times available' }}
          />
          <TimeSlotPicker
            key={date ?? 'none'}
            label={date ? dayName(date) : 'Pick a day first'}
            slots={slotsFor(date)}
            value={time}
            onValueChange={setTime}
            name="time"
            locale="en-US"
            labels={{ empty: 'Pick a day to see its times.' }}
          />
        </div>
        <input type="hidden" name="date" value={date ?? ''} />
      </MultiStepFormStep>
      <MultiStepFormStep id="who" title="Your details" description="We send the confirmation here.">
        <div className="grid gap-4 @md:grid-cols-2">
          <Field name="name">
            <FieldLabel>Name</FieldLabel>
            <FieldControl
              render={
                <Input
                  required
                  autoComplete="name"
                  value={who.name}
                  onChange={(e) => setWho({ ...who, name: e.target.value })}
                />
              }
            />
            <FieldError />
          </Field>
          <Field name="email">
            <FieldLabel>Email</FieldLabel>
            <FieldControl
              render={
                <Input
                  required
                  type="email"
                  autoComplete="email"
                  value={who.email}
                  onChange={(e) => setWho({ ...who, email: e.target.value })}
                />
              }
            />
            <FieldError />
          </Field>
          <Field name="group">
            <FieldLabel>How many people</FieldLabel>
            <FieldControl
              render={
                <Input
                  type="number"
                  min={1}
                  max={40}
                  inputMode="numeric"
                  value={who.group}
                  onChange={(e) => setWho({ ...who, group: e.target.value })}
                />
              }
            />
            <FieldError />
          </Field>
          <Field name="notes" className="@md:col-span-2">
            <FieldLabel>Anything we should know (optional)</FieldLabel>
            <FieldControl render={<Textarea rows={3} />} />
          </Field>
        </div>
      </MultiStepFormStep>
      <MultiStepFormStep id="check" title="Check and book" description="Nothing is booked until you confirm.">
        <MultiStepFormSummary
          items={[
            { label: 'Day', value: dayName(date), step: 'when' },
            { label: 'Time', value: time, step: 'when' },
            { label: 'Name', value: who.name, step: 'who' },
            { label: 'Email', value: who.email, step: 'who' },
            { label: 'Group size', value: who.group, step: 'who' },
          ]}
        />
      </MultiStepFormStep>
    </MultiStepForm>
  );
}

const meta = {
  title: 'Blocks/MultiStepForm',
  component: MultiStepForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One form, a few steps, a last look before it is sent. Every step is part of one `<form>`, kept in the page and hidden while it is not current, so answers survive going back and the submit posts every field as `FormData`.\n\n' +
          '**Checks.** Continue runs the native constraints of the step’s fields (`required`, `type="email"` …), then the step’s `validate`; the first problem takes focus and a message is read out. Back never checks. Done steps are buttons in the progress list; steps ahead cannot be skipped to.\n\n' +
          '**Summary.** `MultiStepFormSummary` lists the answers, each with a Change button that goes straight to the step that asked.\n\n' +
          '**Focus.** On every step change focus moves to the new heading, which says “Step 2 of 3” to a screen reader.\n\n' +
          '**Layout.** The progress queries the form’s width: one line and a segmented bar in a phone column, every step named from 32rem.\n\n' +
          '**Motion.** The new step slides in from its side (200ms), mirrored in RTL; the progress fills on `--duration-medium`. Nothing moves under reduced motion.\n\n' +
          'The stories compose a booking flow from `Calendar`, `TimeSlotPicker` and `Field`; nothing is sent anywhere.',
      },
    },
  },
  args: { children: null },
  render: () => (
    <div className="max-w-content">
      <BookingFlow />
    </div>
  ),
} satisfies Meta<typeof MultiStepForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A booking flow on its first step: a day and a time. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: /Step 1 of 3, Pick a day and time/ })).toBeTruthy();
    await expect(canvas.getByRole('grid', { name: 'November 2026' })).toBeTruthy();
  },
};

/** Continue to the details, then to the summary, and back with Change. */
export const WalkThrough: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    await expect(document.activeElement?.textContent).toMatch(/Your details/);
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    await expect(canvas.getByRole('heading', { name: /Step 3 of 3/ })).toBeTruthy();
    await userEvent.click(canvas.getByRole('button', { name: 'Change: Email' }));
    await expect(document.activeElement?.textContent).toMatch(/Your details/);
    // Let the step slide settle, so the a11y scan reads the text at full opacity.
    await Promise.all(canvasElement.getAnimations({ subtree: true }).map((a) => a.finished));
  },
};

/** The summary step, ready to book. */
export const Summary: Story = {
  render: () => (
    <div className="max-w-content">
      <BookingFlow defaultStep="check" onSubmit={fn()} />
    </div>
  ),
};

/** Continue with no time picked: the step says why and stays. */
export const NeedsAnAnswer: Story = {
  render: () => (
    <div className="max-w-content">
      <BookingFlow defaultTime={null} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    await expect(canvas.getByRole('alert').textContent).toBe('Pick a day and a time to go on.');
  },
};

/** In a phone-width column the progress is one line and a bar. */
export const NarrowColumn: Story = {
  render: () => (
    <div className="max-w-80">
      <BookingFlow defaultStep="who" />
    </div>
  ),
};

export const RightToLeft: Story = {
  decorators: [withRtl],
};
