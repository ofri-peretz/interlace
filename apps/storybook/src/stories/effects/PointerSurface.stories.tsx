import { PointerSurface } from '@interlace/ui/effects/pointer-surface';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type * as React from 'react';

const meta: Meta<typeof PointerSurface> = {
  title: 'Effects/PointerSurface',
  component: PointerSurface,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A surface that answers the pointer: a soft light that follows it, a slight tilt toward it, or both. For a grid of choices a reader is weighing. Only on a fine pointer that can hover and never under reduced motion; keyboard focus inside lights it from the centre. The light is a hidden layer that never takes the pointer.',
      },
    },
  },
  argTypes: {
    effect: {
      control: 'inline-radio',
      options: ['light', 'tilt', 'both'],
      table: { defaultValue: { summary: 'light' } },
    },
    max: { control: { type: 'range', min: 0, max: 12, step: 1 }, table: { defaultValue: { summary: '4' } } },
  },
};

export default meta;
type Story = StoryObj<typeof PointerSurface>;

function Choice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h3 className="text-lg font-semibold">
        <a href="#choice" className="focus-visible:outline-ring rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2">
          {title}
        </a>
      </h3>
      <p className="text-muted-foreground mt-2">{children}</p>
    </>
  );
}

const CARD = 'bg-card text-card-foreground border-border rounded-xl border p-6 shadow-sm';

export const Default: Story = {
  args: { effect: 'light' },
  render: (args) => (
    <PointerSurface {...args} className={`${CARD} max-w-prose`}>
      <Choice title="Evening session">Ninety minutes, for a group of up to twenty. Move the pointer across the card.</Choice>
    </PointerSurface>
  ),
};

/** A row of choices, each lifting toward the pointer. */
export const Grid: Story = {
  render: () => (
    <div className="grid max-w-content gap-4 sm:grid-cols-3">
      {(['light', 'tilt', 'both'] as const).map((effect) => (
        <PointerSurface key={effect} effect={effect} className={CARD}>
          <Choice title={`effect="${effect}"`}>
            {
              {
                light: 'A soft light follows the pointer.',
                tilt: 'The card leans toward the pointer.',
                both: 'Light and lean together.',
              }[effect]
            }
          </Choice>
        </PointerSurface>
      ))}
    </div>
  ),
};
