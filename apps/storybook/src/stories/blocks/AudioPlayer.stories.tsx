import type { Meta, StoryObj } from '@storybook/react-vite';
import { AudioPlayer } from '@interlace/ui/patterns/audio-player';

// A tenth of a second of silence, inline, so the story needs no network.
const SILENCE = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

const meta = {
  title: 'Blocks/AudioPlayer',
  component: AudioPlayer,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A titled audio clip with its transcript. Playback is the browser\'s own ' +
          '`<audio controls>`, which is keyboard and screen-reader operable everywhere and ' +
          'honours media keys. The transcript sits in a native `<details>` (WCAG 1.2.1).',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'What the clip is. Also the accessible name of the audio element.',
      table: { category: 'Content', type: { summary: 'string' } },
    },
    detail: {
      control: 'text',
      description: 'A short line under the title: length, speaker, date.',
      table: { category: 'Content', type: { summary: 'ReactNode' } },
    },
    transcript: {
      control: false,
      description: 'The words spoken. Strongly recommended.',
      table: { category: 'A11y', type: { summary: 'ReactNode' } },
    },
  },
  args: {
    src: SILENCE,
    title: 'Two minutes on the bridge closure',
    detail: '2 min · read by the editor',
    transcript: (
      <>
        <p>The bridge closed on 20 January for repairs.</p>
        <p>It reopened on 3 March, six weeks later.</p>
      </>
    ),
  },
  render: (args) => (
    <div className="max-w-prose">
      <AudioPlayer {...args} />
    </div>
  ),
} satisfies Meta<typeof AudioPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutTranscript: Story = {
  args: { transcript: undefined },
};
