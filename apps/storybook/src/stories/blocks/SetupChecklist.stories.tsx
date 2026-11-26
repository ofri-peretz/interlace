import { Button } from '@interlace/ui/button';
import { SetupChecklist, SetupTask } from '@interlace/ui/patterns/setup-checklist';
import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { expect, userEvent, within } from 'storybook/test';

const meta: Meta<typeof SetupChecklist> = {
  title: 'Blocks/SetupChecklist',
  component: SetupChecklist,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The few things a new member does to get going, in a card that shows how far they are and what to do next.\n\n' +
          '**One thing at a time.** Tasks can be done in any order. The first one not done is put forward with its description and action, and is announced as the current step; `expand="all"` opens every undone task.\n\n' +
          '**Accessible.** The progress bar is read as “2 of 5 done”, and the same words sit beside it in a polite live region, so finishing a task is heard. A done task says Done in words, not only with its tick.\n\n' +
          '**Finished.** Once every task is done the card says so (`completeTitle`, `completeDescription`) and offers `onDismiss`. `reward` shows what a task earns, such as “+20 XP”.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SetupChecklist>;

const TASKS = [
  {
    id: 'photo',
    title: 'Add a profile photo',
    description: 'So the people you play with know it’s you.',
    reward: '+10 XP',
  },
  { id: 'topics', title: 'Pick three topics', description: 'We’ll suggest what to read first.', reward: '+20 XP' },
  { id: 'game', title: 'Play your first game', description: 'Five questions, about two minutes.', reward: '+30 XP' },
  { id: 'friend', title: 'Invite a friend', description: 'Games are better with someone to beat.', reward: '+20 XP' },
];

const Demo = ({ initial }: { initial: string[] }) => {
  const [done, setDone] = React.useState(initial);
  const [open, setOpen] = React.useState(true);
  if (!open) return <p className="text-muted-foreground text-sm">The checklist is put away.</p>;
  return (
    <SetupChecklist
      className="max-w-112"
      title="Get started"
      description="A few things to make it yours."
      completeTitle="You’re all set"
      completeDescription="Everything is ready. Enjoy."
      onDismiss={() => setOpen(false)}
    >
      {TASKS.map((task) => (
        <SetupTask
          key={task.id}
          title={task.title}
          description={task.description}
          reward={task.reward}
          done={done.includes(task.id)}
          action={
            <Button size="sm" onClick={() => setDone((d) => [...d, task.id])}>
              Do it
            </Button>
          }
        />
      ))}
    </SetupChecklist>
  );
};

/** One task done; the next is put forward. Press Do it to finish it. */
export const Default: Story = {
  render: () => <Demo initial={['photo']} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1 of 4 done');
    const items = canvas.getAllByRole('listitem');
    await expect(items[1]).toHaveAttribute('aria-current', 'step');
    await expect(items[0]).toHaveTextContent('Done');
  },
};

/** Finishing the last task turns the card into its finished state. */
export const Finishing: Story = {
  render: () => <Demo initial={['photo', 'topics', 'game']} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole('button', { name: 'Do it' })[0]!);
    await expect(canvas.getByRole('heading', { name: 'You’re all set' })).toBeInTheDocument();
    await expect(canvas.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '4 of 4 done');
    await expect(canvas.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  },
};
