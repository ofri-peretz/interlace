import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd, KbdGroup } from '@interlace/ui/kbd';
import { expect, within } from 'storybook/test';

const meta: Meta<typeof Kbd> = {
  title: 'Primitives/Kbd',
  component: Kbd,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A key the reader presses. `KbdGroup` sets a chord or a sequence as one inline run. Give a symbol key an `aria-label` (`⌘` → "Command") so it is read as a word.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'inline-radio',
      options: ['sm', 'md'],
      table: { defaultValue: { summary: 'sm' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Kbd>;

export const Default: Story = { args: { children: 'Esc' } };

/** Both sizes, side by side. */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Kbd size="sm">Esc</Kbd>
      <Kbd size="md">Esc</Kbd>
    </div>
  ),
};

/** A chord and a sequence. */
export const Groups: Story = {
  render: () => (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        Search with{' '}
        <KbdGroup>
          <Kbd aria-label="Command">⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </p>
      <p>
        Go to inbox with{' '}
        <KbdGroup>
          <Kbd>G</Kbd>
          <span>then</span>
          <Kbd>I</Kbd>
        </KbdGroup>
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Command').tagName).toBe('KBD');
  },
};
