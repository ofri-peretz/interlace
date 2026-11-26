import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ReflectionCard } from '@interlace/ui/games/reflection-card';
import { Rating } from '@interlace/ui/games/rating';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Games/ReflectionCard',
  component: ReflectionCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One prompt, a field, and a promise: the answer is private unless the writer chooses to share it with the room, without their name. A shared reflection passes the same checks as other room text; one that cannot be shared is still saved.\n\n' +
          '**Exit ticket.** Put a `Rating` before it, as in the story below.',
      },
    },
  },
  args: {
    prompt: 'What is one thing you will remember from today?',
    meta: '1 of 2',
    shareable: true,
    defaultValue: 'How differently two people can read the same map.',
    onSave: fn(),
  },
} satisfies Meta<typeof ReflectionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A reflection, written and ready to save. */
export const Default: Story = {};

/** Private only: no share option. */
export const Private: Story = { args: { shareable: false, defaultValue: '' } };

/** Share it, past the room's checks. */
export const Sharing: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('checkbox', { name: /Share it with the room/ }));
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(args.onSave).toHaveBeenCalledWith('How differently two people can read the same map.', {
      shared: true,
    });
  },
};

/** An exit ticket: a rating, then a reflection. */
export const ExitTicket: Story = {
  render: (args) => (
    <div className="grid max-w-xl gap-8">
      <Rating question="How useful was today?" min={1} max={5} ends={['Not at all', 'Very']} />
      <ReflectionCard {...args} meta="2 of 2" defaultValue="" />
    </div>
  ),
};

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
