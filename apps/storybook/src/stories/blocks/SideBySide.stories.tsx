import type { Meta, StoryObj } from '@storybook/react-vite';
import { SideBySide } from '@interlace/ui/patterns/side-by-side';

const meta = {
  title: 'Blocks/SideBySide',
  component: SideBySide,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Two or three accounts of the same thing, next to each other: what is said and what the ' +
          'record shows, before and after, one source and another. Columns stack below `md`, in ' +
          'source order. Each column is a region named by its heading.',
      },
    },
  },
  argTypes: {
    className: {
      control: 'text',
      description: 'Merged onto the grid.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  render: (args) => (
    <SideBySide {...args}>
      <SideBySide.Column title="What you hear" tone="warning">
        <p>&ldquo;The bridge has been closed for months.&rdquo;</p>
      </SideBySide.Column>
      <SideBySide.Column title="What the record shows" tone="success">
        <p>It closed on 20 January and reopened on 3 March, six weeks later.</p>
      </SideBySide.Column>
    </SideBySide>
  ),
} satisfies Meta<typeof SideBySide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ThreeColumns: Story = {
  render: () => (
    <SideBySide>
      <SideBySide.Column title="January">Closed for repairs.</SideBySide.Column>
      <SideBySide.Column title="February" tone="info">
        One lane open at night.
      </SideBySide.Column>
      <SideBySide.Column title="March" tone="success">
        All lanes open.
      </SideBySide.Column>
    </SideBySide>
  ),
};
