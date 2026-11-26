import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { HandQueue, RaiseHand, ReactionBar, ReactionStream } from '@interlace/ui/games/reactions';
import {
  allowReaction,
  applyHandEvent,
  createHands,
  placeInLine,
  type HandEvent,
  type ReactionBudget,
} from '@interlace/ui/games/reactions-model';
import { withRtl } from '@/decorators';

// Invented reactions, so the demo makes no claim about anyone.
const SEEDED = [
  ...Array(12).fill('love'),
  ...Array(7).fill('agree'),
  ...Array(4).fill('funny'),
  ...Array(9).fill('new'),
  ...Array(2).fill('confused'),
].map((kind, i) => ({ id: `s${i}`, kind }));

const meta = {
  title: 'Games/Reactions',
  component: ReactionStream,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The room’s pulse while someone talks. Phones tap a reaction with `ReactionBar`; the shared screen lets each one float up with `ReactionStream`. Someone who wants to speak uses `RaiseHand`, and the host calls on people in order with `HandQueue`.\n\n' +
          '**Budgets.** `games/reactions-model` gives each person `perWindow` reactions per `windowMs` (6 in 3 seconds by default) with `allowReaction`, so a crowd cannot flood the screen. Hands are first raised, first called (`applyHandEvent`, `placeInLine`).\n\n' +
          '**Motion.** Each allowed reaction rises with a slight drift and fades (1.6s, Web Animations), at most `maxFloating` at once. Floats are hidden from assistive tech; the tally says the same. Under reduced motion nothing floats.',
      },
    },
  },
  args: { reactions: SEEDED, locale: 'en-US' },
  render: (args) => (
    <div className="max-w-prose">
      <ReactionStream {...args} />
    </div>
  ),
} satisfies Meta<typeof ReactionStream>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The tally a shared screen keeps under the floats. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Love it:').parentElement?.textContent).toBe('Love it: 12');
  },
};

function LiveDemo() {
  const [reactions, setReactions] = React.useState<{ id: string; kind: string }[]>([]);
  const [budget, setBudget] = React.useState<ReactionBudget>({});
  const [refused, setRefused] = React.useState(0);
  const n = React.useRef(0);
  return (
    <div className="grid max-w-prose gap-6">
      <ReactionStream reactions={reactions} className="bg-muted/40 h-64 rounded-lg p-4" locale="en-US" />
      <ReactionBar
        onReact={(kind) => {
          const r = allowReaction(budget, 'me', Date.now());
          setBudget(r.budget);
          if (!r.ok) {
            setRefused((x) => x + 1);
            return;
          }
          n.current += 1;
          setReactions((prev) => [...prev, { id: `r${n.current}`, kind }]);
        }}
      />
      <p className="text-muted-foreground text-center text-sm" aria-live="polite">
        {refused > 0 ? `${refused} taps over the budget did not float.` : 'Tap fast: six in three seconds get through.'}
      </p>
    </div>
  );
}

/** Tap the bar and watch the screen. */
export const Live: Story = { render: () => <LiveDemo /> };

function HandsDemo() {
  const [hands, setHands] = React.useState(() =>
    (
      [
        { type: 'raise', by: 'a', name: 'Alex', at: 1 },
        { type: 'raise', by: 'b', name: 'Sam', at: 2 },
      ] satisfies HandEvent[]
    ).reduce(applyHandEvent, createHands()),
  );
  const raised = placeInLine(hands, 'me') !== null;
  return (
    <div className="grid max-w-content gap-10 @container">
      <div className="grid gap-10 @2xl:grid-cols-2">
        <RaiseHand
          raised={raised}
          place={placeInLine(hands, 'me')}
          speaking={hands.speaking?.by === 'me'}
          onChange={(up) =>
            setHands((s) =>
              applyHandEvent(
                s,
                up ? { type: 'raise', by: 'me', name: 'You', at: Date.now() } : { type: 'lower', by: 'me' },
              ),
            )
          }
        />
        <HandQueue
          hands={hands.hands}
          speaking={hands.speaking}
          onCall={(by) => setHands((s) => applyHandEvent(s, { type: 'call', by }))}
          onLower={(by) => setHands((s) => applyHandEvent(s, { type: 'lower', by }))}
          onDone={() => setHands((s) => applyHandEvent(s, { type: 'done' }))}
        />
      </div>
    </div>
  );
}

/** A phone and the host side by side: raise your hand, then call people in order. */
export const RaisedHands: Story = {
  render: () => <HandsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Raise your hand' }));
    await expect(canvas.getByText('You are number 3 in line.')).toBeTruthy();
    // Alex and Sam raised first: two calls later, you are next.
    await userEvent.click(canvas.getByRole('button', { name: 'Call next' }));
    await expect(canvas.getByText('You are number 2 in line.')).toBeTruthy();
    await userEvent.click(canvas.getByRole('button', { name: 'Call next' }));
    await expect(canvas.getByText('You are next.')).toBeTruthy();
  },
};

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
