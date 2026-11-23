import { GradientMesh } from '@interlace/ui/effects/gradient-mesh';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof GradientMesh> = {
  title: 'Effects/GradientMesh',
  component: GradientMesh,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A soft, slowly shifting field of theme colour for a hero or feature band. Large blurred glows drift on long loops (Web Animations API, so nothing to add to your stylesheet) and pause out of view. Colours default to `--primary`, `--chart-2`, `--highlight` and `--chart-4`, so the mesh follows the brand and the scheme. Content goes in `children`.',
      },
    },
  },
  argTypes: {
    intensity: { control: { type: 'range', min: 0, max: 1, step: 0.05 }, table: { defaultValue: { summary: '0.55' } } },
    spread: { control: { type: 'range', min: 0.2, max: 1, step: 0.05 }, table: { defaultValue: { summary: '0.6' } } },
    animated: { control: 'boolean', table: { defaultValue: { summary: 'true' } } },
    colors: { control: 'object' },
  },
  args: {
    className: 'min-h-[28rem]',
    children: (
      <div className="grid min-h-[28rem] place-items-center p-8 text-center">
        <h2 className="font-heading text-4xl font-bold text-balance">Every thread, one weave</h2>
      </div>
    ),
  },
};

export default meta;
type Story = StoryObj<typeof GradientMesh>;

export const Default: Story = {};
export const Subtle: Story = { args: { intensity: 0.3 } };
export const Dark: Story = { globals: { theme: 'dark' } };
