import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { BoldIcon, ItalicIcon, LinkIcon, Redo2Icon, UnderlineIcon, Undo2Icon } from 'lucide-react';
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarInput,
  ToolbarLink,
  ToolbarSeparator,
} from '@interlace/ui/toolbar';
import { Toggle } from '@interlace/ui/toggle';
import { withRtl } from '@/decorators';

const meta: Meta<typeof Toolbar> = {
  title: 'Primitives/Toolbar',
  component: Toolbar,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A row of controls that is one stop in the Tab order. Tab enters it on the control you used last and the next Tab leaves it; inside, the arrow keys move between controls, Home and End jump to the ends, and focus wraps. Use it for a formatting bar, the bulk actions above a table, or a player\'s controls, so a keyboard user does not Tab through every button to get past it. A disabled button stays reachable so its label can still be read.',
      },
    },
  },
  argTypes: {
    orientation: {
      control: 'inline-radio',
      options: ['horizontal', 'vertical'],
      description:
        'Which arrow keys move focus: Left and Right for a horizontal bar, Up and Down for a vertical one.',
      table: { type: { summary: "'horizontal' | 'vertical'" }, defaultValue: { summary: 'horizontal' }, category: 'Behavior' },
    },
    loopFocus: {
      control: 'boolean',
      description: 'Wrap from the last control to the first, and back.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'Behavior' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Toolbar>;

function EditorBar(props: React.ComponentProps<typeof Toolbar>) {
  return (
    <Toolbar aria-label="Formatting" className="border-border rounded-lg border p-1" {...props}>
      <ToolbarGroup aria-label="History">
        <ToolbarButton aria-label="Undo">
          <Undo2Icon />
        </ToolbarButton>
        <ToolbarButton aria-label="Redo" disabled>
          <Redo2Icon />
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup aria-label="Text style">
        <ToolbarButton render={<Toggle />} aria-label="Bold">
          <BoldIcon />
        </ToolbarButton>
        <ToolbarButton render={<Toggle />} aria-label="Italic">
          <ItalicIcon />
        </ToolbarButton>
        <ToolbarButton render={<Toggle />} aria-label="Underline">
          <UnderlineIcon />
        </ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarButton aria-label="Insert link">
        <LinkIcon />
      </ToolbarButton>
    </Toolbar>
  );
}

export const Default: Story = {
  render: (args) => <EditorBar {...args} />,
};

/**
 * One Tab stop: Tab lands on the first control, the arrows move inside, End
 * and Home jump, the disabled Redo is still reachable, focus wraps, and the
 * next Tab leaves the whole bar.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <button type="button">Before</button>
      <EditorBar />
      <button type="button">After</button>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const name = () => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent;
    canvas.getByRole('button', { name: 'Before' }).focus();

    await step('Tab enters the toolbar on its first control', async () => {
      await userEvent.tab();
      await waitFor(() => expect(name()).toBe('Undo'));
    });

    await step('Right arrow moves; the disabled Redo stays reachable', async () => {
      await userEvent.keyboard('{ArrowRight}');
      expect(name()).toBe('Redo');
      expect(document.activeElement?.getAttribute('aria-disabled')).toBe('true');
    });

    await step('End and Home jump to the ends; focus wraps', async () => {
      await userEvent.keyboard('{End}');
      expect(name()).toBe('Insert link');
      await userEvent.keyboard('{ArrowRight}');
      expect(name()).toBe('Undo');
      await userEvent.keyboard('{ArrowLeft}');
      expect(name()).toBe('Insert link');
      await userEvent.keyboard('{Home}');
      expect(name()).toBe('Undo');
      // Home from the disabled Redo too: Base UI blocks every key there but Tab.
      await userEvent.keyboard('{ArrowRight}');
      expect(name()).toBe('Redo');
      await userEvent.keyboard('{Home}');
      expect(name()).toBe('Undo');
    });

    await step('One more Tab leaves the whole toolbar', async () => {
      await userEvent.keyboard('{ArrowRight}{ArrowRight}');
      expect(name()).toBe('Bold');
      await userEvent.tab();
      expect(name()).toBe('After');
    });

    await step('Shift+Tab comes back to the control used last', async () => {
      await userEvent.tab({ shift: true });
      expect(name()).toBe('Bold');
    });
  },
};

/** Up and Down move focus in a vertical bar; the rules turn horizontal. */
export const Vertical: Story = {
  render: () => <EditorBar orientation="vertical" className="border-border w-fit rounded-lg border p-1" />,
};

/**
 * A search field joins the roving order. It goes last: Left and Right move
 * the caret inside it, so the arrows only leave it at the ends of the text.
 */
export const WithInputAndLink: Story = {
  render: () => (
    <Toolbar aria-label="Table actions" className="border-border rounded-lg border p-1">
      <ToolbarButton variant="outline" size="sm">
        Export
      </ToolbarButton>
      <ToolbarButton variant="outline" size="sm">
        Archive
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarLink href="#">Edited 5 minutes ago</ToolbarLink>
      <ToolbarSeparator />
      <ToolbarInput aria-label="Filter rows" placeholder="Filter rows" />
    </Toolbar>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Filter rows' }) as HTMLInputElement;
    const name = () => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent;

    await step('End reaches the field from a button', async () => {
      canvas.getByRole('button', { name: 'Export' }).focus();
      await userEvent.keyboard('{End}');
      expect(document.activeElement).toBe(input);
    });

    await step('Inside the text, the arrows and Home move the caret, not focus', async () => {
      await userEvent.type(input, 'ab');
      await userEvent.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(1);
      await userEvent.keyboard('{Home}');
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(0);
    });

    await step('At the start of the text, Left leaves for the link', async () => {
      await userEvent.keyboard('{ArrowLeft}');
      await waitFor(() => expect(name()).toBe('Edited 5 minutes ago'));
    });
  },
};

/** Arrow keys follow the reading direction: in RTL, Left moves forward. */
export const RTL: Story = { ...Default, decorators: [withRtl] };

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
