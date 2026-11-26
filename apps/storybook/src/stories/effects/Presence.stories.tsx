import { Button } from '@interlace/ui/button';
import { Callout } from '@interlace/ui/callout';
import { Presence, Swap } from '@interlace/ui/effects/presence';
import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { expect, userEvent, within } from 'storybook/test';

const meta: Meta<typeof Presence> = {
  title: 'Effects/Presence',
  component: Presence,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Content that arrives and leaves instead of popping in and out. `Presence` keeps a block on the page while it leaves; `Swap` trades one version of its content for the next when `swapKey` changes, the old one leaving before the new one arrives, never both at once.\n\n' +
          '**Accessible.** Leaving content is `inert` and hidden from assistive technology at once. When the content that leaves held the focus, Swap hands focus to the new content, so nobody is dropped to the top of the page.\n\n' +
          '**Motion.** Only `opacity`, `transform` and `filter` move, so nothing around the block reflows while it plays. Arrival uses `--duration-medium` and `--ease-enter`, leaving the quicker `--duration-base` and `--ease-exit`, read when each plays. `slide` follows the reading direction. Under reduced motion content simply appears and goes.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Presence>;

// Sample content with checkable answers, so the demo makes no claim about the world.
const STEPS = [
  { id: 'one', title: 'Step 1 of 3', body: 'Count the sides of a triangle.' },
  { id: 'two', title: 'Step 2 of 3', body: 'Now count the sides of a square.' },
  { id: 'three', title: 'Step 3 of 3', body: 'Add the two numbers together.' },
];

function Demo() {
  const [show, setShow] = React.useState(true);
  const [step, setStep] = React.useState(0);
  const [direction, setDirection] = React.useState<'forward' | 'back'>('forward');
  const current = STEPS[step]!;
  const go = (by: 1 | -1) => {
    setDirection(by === 1 ? 'forward' : 'back');
    setStep((s) => (s + by + STEPS.length) % STEPS.length);
  };
  return (
    <div className="flex max-w-prose flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <Button variant="outline" onClick={() => setShow((s) => !s)} aria-pressed={show}>
            {show ? 'Hide the hint' : 'Show the hint'}
          </Button>
        </div>
        <Presence show={show} effect="rise">
          <Callout title="Hint">A triangle has one side fewer than a square.</Callout>
        </Presence>
      </section>

      {/* The slide travels past the card's edge: clip it, so a phone-wide card can't scroll the page sideways. */}
      <section className="flex flex-col gap-3 overflow-x-clip [overflow-clip-margin:0.25rem]">
        <Swap
          swapKey={current.id}
          effect="slide"
          direction={direction}
          className="bg-card text-card-foreground border-border rounded-lg border p-6"
        >
          <p className="text-muted-foreground text-sm">{current.title}</p>
          <p className="text-lg font-medium">{current.body}</p>
        </Swap>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => go(-1)}>
            Back
          </Button>
          <Button onClick={() => go(1)}>Next</Button>
        </div>
      </section>
    </div>
  );
}

/** Toggle the hint, and step through the cards: the old one leaves before the next arrives. */
export const Default: Story = {
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Count the sides of a triangle.')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expect(await canvas.findByText('Now count the sides of a square.')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
    await expect(await canvas.findByText('Count the sides of a triangle.')).toBeInTheDocument();
  },
};
