import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { AnimatedList } from '@interlace/ui/magicui/animated-list';

/**
 * AnimatedList stories
 *
 * `children` is a required `ReactNode` — a feed of pre-composed entries,
 * not something a Storybook control can usefully drive — so every story
 * supplies the same set of notification cards via `render` rather than
 * `args.children`. The cards use only token colors (`bg-background`,
 * `text-foreground`, `text-muted-foreground`, `border-border`) so the
 * story is the a11y contract, not just a demo.
 */

const notifications = [
  { id: 1, title: 'New sign-up', detail: 'ofri@interlace.tools joined the workspace.' },
  { id: 2, title: 'Payment received', detail: '$49.00 — Pro plan renewal.' },
  { id: 3, title: 'Deploy succeeded', detail: 'main to production in 42s.' },
  { id: 4, title: 'New comment', detail: '"Looks great, ship it." on PR #218.' },
];

const meta: Meta<typeof AnimatedList> = {
  title: 'MagicUI/AnimatedList',
  component: AnimatedList,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A feed that reveals its children one at a time, newest on top, with a spring pop-in — an activity stream or notification tray. Motion is layered like the `Marquee` primitive: `prefers-reduced-motion` renders the full list instantly with no auto-advance; `pauseOnHover` lets pointer users hold the reveal; and a visible play/pause button (WCAG 2.2.2 — content auto-updating past 5s needs an explicit pause) is always keyboard-reachable unless `showPauseControl` is turned off because an enclosing surface already owns pausing.',
      },
    },
  },
  argTypes: {
    delay: {
      control: 'select',
      options: [400, 800, 1000, 2000],
      description: 'Milliseconds between each entry being revealed.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '1000' }, category: 'Motion' },
    },
    loop: {
      control: 'boolean',
      description:
        'Restart the reveal from the first entry once the last has appeared. When false, the list settles on the full set and stops.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'Motion' },
    },
    pauseOnHover: {
      control: 'boolean',
      description:
        'Pause the reveal while the pointer is over the list. Pairs with, and does not replace, the keyboard-reachable pause control.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    showPauseControl: {
      control: 'boolean',
      description:
        'Render the visible play/pause button. Turn off only when an enclosing surface exposes its own pause control — some pause affordance must exist for reveals longer than 5s.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'State' },
    },
    pauseLabel: {
      control: 'text',
      description: 'Accessible label for the pause control. Customize per context, e.g. "Pause activity feed".',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'Pause animated feed' },
        category: 'Accessibility',
      },
    },
    className: {
      control: 'text',
      description: 'Merged onto the scrolling root — the seam for width and gap overrides.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AnimatedList>;

const renderFeed = (args: ComponentProps<typeof AnimatedList>) => (
  <div className="rounded-lg border border-border bg-background p-4">
    <AnimatedList {...args} className="w-full max-w-[24rem]">
      {notifications.map((n) => (
        <div key={n.id} className="w-full rounded-lg border border-border bg-background p-3 shadow-sm">
          <p className="text-sm font-medium text-foreground">{n.title}</p>
          <p className="text-xs text-muted-foreground">{n.detail}</p>
        </div>
      ))}
    </AnimatedList>
  </div>
);

/**
 * Wait until the reveal has finished before anything measures this story.
 *
 * The entries animate OPACITY, and axe samples whatever is on screen when it
 * runs. A card caught at 60% opacity reports its COMPOSITED colour — the
 * settled `text-foreground` came back as `#636260` on white (6.09:1) and the
 * detail line as `#8c8781` (3.56:1), both failures against colours no reader
 * ever sees at rest. Shortening `delay` did not fix it: `delay` is the gap
 * BETWEEN entries, and the spring on the last one is still running.
 *
 * So the story waits for the real end state instead. Everything the reader
 * eventually sees is then what gets scanned, and a genuine contrast
 * regression still fails — which suppressing the rule would not have caught.
 */
const revealFinished = async (canvasElement: HTMLElement) => {
  await waitFor(
    () => {
      const cards = canvasElement.querySelectorAll('p');
      expect(cards).toHaveLength(notifications.length * 2);
      const mid = [...canvasElement.querySelectorAll<HTMLElement>('*')].filter(
        (el) => Number(getComputedStyle(el).opacity) < 1,
      );
      expect(mid).toHaveLength(0);
    },
    { timeout: 8000 },
  );
};

export const Default: Story = {
  args: {
    delay: 150,
    loop: false,
    pauseOnHover: false,
    showPauseControl: true,
  },
  render: renderFeed,
  play: async ({ canvasElement }) => revealFinished(canvasElement),
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

/*
 * There is deliberately NO `loop: true` story.
 *
 * A looping reveal re-fades every entry forever, so it has no end state — the
 * `play` above could never resolve, and the theme-matrix colour sweep cannot
 * be waived (waiving colour is the one thing that sweep exists to prevent).
 * The story would fail on a timer rather than on a defect. `loop` is still
 * discoverable and demonstrable: it is a boolean control on every story here,
 * documented in `argTypes` above.
 */

export const PauseOnHover: Story = {
  ...Default,
  name: 'Pause on hover, no button',
  args: { ...Default.args, pauseOnHover: true, showPauseControl: false },
};

export const FastReveal: Story = {
  ...Default,
  name: 'Fast reveal (delay=400)',
  args: { ...Default.args, delay: 400 },
};
