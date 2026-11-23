import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThreadSteps } from '@interlace/ui/patterns/thread-steps';
import { expect, within } from 'storybook/test';

const meta = {
  title: 'Blocks/ThreadSteps',
  component: ThreadSteps,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An ordered sequence held together by the woven thread: a knot for each step and two ' +
          'strands crossing to the next. The strands draw in as the reader reaches each step. ' +
          'Give steps a `state` to make it a progress tracker: complete steps are woven, the ' +
          'current knot is ringed, and the thread ahead is a loose dotted strand. Every state is ' +
          'also in words for assistive tech. Under reduced motion the strands are simply drawn.',
      },
    },
  },
  argTypes: {
    className: {
      control: 'text',
      description: 'Merged onto the `<ol>`.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  render: (args) => (
    <div className="max-w-prose">
      <ThreadSteps {...args}>
        <ThreadSteps.Step title="Find where the claim was made">
          The first time it appeared, and who said it.
        </ThreadSteps.Step>
        <ThreadSteps.Step title="Read what the record shows">
          Primary documents first, then the strongest accounts on each side.
        </ThreadSteps.Step>
        <ThreadSteps.Step title="Say what is settled and what is contested">
          Name the positions where serious people disagree.
        </ThreadSteps.Step>
        <ThreadSteps.Step title="Link every sentence to its source" />
      </ThreadSteps>
    </div>
  ),
} satisfies Meta<typeof ThreadSteps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A plain sequence: every strand woven, no state. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(4);
  },
};

/** A progress tracker: the thread is woven up to the current step and loose after it. */
export const Progress: Story = {
  render: (args) => (
    <div className="max-w-prose">
      <ThreadSteps {...args} aria-label="Review progress">
        <ThreadSteps.Step title="Draft written" state="complete">
          Sent for review on Monday.
        </ThreadSteps.Step>
        <ThreadSteps.Step title="Sources checked" state="complete" />
        <ThreadSteps.Step title="Second reviewer" state="current">
          Reading the contested passages now.
        </ThreadSteps.Step>
        <ThreadSteps.Step title="Published" state="upcoming" />
      </ThreadSteps>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const current = canvas.getAllByRole('listitem')[2]!;
    await expect(current).toHaveAttribute('aria-current', 'step');
    await expect(current).toHaveTextContent('(Current step)');
  },
};
