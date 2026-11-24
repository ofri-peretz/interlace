import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Celebrate, CelebrateCheck, vibrate } from '@interlace/ui/effects/celebrate';
import { Button } from '@interlace/ui/button';

const meta = {
  title: 'Effects/Celebrate',
  component: Celebrate,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A short, one-time moment for something earned: a streak milestone, a perfect round. `Celebrate` wraps the thing that earned it and sends a ring and a burst of rays out from it each time `play` changes, never on first render, so a restored page does not replay it. `CelebrateCheck` is a check that draws itself. `vibrate` adds a matching tap where the browser supports it, and only when asked.\n\n' +
          '**Motion.** 600ms for the burst, 300ms for the check; `transform`, `opacity` and `stroke-dashoffset` only. Under reduced motion the burst does not play and the check is simply drawn. The words that say what happened belong to the component being celebrated.',
      },
    },
  },
  args: { tone: 'primary' },
  argTypes: {
    tone: { control: 'inline-radio', options: ['primary', 'success', 'highlight'] },
    rays: { control: 'number' },
    haptic: { control: 'select', options: [false, 'tap', 'success', 'milestone', 'miss'] },
  },
} satisfies Meta<typeof Celebrate>;

export default meta;
type Story = StoryObj<typeof meta>;

function Demo(args: React.ComponentProps<typeof Celebrate>) {
  const [count, setCount] = React.useState(6);
  return (
    <div className="grid justify-items-start gap-6 p-6">
      <Celebrate {...args} play={count}>
        <span className="bg-muted grid size-20 place-items-center rounded-full text-2xl font-semibold tabular-nums">{count}</span>
      </Celebrate>
      <Button onClick={() => setCount((c) => c + 1)}>Add a day</Button>
    </div>
  );
}

/** Press the button: the count changes and the burst plays once. */
export const Default: Story = {
  render: (args) => <Demo {...args} />,
};

/** A check that draws itself, in three sizes. */
export const Check: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <CelebrateCheck size="sm" />
      <CelebrateCheck label="Done" />
      <CelebrateCheck size="lg" tone="primary" />
    </div>
  ),
};

/** A tap on phones that support it; nothing elsewhere. */
export const Haptics: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['tap', 'success', 'milestone', 'miss'] as const).map((p) => (
        <Button key={p} variant="outline" onClick={() => vibrate(p)}>
          {p}
        </Button>
      ))}
    </div>
  ),
};
