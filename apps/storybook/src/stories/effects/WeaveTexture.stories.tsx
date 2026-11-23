import { WeaveTexture } from '@interlace/ui/effects/weave-texture';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof WeaveTexture> = {
  title: 'Effects/WeaveTexture',
  component: WeaveTexture,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A quiet woven cloth behind a section: warp threads in `--strand-a`, weft in `--strand-b`, in a plain weave. Texture, not glow: nothing moves or shines, and at the default strength it sits just above the page colour, so text on top keeps its contrast. One SVG pattern in real pixels, drawn on the server. Hidden from assistive tech and never takes a click.',
      },
    },
  },
  argTypes: {
    density: {
      control: 'inline-radio',
      options: ['fine', 'default', 'coarse'],
      table: { defaultValue: { summary: 'default' } },
    },
    strength: {
      control: 'inline-radio',
      options: ['faint', 'default', 'strong'],
      table: { defaultValue: { summary: 'default' } },
    },
    fade: {
      control: 'inline-radio',
      options: ['none', 'edges', 'bottom'],
      table: { defaultValue: { summary: 'none' } },
    },
  },
  render: (args) => (
    <section className="relative isolate flex min-h-96 flex-col items-center justify-center gap-3 p-8">
      <WeaveTexture {...args} />
      <h2 className="font-heading max-w-prose text-center text-4xl font-bold">
        Every answer, woven from its sources
      </h2>
      <p className="text-muted-foreground max-w-prose text-center">
        The cloth sits behind the words and never competes with them.
      </p>
    </section>
  ),
};

export default meta;
type Story = StoryObj<typeof WeaveTexture>;

export const Default: Story = {};
export const Fine: Story = { args: { density: 'fine', strength: 'faint' } };
export const Coarse: Story = { args: { density: 'coarse', fade: 'edges' } };
export const FadeToBottom: Story = { args: { fade: 'bottom', strength: 'strong' } };
