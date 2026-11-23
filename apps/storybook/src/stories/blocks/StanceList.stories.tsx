import type { Meta, StoryObj } from '@storybook/react-vite';
import { StanceList } from '@interlace/ui/patterns/stance-list';

// Placeholder positions on a made-up local question, so the story takes no
// side on anything real.
const meta = {
  title: 'Blocks/StanceList',
  component: StanceList,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Who holds which position on a question. Each item names a holder, labels the position ' +
          'with a toned badge, and states it in a sentence. The label is text; the tone only ' +
          'reinforces it, and the page chooses it, so the list itself takes no side.',
      },
    },
  },
  argTypes: {
    className: {
      control: 'text',
      description: 'Merged onto the `<ul>`.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  render: (args) => (
    <div className="max-w-prose">
      <StanceList {...args}>
        <StanceList.Item holder="Residents' association" stance="Supports" tone="success">
          A second bridge would cut the morning queue in half.
        </StanceList.Item>
        <StanceList.Item holder="River trust" stance="Opposes" tone="warning">
          Construction would disturb the nesting season for two years.
        </StanceList.Item>
        <StanceList.Item holder="City council" stance="Undecided" tone="neutral">
          A cost study is due in the spring.
        </StanceList.Item>
        <StanceList.Item holder="Transport researchers" stance="Mixed" tone="info">
          Useful only if bus lanes come with it.
        </StanceList.Item>
      </StanceList>
    </div>
  ),
} satisfies Meta<typeof StanceList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
