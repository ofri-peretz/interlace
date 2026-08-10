import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileSearch, Inbox } from 'lucide-react';
import { Button } from '@interlace/ui/button';
import { EmptyState } from '@interlace/ui/patterns/empty-state';

/**
 * `icon` and `actions` are ReactNode slots, so they cannot be typed into a text
 * box. Storybook's `mapping` gives them a real select control instead: the
 * option list below is what the canvas actually renders.
 */
const ICONS = {
  none: undefined,
  inbox: <Inbox className="size-10" />,
  search: <FileSearch className="size-10" />,
} as const;

const ACTIONS = {
  none: undefined,
  'primary button': <Button>Create the first one</Button>,
  'quiet button': <Button variant="outline">Clear filters</Button>,
  'button + link': (
    <div className="flex flex-wrap items-center justify-center gap-sm">
      <Button>Create the first one</Button>
      <Button variant="ghost">Read the docs</Button>
    </div>
  ),
} as const;

const meta: Meta<typeof EmptyState> = {
  title: 'Blocks/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The zero-row surface for a list, table or search result — a dashed card holding ' +
          'an optional icon, a factual headline, a line explaining how to change the result, ' +
          'and an optional action cluster. Use it wherever a query can legitimately return ' +
          'nothing AND the reader can do something about it; use an error surface instead ' +
          'when the emptiness is a failure rather than a state.',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description:
        'The headline, rendered as an `h4`. Keep it factual and short — "No rules match these filters", not "Oops!".',
      table: { category: 'Content', type: { summary: 'ReactNode' } },
    },
    description: {
      control: 'text',
      description:
        'Supporting copy. Say how the reader changes the result; omitting it is fine when the title is already self-explanatory.',
      table: { category: 'Content', type: { summary: 'ReactNode' } },
    },
    icon: {
      control: 'select',
      options: Object.keys(ICONS),
      mapping: ICONS,
      description:
        'Optional icon above the title — pass a lucide element. Rendered `aria-hidden`, so it must not carry meaning the title does not already state.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    actions: {
      control: 'select',
      options: Object.keys(ACTIONS),
      mapping: ACTIONS,
      description:
        'Optional CTA cluster — typically one primary Button, sometimes a quiet secondary next to it. Without an action this is just a message, which is the weaker form of this pattern.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the dashed card. The block is `w-full`, so height and outer spacing are set here.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'No items yet',
    description: 'Items you create will appear here.',
    // `icon` / `actions` carry the mapping KEY, not a node — Storybook swaps in
    // the element from `mapping` before render, and the Controls select stays
    // in sync with what is on screen.
    icon: 'inbox',
    actions: 'primary button',
  },
};

export const WithIcon: Story = {
  args: {
    icon: <Inbox className="size-10" />,
    title: 'Your inbox is clear',
    description: 'New notifications will appear here as they come in.',
  },
};

export const WithIconAndAction: Story = {
  args: {
    icon: <FileSearch className="size-10" />,
    title: 'No rules match these filters',
    description:
      'Try clearing the search, or browse the full catalog of 397 rules.',
    actions: <Button variant="outline">Clear filters</Button>,
  },
};
