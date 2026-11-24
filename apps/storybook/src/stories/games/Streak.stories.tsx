import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Streak } from '@interlace/ui/games/streak';
import { withRtl } from '@/decorators';

// A fixed "today" so every story and its checks render the same days.
// 2026-11-24 is a Tuesday; 2026-11-21 a Saturday.
const TODAY = '2026-11-24';
const PLAYED = ['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-22', '2026-11-23'];

const meta = {
  title: 'Games/Streak',
  component: Streak,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A player’s run of days: the count, a sentence on where today stands, and a strip of recent days.\n\n' +
          '**Rest days.** `rest` names weekdays and dates that never break a run. A rest day the player skips is passed over; one they play counts. A habit that punishes a day off teaches people to quit.\n\n' +
          '**Today is open.** Not having played yet today never ends a run. `data-status` is `played`, `pending`, `resting` or `none`, and the sentence follows it.\n\n' +
          '**Never colour alone.** Played is a filled mark with a check, rest a dashed ring with a moon, missed an empty ring, today an open ring with a dot, and every day is read out with its date and state.\n\n' +
          '**Server first.** No state or hooks. The arithmetic is exported from `games/streak-model` (`summarizeStreak`, `streakDays`, `isRestDay`), so a server can store and check the same numbers.\n\n' +
          '**Motion.** Today’s check scales in once when it appears; nothing else moves, and nothing at all under reduced motion.',
      },
    },
  },
  args: { played: PLAYED, today: TODAY, rest: { weekdays: [6] }, locale: 'en-US' },
  argTypes: {
    played: { control: 'object', description: 'Every day played, as `YYYY-MM-DD` keys.', table: { category: 'Data' } },
    today: { control: 'text', description: 'Today in the player’s time zone. Pass it when the page renders on a server.', table: { category: 'Data' } },
    rest: { control: 'object', description: '`{ weekdays?: number[]; dates?: string[] }`: days that never break a run (0 is Sunday).', table: { category: 'Data' } },
    length: { control: { type: 'number', min: 3, max: 14 }, table: { category: 'Layout', defaultValue: { summary: '7' } } },
    after: { control: { type: 'number', min: 0, max: 6 }, description: 'Days after today, shown as still to come.', table: { category: 'Layout', defaultValue: { summary: '0' } } },
    variant: { control: 'inline-radio', options: ['full', 'compact'], table: { category: 'Appearance', defaultValue: { summary: 'full' } } },
    showBest: { control: 'boolean', table: { category: 'Content', defaultValue: { summary: 'true' } } },
    locale: { control: 'text', table: { category: 'Content' } },
  },
} satisfies Meta<typeof Streak>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A run alive since last Tuesday, with Saturday as a rest day, and today still to play. */
export const Pending: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Play today to keep your streak.')).toBeTruthy();
    const days = canvas.getByRole('list', { name: 'Recent days' });
    await expect(within(days).getAllByRole('listitem')).toHaveLength(7);
  },
};

/** Today played: the check scales in once. */
export const PlayedToday: Story = {
  args: { played: [...PLAYED, TODAY], after: 3 },
};

/** Today is the rest day: the run is safe without a game. */
export const RestingToday: Story = {
  args: { today: '2026-11-21', played: ['2026-11-18', '2026-11-19', '2026-11-20'] },
};

/** A missed working day ended the run; the best one stays on record. */
export const Broken: Story = {
  args: { played: ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'] },
};

/** No games yet. */
export const Empty: Story = {
  args: { played: [] },
};

/** A two-week strip with a holiday as a rest date. */
export const TwoWeeks: Story = {
  args: { length: 14, rest: { weekdays: [6], dates: ['2026-11-12'] } },
};

/** One chip for a header or toolbar; the full sentence is there for assistive tech. */
export const Compact: Story = {
  args: { variant: 'compact' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).toContain('day streak. Play today to keep your streak.');
  },
};

/** Words from `labels`, day names from `locale`, the strip mirrored. */
export const RightToLeft: Story = {
  decorators: [withRtl],
  args: {
    locale: 'ar',
    labels: {
      unit: 'أيام متتالية',
      status: { pending: 'العب اليوم لتحافظ على سلسلتك.' },
      best: (n: number) => `الأفضل: ${n}`,
      days: 'الأيام الأخيرة',
    },
  },
};

/** The 288px column a 320px phone leaves; at larger text sizes the strip wraps instead of scrolling sideways. */
export const Narrow: Story = {
  args: { length: 7, after: 3 },
  render: (args) => (
    <div className="w-72">
      <Streak {...args} />
    </div>
  ),
};
