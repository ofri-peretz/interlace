import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { WordCloud, WordEntry } from '@interlace/ui/games/word-cloud';
import { Button } from '@interlace/ui/button';
import { withRtl } from '@/decorators';

// Invented answers to a neutral prompt, so the demo makes no claim about anyone.
const ENTRIES = [
  ...Array(9).fill('Coffee'),
  ...Array(7).fill('Friends'),
  ...Array(5).fill('sleep'),
  ...Array(4).fill('Hiking'),
  ...Array(3).fill('Music'),
  ...Array(3).fill('Books'),
  ...Array(2).fill('Cooking'),
  ...Array(2).fill('Beach'),
  'Markets',
  'Cycling',
  'Family dinner',
  'Board games',
  'Gardening',
  'Museums',
].map((text, i) => ({ text, by: `p${i}` }));

const MORE = ['Friends', 'Coffee', 'Sunsets', 'Music', 'Friends', 'Hiking', 'Picnics', 'Friends', 'Friends'];

const meta = {
  title: 'Games/WordCloud',
  component: WordCloud,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The room’s words, live. Phones send a word with `WordEntry`; the shared screen shows a `WordCloud` in which repeated words grow, the biggest sit in the middle, and every change glides into place.\n\n' +
          '**Grouping.** `games/word-cloud-model` folds case, accents and marks, so “Coffee” and “coffee” are one word shown in the spelling most people used. Sizes follow a square-root scale, so one runaway word does not shrink the rest.\n\n' +
          '**Safety.** `games/text-safety-model` refuses links, email addresses, phone numbers and the consumer’s `blocklist` (matched whole, after folding letter swaps and spelled-out letters) before a word leaves the phone. Interlace ships no word list. Run the same check on the server.\n\n' +
          '**Reading order.** The DOM is in rank order, each word read with its count; only the visual order is centre-out.\n\n' +
          '**Motion.** Words glide to new places (FlipGroup, 400ms), a word that gained a vote pulses once (250ms, transform only). Under reduced motion they simply take their place.',
      },
    },
  },
  args: { entries: ENTRIES, viewer: 'p21', locale: 'en-US' },
  argTypes: {
    size: { control: 'inline-radio', options: ['default', 'stage'], table: { category: 'Look' } },
    max: { control: 'number', table: { category: 'Data' } },
    viewer: { control: 'text', table: { category: 'Data' } },
    locale: { control: 'text', table: { category: 'Content' } },
  },
  render: (args) => (
    <div className="max-w-prose">
      <WordCloud {...args} />
    </div>
  ),
} satisfies Meta<typeof WordCloud>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A cloud a room built: the most-sent word in the accent, the viewer's own underlined. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Coffee, 9')).toBeTruthy();
    await expect(canvas.getByText(/41 words from the room/)).toBeTruthy();
  },
};

/** Before anyone has sent a word. */
export const Empty: Story = { args: { entries: [] } };

function LiveDemo() {
  const [entries, setEntries] = React.useState(ENTRIES.slice(0, 12));
  const next = entries.length - 12;
  return (
    <div className="grid max-w-content gap-6">
      <WordCloud entries={entries} size="stage" locale="en-US" />
      <Button
        variant="outline"
        className="justify-self-center"
        disabled={next >= MORE.length}
        onClick={() => setEntries((e) => [...e, { text: MORE[next] ?? '', by: `n${next}` }])}
      >
        Add the next word
      </Button>
    </div>
  );
}

/** On a shared screen: add words one at a time and watch them glide and grow. */
export const LiveStage: Story = { render: () => <LiveDemo /> };

function EntryDemo() {
  const [sent, setSent] = React.useState<string[]>([]);
  return (
    <div className="grid max-w-prose gap-8">
      <WordEntry sent={sent} onWord={(w) => setSent((s) => [...s, w])} blocklist={['badword']} placeholder="One word" />
      <WordCloud entries={sent.map((text) => ({ text, by: 'me' }))} viewer="me" locale="en-US" />
    </div>
  );
}

/** The phone: up to three words, each checked before it is sent. Try a link, or "b a d w o r d". */
export const Entry: Story = {
  render: () => <EntryDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText('Your word');
    await userEvent.type(field, 'www.example.com{Enter}');
    await expect(canvas.getByText('Links cannot be sent here.')).toBeTruthy();
    await userEvent.clear(field);
    await userEvent.type(field, 'Coffee{Enter}');
    await expect(canvas.getByText('You can send 2 more.')).toBeTruthy();
  },
};

/** Right to left. */
export const RightToLeft: Story = {
  decorators: [withRtl],
  args: { entries: ['שלום', 'שלום', 'קפה', 'ים', 'ים', 'ים', 'חברים', 'مرحبا', 'مرحبا'], locale: 'he-IL' },
};
