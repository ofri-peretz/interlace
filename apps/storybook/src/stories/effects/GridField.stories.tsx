import { GridField } from '@interlace/ui/effects/grid-field';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof GridField> = {
  title: 'Effects/GridField',
  component: GridField,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Graph-paper lines behind a section, with a few cells that slowly light up and fade. The lines are one SVG pattern; the lit cells come from a seed, so server and browser agree. `fade` dissolves the field toward the edges. With `interactive`, the cell under the pointer lights up too (the listener sits on the parent). Hidden from assistive tech and never takes a click; under reduced motion the cells hold a soft, even glow.',
      },
    },
  },
  argTypes: {
    mark: { control: 'inline-radio', options: ['lines', 'dots'], table: { defaultValue: { summary: 'lines' } } },
    cells: { control: 'object' },
    cell: { control: { type: 'number', min: 16, step: 4 }, table: { defaultValue: { summary: '40' } } },
    lit: { control: { type: 'number', min: 0, step: 1 }, table: { defaultValue: { summary: '14' } } },
    seed: { control: 'number', table: { defaultValue: { summary: '5' } } },
    intensity: { control: { type: 'range', min: 0, max: 1, step: 0.02 }, table: { defaultValue: { summary: '0.18' } } },
    fade: { control: 'inline-radio', options: ['none', 'radial', 'top', 'bottom'], table: { defaultValue: { summary: 'radial' } } },
    animated: { control: 'boolean', table: { defaultValue: { summary: 'true' } } },
    interactive: { control: 'boolean', table: { defaultValue: { summary: 'false' } } },
  },
  render: (args) => (
    <section className="relative isolate flex min-h-96 items-center justify-center p-8">
      <GridField {...args} />
      <h2 className="font-heading max-w-prose text-center text-4xl font-bold">Careful, measured answers</h2>
    </section>
  ),
};

export default meta;
type Story = StoryObj<typeof GridField>;

export const Default: Story = {};
export const FadeToBottom: Story = { args: { fade: 'bottom' } };
export const Still: Story = { args: { animated: false } };
export const FollowsThePointer: Story = { args: { interactive: true, lit: 6 } };
export const Dots: Story = { args: { mark: 'dots', cell: 24, lit: 20 } };
export const ChosenCells: Story = { args: { lit: 0, cells: [[3, 2], [4, 2], [4, 3], [8, 5]] } };
