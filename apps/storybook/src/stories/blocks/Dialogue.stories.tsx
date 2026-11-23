import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialogue } from '@interlace/ui/patterns/dialogue';

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
          'The speaker is always text, so nothing depends on position or colour.',
      },
    },
  },
  argTypes: {
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
