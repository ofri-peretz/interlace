import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@interlace/ui/button';
import { EmptyState } from '@interlace/ui/patterns/empty-state';
import { ThreadMark } from '@interlace/ui/thread-mark';
import { expect, within } from 'storybook/test';

const meta: Meta<typeof ThreadMark> = {
  title: 'Primitives/ThreadMark',
  component: ThreadMark,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Interlace's thread, drawn as a state, in place of a spinner, an empty-box icon or a warning triangle. `woven`: done or connected. `drawing`: loading, the woven pair drawing in on a loop. `loose`: empty, one strand trailing off untied. `cut`: error, one strand snapped in two. The mark is always hidden from assistive tech: put it beside words that say the state. Under reduced motion `drawing` rests fully woven.",
      },
    },
  },
  argTypes: {
    state: {
      control: 'inline-radio',
      options: ['woven', 'drawing', 'loose', 'cut'],
      table: { defaultValue: { summary: 'woven' } },
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg'],
      table: { defaultValue: { summary: 'md' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ThreadMark>;

export const Default: Story = { args: { state: 'woven', size: 'lg' } };

/** Every state at every size. */
export const AllStates: Story = {
  render: () => (
    <div className="grid grid-cols-[auto_repeat(3,auto)] items-center gap-x-8 gap-y-6">
      {(['woven', 'drawing', 'loose', 'cut'] as const).map((state) => (
        <div key={state} className="contents">
          <span className="text-muted-foreground font-mono text-sm">{state}</span>
          <ThreadMark state={state} size="sm" />
          <ThreadMark state={state} size="md" />
          <ThreadMark state={state} size="lg" />
        </div>
      ))}
    </div>
  ),
};

/** Loading beside the words that say so. */
export const Loading: Story = {
  render: () => (
    <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
      <ThreadMark state="drawing" size="sm" />
      Checking the sources…
    </p>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent('Checking the sources');
  },
};

/** An empty panel: the loose end goes in `EmptyState`'s icon slot. */
export const InAnEmptyState: Story = {
  render: () => (
    <EmptyState
      icon={<ThreadMark state="loose" size="lg" />}
      title="No sources yet"
      description="Add the first source and the answer starts to take shape."
      actions={<Button>Add a source</Button>}
    />
  ),
};

/** An error panel: the cut thread. */
export const InAnErrorState: Story = {
  render: () => (
    <EmptyState
      role="alert"
      icon={<ThreadMark state="cut" size="lg" />}
      title="Could not load the sources"
      description="The connection dropped before the list arrived."
      actions={<Button variant="outline">Try again</Button>}
    />
  ),
};
