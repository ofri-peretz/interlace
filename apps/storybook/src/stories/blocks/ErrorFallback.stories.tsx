import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ErrorFallback } from '@interlace/ui/patterns/error-fallback';
import type { ErrorReport } from '@interlace/ui/error-report-model';
import { withRtl } from '@/decorators';

// A fixed report, so the reference line reads the same in every screenshot and nothing reaches the
// default log from a story.
const kept = (): ErrorReport => ({
  id: 'ab12cdef',
  at: 0,
  where: 'route: /example',
  message: 'story',
  fatal: false,
  count: 1,
});

const meta = {
  title: 'Blocks/ErrorFallback',
  component: ErrorFallback,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'What a screen shows when it crashes: plain words, Try again, a way out and a short reference to quote. ' +
          'It reports the error once on mount (to `reportError`, or the `report` you pass), moves focus to its ' +
          'title, and is announced as an alert. It takes the `{ error, reset }` that Next and Remix hand a boundary, ' +
          'or the `{ error, retry }` of Expo Router, and imports no router. It never shows the message or the ' +
          'stack: those are in the log.',
      },
    },
  },
  args: {
    error: new Error('story'),
    where: 'route: /example',
    reset: fn(),
    report: kept,
  },
  argTypes: {
    error: { control: false },
    report: { control: false },
    reset: { control: false },
    retry: { control: false },
    onBack: { control: false },
    reassurance: { control: false },
  },
} satisfies Meta<typeof ErrorFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Tab lands on Try again, and the heading already has focus when the screen appears. */
export const Default: Story = {
  args: { onBack: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByRole('heading', { name: 'Something went wrong here' });
    await expect(document.activeElement).toBe(heading);
    await userEvent.tab();
    const retry = canvas.getByRole('button', { name: 'Try again' });
    await expect(document.activeElement).toBe(retry);
    await userEvent.keyboard('{Enter}');
    await expect(args.reset).toHaveBeenCalledTimes(1);
  },
};

/** A line the app is sure of, rendered as given. */
export const WithReassurance: Story = {
  args: {
    onBack: fn(),
    reassurance: <p className="text-body">Your progress is saved on this device.</p>,
  },
};

/** One button: the screen has nowhere to go back to. */
export const NoBack: Story = {};

/** No `reset` or `retry`: there is no Try again, and the words do not promise one. */
export const NoRetry: Story = {
  args: { reset: undefined, onBack: fn() },
};

/** Neither: only the words and the reference. */
export const NoActions: Story = {
  args: { reset: undefined },
};

/** The app’s own words for every string. */
export const OwnWords: Story = {
  args: {
    onBack: fn(),
    labels: {
      title: 'This page did not load',
      description: 'Reload it, or return to the list.',
      retry: 'Reload',
      back: 'Back to the list',
      referenceLine: (reference) => `Quote this code: ${reference}`,
    },
  },
};

/** A long title wraps; nothing is cut and the buttons stay reachable. */
export const LongTitle: Story = {
  args: {
    onBack: fn(),
    labels: {
      title: 'Something went wrong while this long and rather detailed page was being put together for you',
    },
  },
};

/** At 320 px the buttons stack at full width and nothing scrolls sideways. */
export const Mobile320: Story = {
  args: { onBack: fn() },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

/** Right to left: logical properties only, the button order follows reading order. */
export const Rtl: Story = {
  args: { onBack: fn() },
  decorators: [withRtl],
};
