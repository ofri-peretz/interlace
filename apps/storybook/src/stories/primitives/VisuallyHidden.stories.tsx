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
          'Screen-reader-only content. Renders invisible to sighted users (1px clipped) but exposed in the accessibility tree. Component form of the `sr-only` utility — use this when you want a named, slot-aware element.',
      },
    },
  },
} satisfies Meta<typeof VisuallyHidden>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="space-y-4 text-sm">
      <p>
        This sentence has hidden context for screen readers
        <VisuallyHidden> — only visible to assistive technology</VisuallyHidden>.
      </p>
      <p className="text-muted-foreground">
        Inspect the DOM: the highlighted span lives in the accessibility tree but
        takes no visible space.
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
          'When used as `<label>`, the visually-hidden text labels a form control. SR users hear it; sighted users see the placeholder.',
      },
    },
  },
  render: () => (
    <div className="max-w-xs">
      <VisuallyHidden as="label" htmlFor="search">
        Search the site
      </VisuallyHidden>
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
