import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkipLink, MIN_VIEWPORT } from '@interlace/ui/skip-link';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Primitives/SkipLink',
  component: SkipLink,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Keyboard-first "skip to main content" link (WCAG 2.4.1 Bypass Blocks). Visually hidden by default; pops into the top-left corner when focused via Tab. Pair with a `<main id="main" tabIndex={-1}>` so focus moves into the content region.',
      },
    },
  },
} satisfies Meta<typeof SkipLink>;

export default meta;
type Story = StoryObj<typeof meta>;

const PageMock = ({ skipChildren }: { skipChildren?: React.ReactNode }) => (
  <div className="min-h-[60vh] bg-background text-foreground">
    <SkipLink>{skipChildren ?? 'Skip to main content'}</SkipLink>
    <header className="border-b border-border bg-card px-6 py-4 text-sm">
      Press <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs">Tab</kbd> to focus the SkipLink — it will appear top-left.
    </header>
    <nav className="border-b border-border px-6 py-3 text-sm text-muted-foreground">
      Header nav · About · Posts · Docs
    </nav>
    <main id="main" tabIndex={-1} className="px-6 py-12">
      <h1 className="text-2xl font-bold">Main content region</h1>
      <p className="mt-3 max-w-prose text-muted-foreground">
        Activating the skip link moves keyboard focus here, bypassing the
        header and nav landmarks above.
      </p>
    </main>
  </div>
);

export const Default: Story = {
  render: () => <PageMock />,
};

export const CustomLabel: Story = {
  render: () => <PageMock skipChildren="Jump to article body" />,
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
    <div
      data-interlace-dev
      style={{ width: MIN_VIEWPORT - 1 }}
      className="border-2 border-dashed border-muted"
    >
      <PageMock />
    </div>
  ),
};
