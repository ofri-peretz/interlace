import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '@interlace/ui/button';
import {
  GettingStarted,
  GettingStartedCelebration,
  GettingStartedHeader,
  GettingStartedStep,
} from '@interlace/ui/games/getting-started';
import {
  celebrationsFor,
  complete,
  emptySnapshot,
  markCelebrated,
  skip,
  type ChecklistDef,
  type ChecklistSnapshot,
} from '@interlace/ui/games/getting-started-model';
import { memoryStore, type ChecklistStore } from '@interlace/ui/games/getting-started-store';
import { withRtl } from '@/decorators';

// A neutral list of seven steps in three groups. Nothing here claims anything about a product: the
// steps are data the app passes, and these are the words of a person preparing a meeting.
const DEF: ChecklistDef = {
  groups: [
    { id: 'plan', title: 'Plan' },
    { id: 'prepare', title: 'Prepare' },
    { id: 'day', title: 'Day of' },
  ],
  steps: [
    { id: 'date', title: 'Pick a date', description: 'Choose a day people can come.', group: 'plan' },
    { id: 'agenda', title: 'Write the agenda', group: 'plan', after: ['date'] },
    { id: 'invite', title: 'Invite people', group: 'prepare', after: ['date'] },
    { id: 'slides', title: 'Add slides', description: 'Only if you want them.', optional: true, group: 'prepare' },
    { id: 'test', title: 'Test the room', group: 'prepare', after: ['agenda'] },
    { id: 'rehearse', title: 'Rehearse once', group: 'day', after: ['test', 'slides'] },
    { id: 'run', title: 'Run the day', group: 'day', weight: 2, after: ['rehearse', 'invite'] },
  ],
};

// A fixed moment, so the pace and the streak read the same in every screenshot.
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 24, 12);
const now = () => NOW;

/** The steps done, in order, on consecutive minutes of the fixed day. */
function progress(ids: string[], at = NOW - 2 * DAY): ChecklistSnapshot {
  let s = emptySnapshot();
  // "Rehearse once" waits for the optional slides, so a list that got that far has skipped them.
  if (ids.includes('rehearse')) s = skip(DEF, s, 'slides', at - 1);
  ids.forEach((id, i) => (s = complete(DEF, s, id, at + i * 60_000, 'UTC')));
  return markCelebrated(s, celebrationsFor(DEF, emptySnapshot(), s));
}

const meta = {
  title: 'Games/GettingStarted',
  component: GettingStarted,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A short list of things a person should do before an app is useful to them, with progress, a next step and a small, honest reward. The steps are data (`ChecklistDef`); nothing here knows what they are about.\n\n' +
          '**Honest.** Progress counts required steps only; a skipped optional step unlocks what waited for it; a missed day is never framed as a loss.\n\n' +
          '**Keyboard and screen reader.** A locked step is `aria-disabled` and focusable, and says what it waits for. Changes are said once, politely, and never on load.\n\n' +
          '**Motion.** The tick settles in once and `celebrate="full"` adds a 1.2s burst. Under reduced motion nothing moves and the finish is still a line of text.\n\n' +
          '**Persistence.** Pass a `store` (`load`, `save`, optional `subscribe`); a failed save keeps the progress on the page and says so once.',
      },
    },
  },
  args: { 'data-testid': 'gs', definition: DEF, now, timeZone: 'UTC' },
  render: (args) => (
    <div className="max-w-144">
      <GettingStarted {...args} />
    </div>
  ),
} satisfies Meta<typeof GettingStarted>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Half way through, a date four days out: the next step open, a pace line, a day streak. */
export const Default: Story = {
  args: {
    defaultValue: progress(['date', 'agenda', 'invite']),
    dueAt: NOW + 4 * DAY,
    streak: {},
    defaultOpen: 'next',
  },
  render: (args) => (
    <div className="max-w-144">
      <GettingStarted {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('3 of 6 steps done');
    await expect(c.getByText(/steps? left, 4 days to go/)).toBeTruthy();
  },
};

/** Nothing done yet: one step next, the rest locked and saying what they wait for. */
export const Empty: Story = {};

/** Every required step done. The finish is a line of words. */
export const Complete: Story = {
  args: { defaultValue: progress(['date', 'agenda', 'invite', 'test', 'rehearse', 'run']) },
};

/** Locked steps explain themselves. */
export const LockedSteps: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getAllByText(/Finish .* first/).length).toBeGreaterThan(1);
  },
};

/** An optional step can be skipped, and then it no longer holds back what waits for it. */
export const OptionalSteps: Story = {
  args: { defaultValue: progress(['date', 'agenda', 'test']) },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(c.getByRole('button', { name: 'Do this step' })).toBeTruthy());
  },
};

/** The same list, a day left and four steps to go. */
export const BehindPace: Story = { args: { defaultValue: progress(['date']), dueAt: NOW + DAY } };

/** The date has passed. Said plainly, with no loss framing. */
export const Overdue: Story = { args: { defaultValue: progress(['date', 'agenda']), dueAt: NOW - DAY } };

/** A rest day: the days in a row are safe. */
export const StreakRestDay: Story = {
  args: {
    defaultValue: { ...progress(['date']), activeDays: ['2026-11-21', '2026-11-22', '2026-11-23'] },
    streak: { rest: { weekdays: [2] } }, // the fixed day is a Tuesday
  },
};

/** The list holds its place while saved progress loads. */
export const Loading: Story = {
  args: { store: { load: () => new Promise<ChecklistSnapshot | null>(() => undefined), save: fn() } satisfies ChecklistStore },
};

/** A store that fails to save: the progress stays on the page and says so, once. */
export const SaveFailing: Story = {
  args: { store: { load: () => null, save: () => Promise.reject(new Error('offline')) } satisfies ChecklistStore },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click((await c.findAllByRole('checkbox'))[0] as HTMLElement);
    await waitFor(() => expect(c.getByText('Not saved yet. Your progress is kept on this page.')).toBeTruthy(), { timeout: 3000 });
  },
};

/** The step's action is the app's own button; the list renders no link of its own. */
export const WithActions: Story = {
  render: (args) => (
    <div className="max-w-144">
      <GettingStarted {...args}>
        <GettingStartedHeader />
        <ol className="grid gap-2">
          <GettingStartedStep id="date" action={<Button size="sm">Open the calendar</Button>} />
          <GettingStartedStep id="agenda" action={<Button size="sm">Open the editor</Button>} />
        </ol>
        <GettingStartedCelebration />
      </GettingStarted>
    </div>
  ),
};

/** Hidden once finished, with focus moved on. */
export const Dismissible: Story = {
  args: { defaultValue: progress(['date', 'agenda', 'invite', 'test', 'rehearse', 'run']), dismissible: true },
  render: (args) => (
    <div className="max-w-144">
      <GettingStarted {...args} />
      <a href="#after" className="mt-4 inline-block underline">
        Back to the page
      </a>
    </div>
  ),
};

/** The finish with the short burst; under reduced motion only the line shows. */
export const CompleteFull: Story = {
  args: { defaultValue: progress(['date', 'agenda', 'invite', 'test', 'rehearse']), celebrate: 'full' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('checkbox', { name: /Run the day/ }));
    await waitFor(() => expect(c.getByText('All set. You are ready.')).toBeTruthy());
  },
};

/** Two instances on one store behave like two tabs: a step done in one appears in the other, silently. */
export const TwoTabs: Story = {
  render: (args) => {
    const store = React.useMemo(() => memoryStore(null), []);
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <GettingStarted {...args} store={store} data-testid="tab-a" />
        <GettingStarted {...args} store={store} data-testid="tab-b" />
      </div>
    );
  },
};

/** The narrowest width the component declares. */
export const Mobile320: Story = {
  args: { defaultValue: progress(['date', 'agenda']), dueAt: NOW + 4 * DAY },
  render: (args) => (
    <div style={{ width: 320 }}>
      <GettingStarted {...args} />
    </div>
  ),
};

/** Right to left: the check, the title and the chevron mirror. */
export const Rtl: Story = {
  decorators: [withRtl],
  args: { defaultValue: progress(['date', 'agenda']) },
};

/**
 * The whole flow, by keyboard where it matters: a locked step says what it waits for and moves
 * nothing, the steps are done in order, the optional one is skipped, and the list finishes.
 */
export const Journey: Story = {
  args: { celebrate: 'quiet' },
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    const box = (name: RegExp) => c.getByRole('checkbox', { name });
    await step('loading to active: the first step is next, the rest wait', async () => {
      await expect(c.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('0 of 6 steps done');
      await expect(box(/Write the agenda/).getAttribute('aria-disabled')).toBe('true');
    });
    await step('locked: pressing it says what it waits for and moves nothing', async () => {
      box(/Write the agenda/).focus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(canvasElement.querySelector('[data-slot="getting-started-announce"]')?.textContent).toMatch(/Pick a date first/));
      await expect(box(/Write the agenda/).getAttribute('aria-checked')).toBe('false');
    });
    await step('active: the steps in order, with the space bar', async () => {
      for (const name of [/Pick a date/, /Write the agenda/, /Invite people/, /Test the room/]) {
        box(name).focus();
        await userEvent.keyboard(' ');
        await waitFor(() => expect(box(name).getAttribute('aria-checked')).toBe('true'));
      }
    });
    await step('optional: skip it, and what waited for it opens', async () => {
      await userEvent.click(c.getByRole('button', { name: 'Skip' }));
      await waitFor(() => expect(box(/Rehearse once/).hasAttribute('aria-disabled')).toBe(false));
    });
    await step('complete: the last required steps, then the finish in words', async () => {
      for (const name of [/Rehearse once/, /Run the day/]) {
        await userEvent.click(box(name));
        await waitFor(() => expect(box(name).getAttribute('aria-checked')).toBe('true'));
      }
      await waitFor(() => expect(c.getByText('All set. You are ready.')).toBeTruthy());
      await expect(canvasElement.querySelector('[data-slot="getting-started"]')?.getAttribute('data-state')).toBe('complete');
    });
  },
};
