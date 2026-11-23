import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Citation } from '@interlace/ui/patterns/citation';

// Placeholder sources: the publishers are fictional and every URL points at
// example.com, so the story makes no claim about the real world.
const SOURCES = [
  {
    publisher: 'The Example Gazette',
    url: 'https://example.com/gazette/report',
    kind: 'news report',
    quote: 'The bridge reopened to traffic on Monday morning after six weeks of repairs.',
  },
  {
    publisher: 'City Transport Office',
    url: 'https://example.com/transport/notice-14',
    kind: 'official record',
    note: 'notice 14',
    quote: 'All lanes of the bridge are open from 06:00 on 3 March.',
  },
];

const meta = {
  title: 'Blocks/Citation',
  component: Citation,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An inline source marker for a sentence that makes a claim. The reader taps or tabs to ' +
          'the marker and a popover lists every source behind it: the publisher (linked, https ' +
          'only), the kind of source, and the exact words quoted. Several sources stack in one ' +
          'popover. `marker="number"` adds a footnote number after the text; `marker="underline"` ' +
          'makes the phrase itself the trigger. `status` shows whether the claim meets your ' +
          'sourcing bar.',
      },
    },
  },
  argTypes: {
    sources: {
      control: 'object',
      description:
        'One or more `{ publisher, url?, kind?, quote?, note? }`. Only `https:` URLs become links; anything else renders the publisher as plain text.',
      table: { category: 'Content', type: { summary: 'CitationSourceData[]' } },
    },
    marker: {
      control: 'inline-radio',
      options: ['number', 'underline'],
      description:
        '`number` keeps the sentence plain and adds a superscript `[n]`. `underline` puts a dotted underline on the phrase and makes it the trigger.',
      table: {
        category: 'Appearance',
        type: { summary: "'number' | 'underline'" },
        defaultValue: { summary: 'number' },
      },
    },
    number: {
      control: { type: 'number', min: 1 },
      description: 'The footnote number shown for `marker="number"`.',
      table: { category: 'Appearance', type: { summary: 'number' }, defaultValue: { summary: '1' } },
    },
    status: {
      control: 'inline-radio',
      options: [undefined, 'enough', 'short'],
      description:
        '`enough` shows a success badge in the popover, `short` a warning one. Omit it to show no badge.',
      table: { category: 'State', type: { summary: "'enough' | 'short'" } },
    },
    statusLabel: {
      control: 'text',
      description: 'Replaces the badge text, for example to translate it.',
      table: { category: 'Content', type: { summary: 'string' } },
    },
    triggerLabel: {
      control: 'text',
      description: 'Accessible name of the marker. Defaults to "Sources (n)".',
      table: { category: 'A11y', type: { summary: 'string' } },
    },
  },
  args: {
    sources: SOURCES,
    marker: 'number',
    number: 1,
    children: 'The bridge reopened on Monday.',
  },
  render: (args) => (
    <p className="max-w-prose text-base">
      After six weeks of work, <Citation {...args} /> Traffic is expected to return to normal
      by the end of the week.
    </p>
  ),
} satisfies Meta<typeof Citation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Underline: Story = {
  args: { marker: 'underline', children: 'the bridge reopened to traffic on Monday morning' },
};

export const EnoughSources: Story = {
  args: { status: 'enough' },
};

export const ShortOfSources: Story = {
  args: { status: 'short', sources: SOURCES.slice(0, 1) },
};

export const NonHttpsLink: Story = {
  args: {
    sources: [{ publisher: 'An http page', url: 'http://example.com/old', kind: 'blog' }],
  },
};

/** Keyboard: Tab to the marker, Enter opens, Escape closes and returns focus. */
export const Keyboard: Story = {
  args: { status: 'enough' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Sources (2)' });
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('The Example Gazette')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    // Wait for the popup to unmount: while it is open, Base UI keeps focus
    // guards beside the trigger, and the axe pass runs after this function.
    await waitFor(() =>
      expect(canvasElement.ownerDocument.querySelector('[data-slot="citation-content"]')).toBeNull(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
