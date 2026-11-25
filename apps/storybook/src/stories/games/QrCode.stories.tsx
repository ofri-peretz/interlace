import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { QrCode } from '@interlace/ui/games/qr-code';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Games/QrCode',
  component: QrCode,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A QR code for a link, drawn as one SVG path by the pure encoder in `games/qr-model` (byte mode, versions 1 to 40, levels L to H, the lowest-penalty mask). No dependency, no canvas, no image request: it renders on the server and stays sharp on a projector.\n\n' +
          '**Readable on a dark page.** `scheme="light"` (the default) keeps dark modules on a light ground through `data-scheme`, drawn with the brand’s own light tokens; `scheme="inherit"` follows the page.\n\n' +
          '**Named.** `label` names the image for assistive tech. Put the same link in words nearby (JoinCode does).',
      },
    },
  },
  args: {
    value: 'https://example.com/play?code=K7Q4MZ',
    label: 'QR code to join the room',
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg', 'fill'] },
    errorCorrection: { control: 'inline-radio', options: ['L', 'M', 'Q', 'H'] },
    scheme: { control: 'inline-radio', options: ['light', 'inherit'] },
    margin: { control: { type: 'number', min: 0, max: 8 } },
  },
} satisfies Meta<typeof QrCode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: 'QR code to join the room' })).toBeTruthy();
  },
};

/** Every size, from a card to a big screen. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-end gap-6">
      <QrCode {...args} size="sm" />
      <QrCode {...args} size="default" />
      <QrCode {...args} size="lg" />
    </div>
  ),
};

/** H survives the most damage, at the cost of a denser code. */
export const ErrorCorrection: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-end gap-6">
      {(['L', 'M', 'Q', 'H'] as const).map((level) => (
        <figure key={level} className="flex flex-col items-center gap-2">
          <QrCode {...args} errorCorrection={level} size="sm" label={`QR code, level ${level}`} />
          <figcaption className="text-muted-foreground text-sm">{level}</figcaption>
        </figure>
      ))}
    </div>
  ),
};

export const RightToLeft: Story = { decorators: [withRtl] };
