import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { JoinCode } from '@interlace/ui/games/join-code';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Games/JoinCode',
  component: JoinCode,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'How people get into a live room: the address, a code to type there, and a QR code that does both in one scan.\n\n' +
          '**A code no one misreads.** `makeJoinCode` (games/room-model) leaves out 0/O, 1/I/L and U/V; the code shows in groups of three and is spelled letter by letter for a screen reader. `normalizeJoinCode` reads what people type back.\n\n' +
          '**Big screen first.** `size="stage"` for the host’s screen; the default fits a phone card with a copy-link button.\n\n' +
          '**Container query.** Side by side from 28rem of its own width, stacked below; the QR leads in either direction.\n\n' +
          '**Expiry and guessing.** `expiresAt` (the room’s `codeExpiresAt`) shows how many minutes the code still works; past it the QR goes and the room refuses new joins (`expired`), while players already in can reconnect. The host moves it with `extend-code`. Where the code is checked, `checkJoinAttempt` / `recordJoinAttempt` cap wrong tries per source and per room.',
      },
    },
  },
  args: {
    code: 'K7Q4MZ',
    href: 'https://example.com/play?code=K7Q4MZ',
    where: 'example.com/play',
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['default', 'stage'] },
    copyable: { control: 'boolean' },
    group: { control: { type: 'number', min: 0, max: 6 } },
  },
  render: (args) => (
    <div className="max-w-prose">
      <JoinCode {...args} />
    </div>
  ),
} satisfies Meta<typeof JoinCode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: 'Room code K 7 Q 4 M Z' })).toBeTruthy();
    await expect(canvas.getByRole('button', { name: 'Copy link' })).toBeTruthy();
  },
};

/** On the host's big screen. */
export const Stage: Story = {
  args: { size: 'stage' },
  render: (args) => <JoinCode {...args} />,
};

/** A numeric PIN, in groups of four. */
export const NumericPin: Story = {
  args: {
    code: '48213907',
    group: 4,
    href: 'https://example.com/play?pin=48213907',
  },
};

/** A code that stops admitting new players: the room's `codeExpiresAt`, counted in minutes. */
export const Expiring: Story = {
  args: { expiresAt: 1_800_000_000_000 + 12 * 60_000, now: () => 1_800_000_000_000 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Works for 12 more minutes')).toBeTruthy();
  },
};

/** Past its expiry: no QR, the code struck through, and a line that says so. */
export const Expired: Story = {
  args: { expiresAt: 1_800_000_000_000, now: () => 1_800_000_000_001 },
};

export const RightToLeft: Story = { decorators: [withRtl] };
