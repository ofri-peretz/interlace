import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExternalLink } from 'lucide-react';
import { VisuallyHidden, MIN_VIEWPORT } from '@interlace/ui/visually-hidden';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Primitives/VisuallyHidden',
  component: VisuallyHidden,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Text that reaches a screen reader but takes no visible space — the component form of the `sr-only` utility. Use it for the words a sighted reader gets from layout or an icon and an assistive-tech user does not: "(opens in a new tab)", a table caption, a label for a placeholder-only field. Not an alternative to `display: none` or `hidden`, which remove the node from the accessibility tree entirely; reach for the `sr-only` class instead when you are only tweaking an existing element inline.',
      },
    },
  },
  argTypes: {
    children: {
      control: 'text',
      description:
        'The screen-reader-only text. Edit it and nothing on the canvas moves — inspect the DOM, or read the mirror below.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    className: {
      control: 'text',
      description:
        'Merged after `sr-only`. Anything that re-establishes layout (e.g. `not-sr-only`) makes the text visible again — that is how SkipLink pops into view on focus.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
    id: {
      control: 'text',
      description:
        'Useful when the hidden string is the target of an `aria-describedby` / `aria-labelledby` on another element.',
      table: { category: 'A11y', type: { summary: 'string' } },
    },
    lang: {
      control: 'text',
      description:
        'Set this when the hidden string is in a different language from the page, so the screen reader switches voice (WCAG 3.1.2).',
      table: { category: 'A11y', type: { summary: 'string' } },
    },
  },
  args: {
    children: ' — only visible to assistive technology',
  },
} satisfies Meta<typeof VisuallyHidden>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The component paints nothing, so the story pairs the live sentence with a
 * mirror of what a screen reader would actually announce — otherwise the
 * `children` control would appear to do nothing at all.
 */
export const Default: Story = {
  render: (args) => (
    <div className="space-y-4 text-sm">
      <p>
        This sentence has hidden context for screen readers
        <VisuallyHidden {...args} />.
      </p>
      <div className="rounded-md border border-dashed border-border p-3">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          What a screen reader announces
        </div>
        <p className="font-mono text-xs">
          This sentence has hidden context for screen readers
          <span className="text-primary">{args.children}</span>.
        </p>
      </div>
      <p className="text-muted-foreground">
        Inspect the DOM: the span lives in the accessibility tree but takes no
        visible space.
      </p>
    </div>
  ),
};

export const ExternalLinkSuffix: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Classic use case — append "(opens in a new tab)" to icon-only external links so SR users know what activating the link will do.',
      },
    },
  },
  render: () => (
    <p className="text-sm">
      Read more on{' '}
      <a
        href="https://interlace.tools"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
      >
        Interlace
        <ExternalLink className="size-3.5" aria-hidden />
        <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
      </a>
      .
    </p>
  ),
};

export const AsLabel: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Labelling a placeholder-only field. VisuallyHidden always renders a `<span>` — it has no `as` / `render` seam — so put it INSIDE a real `<label htmlFor>`: the outer label owns the association, the inner span owns the invisibility. SR users hear the label; sighted users see the placeholder.',
      },
    },
  },
  render: () => (
    <div className="max-w-80">
      <label htmlFor="search">
        <VisuallyHidden>Search the site</VisuallyHidden>
      </label>
      <input
        id="search"
        type="search"
        placeholder="Search…"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

export const BelowMinViewport: Story = {
  render: () => (
    <div data-interlace-dev style={{ width: MIN_VIEWPORT - 1 }} className="border-2 border-dashed border-muted p-3">
      <p className="text-sm">
        Narrow container — VisuallyHidden still works invisibly.
        <VisuallyHidden> — hidden text never breaks layout regardless of viewport.</VisuallyHidden>
      </p>
    </div>
  ),
};
