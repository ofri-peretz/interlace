import { ThreadLines } from '@interlace/ui/effects/thread-lines';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ThreadLines> = {
  title: 'Effects/ThreadLines',
  component: ThreadLines,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Interlace’s own backdrop: a loose bundle of threads crossing a section in the two strand colours, with a small glint travelling along each. The bundle is generated from `seed`, so it is identical on the server and in the browser. Under reduced motion the threads stay and nothing travels.',
      },
    },
  },
  argTypes: {
    count: { control: { type: 'number', min: 1, max: 20 }, table: { defaultValue: { summary: '8' } } },
    seed: { control: 'number', table: { defaultValue: { summary: '7' } } },
    opacity: { control: { type: 'range', min: 0.1, max: 1, step: 0.05 }, table: { defaultValue: { summary: '0.35' } } },
    animated: { control: 'boolean', table: { defaultValue: { summary: 'true' } } },
  },
  render: (args) => (
    <div className="bg-background relative grid h-[24rem] place-items-center overflow-hidden">
      <ThreadLines {...args} />
      <h2 className="font-heading relative text-3xl font-bold">One thread, every scale</h2>
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof ThreadLines>;

export const Default: Story = {};
export const Dense: Story = { args: { count: 16, seed: 21 } };
export const Dark: Story = { globals: { theme: 'dark' } };
