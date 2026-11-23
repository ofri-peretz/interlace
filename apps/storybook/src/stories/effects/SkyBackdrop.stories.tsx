import { SkyBackdrop } from '@interlace/ui/effects/sky-backdrop';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof SkyBackdrop> = {
  title: 'Effects/SkyBackdrop',
  component: SkyBackdrop,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A calm daytime sky for a friendly hero: a soft gradient, a warm sun glow in one corner and a few drifting clouds. Mixed from theme tokens, so it turns to dusk in the dark scheme. Clouds come from `seed` (same sky on the server and in the browser) and stay still under reduced motion.',
      },
    },
  },
  argTypes: {
    sun: { control: 'inline-radio', options: ['top-left', 'top-right', 'none'], table: { defaultValue: { summary: 'top-right' } } },
    clouds: { control: { type: 'number', min: 0, max: 8 }, table: { defaultValue: { summary: '4' } } },
    seed: { control: 'number', table: { defaultValue: { summary: '3' } } },
    animated: { control: 'boolean', table: { defaultValue: { summary: 'true' } } },
  },
  args: {
    className: 'min-h-[26rem]',
    children: (
      <div className="grid min-h-[26rem] place-items-center p-8 text-center">
        <h2 className="font-heading text-4xl font-bold text-balance">Good questions deserve good answers</h2>
      </div>
    ),
  },
};

export default meta;
type Story = StoryObj<typeof SkyBackdrop>;

export const Default: Story = {};
export const SunLeft: Story = { args: { sun: 'top-left', clouds: 6, seed: 9 } };
export const Dusk: Story = { globals: { theme: 'dark' } };
