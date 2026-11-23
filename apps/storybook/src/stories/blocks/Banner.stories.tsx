import type { Meta, StoryObj } from '@storybook/react-vite';
import { InfoIcon } from 'lucide-react';
import { Banner } from '@interlace/ui/patterns/banner';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Blocks/Banner',
  component: Banner,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A thin, full-width bar above the site header for a message about the whole site: "This site is still being written", a planned outage, a release. One line, an optional link or action, and an optional close button. The tone colours the bar; the words carry the meaning.',
      },
    },
  },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['muted', 'info', 'success', 'warning', 'highlight'],
      table: { category: 'Appearance', defaultValue: { summary: 'muted' } },
    },
    dismissible: { control: 'boolean', table: { category: 'Behaviour', defaultValue: { summary: 'false' } } },
    label: { control: 'text', table: { category: 'A11y', defaultValue: { summary: 'Announcement' } } },
  },
  args: {
    tone: 'muted',
    children: 'This site is still being written. Some answers are drafts.',
  },
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLinkAndDismiss: Story = {
  args: {
    tone: 'info',
    icon: <InfoIcon />,
    action: <a href="#how">How we check facts</a>,
    dismissible: true,
  },
};

export const Warning: Story = { args: { tone: 'warning', children: 'Planned maintenance on Sunday from 02:00 to 03:00.' } };
export const Highlight: Story = { args: { tone: 'highlight', children: 'New: answers now show every source.' } };
export const Dark: Story = { ...WithLinkAndDismiss, globals: { theme: 'dark' } };
export const RTL: Story = { ...WithLinkAndDismiss, decorators: [withRtl] };
