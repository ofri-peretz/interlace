import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CommitmentCheckIn, CommitmentPicker } from '@interlace/ui/patterns/commitment';
import { withRtl } from '@/decorators';

// Invented options, and a fixed date so the screenshots never move with the clock.
const OPTIONS = [
  { id: 'calendar', label: 'Block one hour on my calendar for it' },
  { id: 'ask', label: 'Ask one colleague how they do it' },
  { id: 'try', label: 'Try it once on something small' },
];
const MADE_AT = Date.UTC(2026, 10, 24, 18);

const meta = {
  title: 'Blocks/Commitment',
  component: CommitmentPicker,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The end of a session, and a week later. `CommitmentPicker` asks each person to pick one thing to do this week, in one tap or in their own words (`allowOwn`), and says when they will be asked about it. `CommitmentCheckIn` is that question on the follow-up link: did you? Yes, partly, or not yet.\n\n' +
          '**The rules.** `patterns/commitment-model` says when the question is due (`followUpAt`, `followUpState`: waiting, due, answered, lapsed) and what a room’s answers add up to (`commitmentImpact`: response rate, follow-through, the most-picked choices).\n\n' +
          '**Restore.** `value` / `defaultValue` with `madeAt` open on the summary; `answer` / `defaultAnswer` open on the thanks. Focus moves to whatever replaced the buttons.\n\n' +
          '**Motion.** The check lands with a 200ms scale on a commitment made here. Transform only, off under reduced motion.',
      },
    },
  },
  args: {
    prompt: 'Pick one thing to try this week',
    options: OPTIONS,
    allowOwn: true,
    locale: 'en-US',
    onValueChange: fn(),
  },
  argTypes: {
    allowOwn: { control: 'boolean' },
    allowChange: { control: 'boolean' },
    followUpDays: { control: 'number' },
  },
  render: (args) => (
    <div className="max-w-prose">
      <CommitmentPicker {...args} />
    </div>
  ),
} satisfies Meta<typeof CommitmentPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick one option and the summary replaces the list. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name: 'Pick one thing to try this week' })).toBeTruthy();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

/** Committed: what they picked and when they will be asked. */
export const Committed: Story = {
  args: { defaultValue: { id: 'ask', text: 'Ask one colleague how they do it' }, madeAt: MADE_AT },
};

/** In their own words. */
export const OwnWords: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Something else' }));
    await userEvent.type(canvas.getByLabelText('What will you do?'), 'Write it down for the team');
    await userEvent.click(canvas.getByRole('button', { name: 'Commit to it' }));
    await expect(args.onValueChange).toHaveBeenCalledWith({ id: null, text: 'Write it down for the team' });
  },
};

/** A week later, on the follow-up link. */
export const CheckIn: Story = {
  render: () => (
    <div className="max-w-prose">
      <CommitmentCheckIn commitment="Ask one colleague how they do it" footer="The next session is in two weeks." />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Partly' }));
    await expect(canvas.getByText('A start counts. Thank you for telling us.')).toBeTruthy();
  },
};

export const RightToLeft: Story = {
  decorators: [withRtl],
  render: (args) => (
    <div className="grid max-w-prose gap-8">
      <CommitmentPicker {...args} defaultValue={{ id: 'try', text: 'Try it once on something small' }} madeAt={MADE_AT} />
      <CommitmentCheckIn commitment="Try it once on something small" defaultAnswer="done" />
    </div>
  ),
};
