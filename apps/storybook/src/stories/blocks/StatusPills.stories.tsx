import type { Meta, StoryObj } from '@storybook/react-vite';
import { Section } from '@interlace/ui/section';
import { StatusPills } from '@interlace/ui/patterns/status-pills';

const meta = {
  title: 'Blocks/StatusPills',
  component: StatusPills,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Short facts about the page as a row of pills, made to sit on a brand band under a title. ' +
          'A default pill is an outline in the text colour around it, with no fill, so it works on a dark band and on the page. ' +
          '`tone="ok"` is a solid pill with a check for a passed check; the words say what passed.',
      },
    },
  },
  render: (args) => (
    <StatusPills aria-label="About this answer" {...args}>
      <StatusPills.Item tone="ok">Reviewed</StatusPills.Item>
      <StatusPills.Item>9 facts</StatusPills.Item>
      <StatusPills.Item>38 sources</StatusPills.Item>
      <StatusPills.Item>4 min read</StatusPills.Item>
    </StatusPills>
  ),
} satisfies Meta<typeof StatusPills>;

export default meta;
type Story = StoryObj<typeof meta>;

/** On the page background. */
export const Default: Story = {};

/** On a brand band, under the title: the outline follows the band's text colour. */
export const OnABrandBand: Story = {
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <Section as="header" tone="brand" spacing="tight">
      <h1 className="font-heading mb-6 text-4xl font-extrabold tracking-tight">
        &quot;The bridge was closed for months.&quot;
      </h1>
      <StatusPills aria-label="About this answer" {...args}>
        <StatusPills.Item tone="ok">Reviewed</StatusPills.Item>
        <StatusPills.Item>9 facts</StatusPills.Item>
        <StatusPills.Item>38 sources</StatusPills.Item>
        <StatusPills.Item>4 min read</StatusPills.Item>
      </StatusPills>
    </Section>
  ),
};
