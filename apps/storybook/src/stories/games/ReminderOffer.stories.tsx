import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { ReminderOffer } from '@interlace/ui/games/reminder-offer';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Games/ReminderOffer',
  component: ReminderOffer,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A quiet offer of a daily nudge kept in the player\'s own calendar. It downloads an .ics file with one event repeating daily at the time they pick ' +
          '(`reminder-model`): nothing is sent, no address is asked for, no notification permission is requested. "Not now" shows when `onDismiss` is passed.',
      },
    },
  },
  args: {
    event: 'Sample game: today\'s puzzle',
    eventDescription: 'One puzzle, two minutes.',
    url: 'https://example.com/play',
    uid: 'daily@example.com',
    onAdd: fn(),
    onDismiss: fn(),
  },
  render: (args) => (
    <div className="max-w-prose">
      <ReminderOffer {...args} />
    </div>
  ),
} satisfies Meta<typeof ReminderOffer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The offer, with a time and two plain choices. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Time')).toHaveValue('18:30');
    await expect(canvas.getByRole('button', { name: 'Not now' })).toBeTruthy();
  },
};

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
