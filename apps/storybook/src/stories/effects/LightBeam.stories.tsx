import { LightBeam } from '@interlace/ui/effects/light-beam';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof LightBeam> = {
  title: 'Effects/LightBeam',
  component: LightBeam,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A soft cone of light falling into a dark section from the top edge, to pick out the headline under it. One element, a conic gradient and a radial mask: it renders on the server and does not move.',
      },
    },
  },
  argTypes: {
    origin: { control: 'inline-radio', options: ['top-left', 'top', 'top-right'], table: { defaultValue: { summary: 'top' } } },
    angle: { control: { type: 'range', min: 10, max: 90, step: 2 }, table: { defaultValue: { summary: '36' } } },
    intensity: { control: { type: 'range', min: 0, max: 1, step: 0.05 }, table: { defaultValue: { summary: '0.35' } } },
  },
  render: (args) => (
    <div className="bg-hero-surface-deep text-hero-foreground relative grid h-[26rem] place-items-center overflow-hidden">
      <LightBeam {...args} />
      <h2 className="font-heading relative text-4xl font-bold">In the light</h2>
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof LightBeam>;

export const Default: Story = {};
export const FromTheLeft: Story = { args: { origin: 'top-left', angle: 44 } };
