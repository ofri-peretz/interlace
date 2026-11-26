import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ShareCard } from '@interlace/ui/games/share-card';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Games/ShareCard',
  component: ShareCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'How the player did, ready to share without spoiling it: one mark per round (a band, never the answer), the score and the streak.\n\n' +
          '**Share, then copy.** Share opens the device’s share sheet where there is one; Copy always works, and falls back to a selected field when the clipboard is refused.\n\n' +
          '**Marks in words.** The emoji row is hidden from assistive tech; a sentence ("Round 1: close. Round 2: not far.") says the same.\n\n' +
          '**Same text on the server.** `shareText` in `games/share-model` builds the exact string, so a link preview can match it.',
      },
    },
  },
  args: {
    title: 'Sample game',
    number: 42,
    results: ['close', 'near', 'exact'],
    score: 240,
    maxScore: 300,
    streak: 6,
    url: 'https://example.com/play',
    locale: 'en-US',
  },
  render: (args) => (
    <div className="max-w-prose">
      <ShareCard {...args} />
    </div>
  ),
} satisfies Meta<typeof ShareCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Round 1: close/)).toBeTruthy();
  },
};

/** A right-or-wrong game, with its own symbols. */
export const RightOrWrong: Story = {
  args: { results: ['right', 'right', 'wrong', 'right', 'wrong'], score: 3, maxScore: 5, streak: undefined },
};

/** A milestone to share: no rounds, one line of news, nothing spoiled. */
export const Milestone: Story = {
  args: { results: [], score: undefined, maxScore: undefined, note: 'A 30-day streak', streak: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('A 30-day streak')).toBeTruthy();
  },
};

export const RightToLeft: Story = {
  decorators: [withRtl],
  args: {
    title: 'لعبة تجريبية',
    locale: 'ar',
    numberLabel: (n: number) => `رقم ${n}`,
    labels: { copy: 'انسخ النتيجة', share: 'شارك', score: (s: string, m?: string) => `${s} من ${m}`, streak: (n: string) => `${n} أيام` },
  },
};
