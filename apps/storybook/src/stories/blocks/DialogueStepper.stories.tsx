import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Dialogue } from '@interlace/ui/patterns/dialogue';
import { DialogueChoice, DialogueChoices, DialogueStep, DialogueStepper } from '@interlace/ui/patterns/dialogue-stepper';

const meta = {
  title: 'Blocks/DialogueStepper',
  component: DialogueStepper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A `Dialogue` the reader steps through, one step of turns at a time. Each step ends in ' +
          'choices; a choice reveals the step its `next` names, so a talk can branch. Back, ' +
          '"Show the whole conversation" and "Start over" sit below. The server renders every ' +
          'step, and without JavaScript the reader gets the whole conversation top to bottom. ' +
          'After a choice, focus moves to the new step and its words are read out once.',
      },
    },
  },
  args: { start: 'open', children: null },
  argTypes: {
    speakers: {
      control: 'inline-radio',
      options: ['above', 'inside'],
      table: { category: 'Appearance', defaultValue: { summary: 'above' } },
    },
    defaultMode: {
      control: 'inline-radio',
      options: ['step', 'all'],
      table: { category: 'Behaviour', defaultValue: { summary: 'step' } },
    },
    start: { control: false },
    children: { control: false },
  },
  render: (args) => (
    <div className="max-w-prose">
      <DialogueStepper {...args} start="open">
        <DialogueStep id="open" aria-label="The question">
          <Dialogue.Turn speaker="Neighbour">Why was the bridge closed for so long?</Dialogue.Turn>
          <DialogueChoices>
            <DialogueChoice next="answer">What do I say?</DialogueChoice>
            <DialogueChoice next="months">They might say it was months</DialogueChoice>
          </DialogueChoices>
        </DialogueStep>
        <DialogueStep id="answer" aria-label="The answer">
          <Dialogue.Turn speaker="You" side="end" tone="inverse">
            Six weeks, from March to April. The notice has both dates.
          </Dialogue.Turn>
          <DialogueChoices>
            <DialogueChoice next="why">They might ask why</DialogueChoice>
          </DialogueChoices>
        </DialogueStep>
        <DialogueStep id="months" aria-label="A different memory">
          <Dialogue.Turn speaker="Neighbour">My cousin said it was months.</Dialogue.Turn>
          <Dialogue.Turn speaker="You" side="end" tone="inverse">
            It felt like months, because the detour was slow. The dates say six weeks.
          </Dialogue.Turn>
          <DialogueChoices>
            <DialogueChoice next="why">So why so slow?</DialogueChoice>
          </DialogueChoices>
        </DialogueStep>
        <DialogueStep id="why" aria-label="The reason">
          <Dialogue.Turn speaker="Neighbour">Why did it take six weeks?</Dialogue.Turn>
          <Dialogue.Turn speaker="You" side="end" tone="inverse">
            The bearings under the deck were replaced, and the parts came from abroad.
          </Dialogue.Turn>
        </DialogueStep>
      </DialogueStepper>
    </div>
  ),
} satisfies Meta<typeof DialogueStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Step through: press a choice to reveal the next step. */
export const Default: Story = {};

/** Speaker names inside the bubbles, as on `Dialogue`. */
export const SpeakersInside: Story = { args: { speakers: 'inside' } };

/** Opens with the whole conversation shown; "Step through" switches to step mode. */
export const WholeConversation: Story = { args: { defaultMode: 'all' } };

/**
 * The journey: a branch, the end of the talk, Back, the whole conversation,
 * and Start over.
 */
export const Journey: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('step: take the branch', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'They might say it was months' }));
      await expect(canvas.getByRole('group', { name: 'A different memory' })).toBeTruthy();
      await userEvent.click(canvas.getByRole('button', { name: 'So why so slow?' }));
    });
    await step('end: the last step, then Back', async () => {
      await expect(canvas.getByRole('group', { name: 'The reason' })).toBeTruthy();
      await expect(document.activeElement?.textContent).toBe('Back');
      await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
      await expect(canvas.queryByRole('group', { name: 'The reason' })).toBeNull();
    });
    await step('whole: every step, then back to the path', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Show the whole conversation' }));
      await expect(canvas.getByRole('group', { name: 'The answer' })).toBeTruthy();
      await userEvent.click(canvas.getByRole('button', { name: 'Step through' }));
    });
    await step('start over', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Start over' }));
      await expect(canvas.queryByRole('group', { name: 'A different memory' })).toBeNull();
      await expect(canvas.getByRole('button', { name: 'What do I say?' })).toBeTruthy();
    });
  },
};
