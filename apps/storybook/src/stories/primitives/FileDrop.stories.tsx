import { FileDrop } from '@interlace/ui/file-drop';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

const meta: Meta<typeof FileDrop> = {
  title: 'Primitives/FileDrop',
  component: FileDrop,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A place to hand over files: press it to pick, or drop files on it, then see what was chosen and take one back out.\n\n' +
          '**Content first.** Underneath is a real file field inside its label, so the picker opens on a press, Enter or Space, a screen reader hears a file field with its name, and the files post with a form under `name`. Dropping is a shortcut to the same field.\n\n' +
          '**Rules.** `accept`, `maxSize` and `maxFiles` are checked again on every pick and drop. A file that breaks one is not added, and the reason is said under the field in a polite live region, in words `messages` can replace. `checkFiles` from the same module applies the same rules on a server.\n\n' +
          '**The list.** Each file shows its name, its size in the reader’s locale and a Remove button named for the file. Removing one moves focus to the next Remove button, or back to the field.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FileDrop>;

// Two small text files, made in the browser, so the list has something to show.
const sample = () => [
  new File(['Agenda for the first meeting.'], 'agenda.txt', {
    type: 'text/plain',
  }),
  new File(['Names, one per line.'], 'guest-list.txt', { type: 'text/plain' }),
];

/** Several files, with two already chosen. */
export const Default: Story = {
  render: () => (
    <FileDrop
      className="max-w-prose"
      label="Drop files here, or choose them"
      hint="Text or PDF, up to 5 MB each, at most 4 files"
      name="attachments"
      multiple
      accept=".txt,.pdf,text/plain,application/pdf"
      maxSize={5_000_000}
      maxFiles={4}
      defaultValue={sample()}
      locale="en"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText(/Drop files here/)).toHaveAttribute('type', 'file');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove agenda.txt' }));
    await expect(canvas.getAllByRole('listitem')).toHaveLength(1);
    await expect(canvas.getByRole('button', { name: 'Remove guest-list.txt' })).toHaveFocus();
  },
};

/** One file at a time: a new pick replaces the last. */
export const Single: Story = {
  render: () => (
    <FileDrop
      className="max-w-prose"
      label="Drop a photo here, or choose one"
      hint="PNG or JPG, up to 2 MB"
      accept="image/*"
      maxSize={2_000_000}
    />
  ),
};

/** Switched off: nothing can be picked or dropped. */
export const Disabled: Story = {
  render: () => <FileDrop className="max-w-prose" label="Uploads are closed" disabled />,
};
