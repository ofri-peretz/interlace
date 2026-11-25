import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Recap } from '@interlace/ui/patterns/recap';
import { withRtl } from '@/decorators';

// An invented session, so the recap describes nobody.
const meta = {
  title: 'Blocks/Recap',
  component: Recap,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'What one person takes home from a session: what it covered, how they did, the one thing they picked for this week, what they asked to hear more about, and where to go next. Every section is optional and shows only when it has something in it.\n\n' +
          '**A recap in the link.** `patterns/recap-model` puts the per-person part in the address (`encodeRecap` / `decodeRecap`: versioned base64url JSON, checked field by field, refused past 1,500 characters), so the page needs no account and stores nothing. It is not signed: use it for the person’s own view, never for anything a prize depends on.\n\n' +
          '**Motion.** None. A recap is read later, often on a phone.',
      },
    },
  },
  args: {
    title: 'Your recap',
    meta: 'Tuesday, November 24 · 60 minutes · 38 people in the room',
    covered: [
      'Why an average can describe nobody',
      'Reading one request from start to finish',
      'What to do in the first five minutes of an outage',
    ],
    stats: [
      { label: 'Points', value: '4,200' },
      { label: 'Place', value: '6th of 38' },
      { label: 'Answers right', value: '7 of 9' },
      { label: 'Questions asked', value: '2' },
    ],
    commitment: 'Ask one colleague how they do it',
    interests: ['Reading a trace', 'Setting a target'],
    next: [
      { label: 'The next session', href: '#next', description: 'Two weeks from today, same time.' },
      { label: 'The slides and sources', href: '#slides' },
    ],
    footer: 'This page is yours only: it is built from your link, and nothing about you is stored.',
    titleAs: 'h2',
  },
  render: (args) => (
    <div className="max-w-prose">
      <Recap {...args} />
    </div>
  ),
} satisfies Meta<typeof Recap>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every section filled. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Your one thing this week' })).toBeTruthy();
  },
};

/** Only what this person has: no score, no picks. */
export const Minimal: Story = {
  args: { stats: undefined, commitment: undefined, interests: undefined },
};

export const RightToLeft: Story = {
  decorators: [withRtl],
};
