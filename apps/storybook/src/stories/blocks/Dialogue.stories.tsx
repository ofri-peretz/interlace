import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialogue } from '@interlace/ui/patterns/dialogue';
import { Citation } from '@interlace/ui/patterns/citation';

// Placeholder source: fictional publisher, example.com URL.
const SOURCE = [{ publisher: 'City notice', url: 'https://example.com/notice', quote: 'Closed 3 March, reopened 14 April.' }];

const meta = {
  title: 'Blocks/Dialogue',
  component: Dialogue,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A written conversation: turns with a named speaker, the two sides on opposite edges. ' +
          'For sample exchanges, interview excerpts, or a worked example of a hard conversation. ' +
          'The speaker is always text, so nothing depends on position or colour. ' +
          '`speakers="inside"` sets each name as the first line of its bubble; `tone="inverse"` ' +
          'is the high-contrast bubble; `Dialogue.Suggestions` holds follow-up pills.',
      },
    },
  },
  argTypes: {
    speakers: {
      control: 'inline-radio',
      options: ['above', 'inside'],
      description: 'Where each turn names its speaker.',
      table: { category: 'Appearance', defaultValue: { summary: 'above' } },
    },
    className: {
      control: 'text',
      description: 'Merged onto the `<ol>`.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  render: (args) => (
    <div className="max-w-prose">
      <Dialogue {...args}>
        <Dialogue.Turn speaker="Child">Why was the bridge closed for so long?</Dialogue.Turn>
        <Dialogue.Turn speaker="Parent" side="end">
          It was six weeks. Let&apos;s look at the notice from the city together.
        </Dialogue.Turn>
        <Dialogue.Turn speaker="Child">My friend said it was months.</Dialogue.Turn>
        <Dialogue.Turn speaker="Parent" side="end">
          It felt like months. Here is the date it closed and the date it opened.
        </Dialogue.Turn>
      </Dialogue>
    </div>
  ),
} satisfies Meta<typeof Dialogue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A chat-style transcript: names inside the bubbles, the answer in the inverse tone, a source chip in a bubble, and follow-ups. */
export const Transcript: Story = {
  args: { speakers: 'inside' },
  render: (args) => (
    <div className="max-w-prose space-y-4">
      <Dialogue {...args}>
        <Dialogue.Turn speaker="Your kid">Why was the bridge closed for so long?</Dialogue.Turn>
        <Dialogue.Turn speaker="You" side="end" tone="inverse">
          <Citation marker="chip" sources={SOURCE}>
            Six weeks, from March to April.
          </Citation>{' '}
          It felt longer because the detour was slow.
        </Dialogue.Turn>
        <Dialogue.Turn speaker="Your kid">So who&apos;s right?</Dialogue.Turn>
        <Dialogue.Turn speaker="You" side="end" tone="inverse">
          The dates are on the notice. How it felt is still argued.
        </Dialogue.Turn>
      </Dialogue>
      <Dialogue.Suggestions>
        <Dialogue.Suggestion href="#next">They might ask: &quot;Will it close again?&quot;</Dialogue.Suggestion>
        <Dialogue.Suggestion href="#sources">See all 3 sources</Dialogue.Suggestion>
      </Dialogue.Suggestions>
    </div>
  ),
};
