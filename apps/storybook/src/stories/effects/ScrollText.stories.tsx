import { ScrollText } from '@interlace/ui/effects/scroll-text';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ScrollText> = {
  title: 'Effects/ScrollText',
  component: ScrollText,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One large sentence the reader brings into focus by scrolling: words go from the muted text colour to the full one in reading order, driven by a ViewTimeline. Read once by a screen reader; every word is always at AA contrast. Without ViewTimeline or under reduced motion it is simply in full colour.',
      },
    },
  },
  argTypes: {
    as: { control: 'select', options: ['p', 'h1', 'h2', 'h3', 'blockquote', 'div'] },
    start: { control: { type: 'range', min: 0, max: 100, step: 5 }, table: { defaultValue: { summary: '20' } } },
    end: { control: { type: 'range', min: 0, max: 100, step: 5 }, table: { defaultValue: { summary: '60' } } },
  },
};

export default meta;
type Story = StoryObj<typeof ScrollText>;

const SENTENCE =
  'A good bridge is one nobody notices: it opens on time, carries everyone who needs to cross, and is still standing a hundred years later.';

export const Default: Story = {
  args: { as: 'p', children: SENTENCE },
  render: (args) => (
    <ScrollText {...args} className="max-w-prose text-3xl leading-tight font-semibold tracking-tight text-balance" />
  ),
};

/** Scroll the canvas: the sentence fills as it moves up the screen. */
export const OnScroll: Story = {
  render: () => (
    <div className="flex max-w-prose flex-col gap-[70vh] py-[40vh]">
      <ScrollText as="h2" className="text-4xl leading-tight font-semibold tracking-tight text-balance">
        {SENTENCE}
      </ScrollText>
    </div>
  ),
};
