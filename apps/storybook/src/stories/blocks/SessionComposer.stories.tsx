import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SessionComposer } from '@interlace/ui/patterns/session-composer';
import { Button } from '@interlace/ui/button';
import { withRtl } from '@/decorators';

// An invented catalogue, so the demo describes no real programme.
const MODULES = [
  { id: 'welcome', title: 'Welcome and goals', minutes: 10 },
  { id: 'basics', title: 'The basics, hands on', minutes: 30, summary: 'Everyone tries it on their own phone first.' },
  { id: 'cases', title: 'Three real cases', minutes: 25, summary: 'What happened, why, and what it changed.' },
  { id: 'practice', title: 'Practice in pairs', minutes: 20 },
  { id: 'deep', title: 'A deeper look', minutes: 40, summary: 'For a group that has done the basics before.' },
  { id: 'close', title: 'Questions and next steps', minutes: 10 },
];

const meta = {
  title: 'Blocks/SessionComposer',
  component: SessionComposer,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Build a session out of modules: pick what goes in, put it in order, and see how long it runs against the time you have. Modules a group had before are marked (`seen`), and `required` ones (an opening, a close) stay in place.\n\n' +
          '**The rules.** `patterns/session-plan-model` decides what fits, where an added module goes (after the host’s last pick, before a required close), how a move clamps, and what a submitted plan sums to, so a server can check it the same way.\n\n' +
          '**Keyboard.** Every module has named Add / Remove, move up, move down controls; focus stays on the module you moved, and each change is announced with the new total.\n\n' +
          '**Motion.** An added module grows in by scale (240ms). Off under reduced motion.',
      },
    },
  },
  args: {
    modules: MODULES,
    required: ['welcome', 'close'],
    seen: ['basics'],
    maxMinutes: 90,
    defaultValue: ['welcome', 'cases', 'close'],
    locale: 'en-US',
    onValueChange: fn(),
    footer: <Button>Request this session</Button>,
  },
  argTypes: {
    maxMinutes: { control: 'number' },
    headingAs: { control: 'inline-radio', options: ['h2', 'h3', 'h4'] },
  },
  render: (args) => (
    <div className="max-w-content">
      <SessionComposer {...args} />
    </div>
  ),
} satisfies Meta<typeof SessionComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A plan in progress: 45 of 90 minutes, one module seen before. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('45 min of 90 min')).toBeTruthy();
  },
};

/** Add a module, then move it up. */
export const AddAndReorder: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const practice = canvas.getByText('Practice in pairs').closest('li')!;
    await userEvent.click(within(practice as HTMLElement).getByRole('button', { name: 'Add' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Move Practice in pairs up' }));
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['welcome', 'practice', 'cases', 'close']);
  },
};

/** Too long: the meter turns and says by how much. */
export const RunsOver: Story = {
  args: { value: ['welcome', 'basics', 'cases', 'deep', 'close'] },
};

/** No time limit: just the total. */
export const NoLimit: Story = {
  args: { maxMinutes: null, required: [], seen: [], defaultValue: [] },
};

export const RightToLeft: Story = {
  decorators: [withRtl],
};
