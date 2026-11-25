import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { InterestBoard, InterestSignal } from '@interlace/ui/patterns/interest-signal';
import { withRtl } from '@/decorators';

// Invented topics and counts, so the demo makes no claim about anyone.
const TOPICS = [
  { id: 'budgets', label: 'Planning a budget' },
  { id: 'tools', label: 'Choosing tools' },
  { id: 'hiring', label: 'Hiring the first person' },
  { id: 'pricing', label: 'Setting a price' },
  { id: 'feedback', label: 'Asking for feedback' },
];
const COUNTS = { budgets: 14, tools: 6, hiring: 21, pricing: 9, feedback: 2 };

const meta = {
  title: 'Blocks/InterestSignal',
  component: InterestSignal,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '“I want more on this”: one tap that tells whoever runs the talk, lesson or page what people want more of. It is a toggle (`aria-pressed`) whose name never changes; a status line says “Noted” and how many others asked, from `count`.\n\n' +
          '**The host’s view.** `InterestBoard` ranks topics with `patterns/interest-model` (`rankInterest`): most-asked first, bars drawn against the top topic (a signal is not a vote, so there is no total to divide by), the viewer’s own asks marked.\n\n' +
          '**Small rooms stay private.** `minCount` holds back topics with too few asks and says how many it held.\n\n' +
          '**Motion.** The icon lands with a 200ms scale when pressed, and the board’s bars grow once from the start edge (400ms). Transform only, off under reduced motion.',
      },
    },
  },
  args: { count: 12, topic: 'Hiring the first person', locale: 'en-US', onPressedChange: fn() },
  argTypes: {
    pressed: { control: 'boolean', table: { category: 'State' } },
    defaultPressed: { control: 'boolean', table: { category: 'State' } },
    count: { control: 'number', table: { category: 'Data' } },
    size: { control: 'inline-radio', options: ['sm', 'default'] },
  },
  render: (args) => (
    <div className="grid max-w-prose gap-3">
      <p className="font-heading text-lg font-semibold">Hiring the first person</p>
      <p className="text-muted-foreground">When to hire, what the first role should own, and how to pay for it.</p>
      <InterestSignal {...args} />
    </div>
  ),
} satisfies Meta<typeof InterestSignal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Press it: the icon turns to a check, and the status says how many others asked. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'I want more on this' });
    await userEvent.click(button);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByText('Noted. 12 others asked too.')).toBeTruthy();
    await expect(args.onPressedChange).toHaveBeenCalledWith(true);
  },
};

/** Already pressed, small, on a list of topics. */
export const OnEachTopic: Story = {
  render: (args) => (
    <ul className="grid max-w-prose gap-4">
      {TOPICS.slice(0, 3).map((t, i) => (
        <li key={t.id} className="grid gap-2 border-b pb-4">
          <span className="font-medium">{t.label}</span>
          <InterestSignal {...args} size="sm" topic={t.label} defaultPressed={i === 1} count={COUNTS[t.id as keyof typeof COUNTS]} />
        </li>
      ))}
    </ul>
  ),
};

/** The host's view: topics ranked, small ones held back. */
export const Board: Story = {
  render: () => (
    <div className="max-w-prose">
      <InterestBoard
        title="What the room wants more of"
        topics={TOPICS}
        counts={COUNTS}
        mine={['pricing']}
        minCount={3}
        locale="en-US"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvas.getAllByRole('listitem');
    await expect(rows[0]).toHaveTextContent('Hiring the first person');
    await expect(canvas.getByText('1 more topic shows once 3 people ask.')).toBeTruthy();
  },
};

/** Before anyone asks. */
export const BoardEmpty: Story = {
  render: () => (
    <div className="max-w-prose">
      <InterestBoard title="What the room wants more of" topics={TOPICS} />
    </div>
  ),
};

export const RightToLeft: Story = {
  args: { defaultPressed: true },
  decorators: [withRtl],
  render: (args) => (
    <div className="grid max-w-prose gap-6">
      <InterestSignal {...args} />
      <InterestBoard topics={TOPICS} counts={COUNTS} locale="en-US" />
    </div>
  ),
};
