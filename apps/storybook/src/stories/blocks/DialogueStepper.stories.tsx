import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialogue } from '@interlace/ui/patterns/dialogue';
import { DialogueStepper } from '@interlace/ui/patterns/dialogue-stepper';

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
        <DialogueStepper.Step id="open" aria-label="The question">
          <Dialogue.Turn speaker="Neighbour">Why was the bridge closed for so long?</Dialogue.Turn>
          <DialogueStepper.Choices>
            <DialogueStepper.Choice next="answer">What do I say?</DialogueStepper.Choice>
            <DialogueStepper.Choice next="months">They might say it was months</DialogueStepper.Choice>
          </DialogueStepper.Choices>
        </DialogueStepper.Step>
        <DialogueStepper.Step id="answer" aria-label="The answer">
          <Dialogue.Turn speaker="You" side="end" tone="inverse">
            Six weeks, from March to April. The notice has both dates.
          </Dialogue.Turn>
          <DialogueStepper.Choices>
            <DialogueStepper.Choice next="why">They might ask why</DialogueStepper.Choice>
          </DialogueStepper.Choices>
        </DialogueStepper.Step>
        <DialogueStepper.Step id="months" aria-label="A different memory">
          <Dialogue.Turn speaker="Neighbour">My cousin said it was months.</Dialogue.Turn>
          <Dialogue.Turn speaker="You" side="end" tone="inverse">
            It felt like months, because the detour was slow. The dates say six weeks.
          </Dialogue.Turn>
          <DialogueStepper.Choices>
            <DialogueStepper.Choice next="why">So why so slow?</DialogueStepper.Choice>
          </DialogueStepper.Choices>
        </DialogueStepper.Step>
        <DialogueStepper.Step id="why" aria-label="The reason">
          <Dialogue.Turn speaker="Neighbour">Why did it take six weeks?</Dialogue.Turn>
          <Dialogue.Turn speaker="You" side="end" tone="inverse">
            The bearings under the deck were replaced, and the parts came from abroad.
          </Dialogue.Turn>
        </DialogueStepper.Step>
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
