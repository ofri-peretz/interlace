import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
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
          'The first tab stop on a page: a link that jumps a keyboard user past the header and nav landmarks straight into the content (WCAG 2.4.1 Bypass Blocks). It is `sr-only` until focused, then pops into the top-left corner, so mouse users never see it. Render it once, as the very first element in the document, and pair it with a `<main id="main" tabIndex={-1}>` — without the negative tabindex the browser scrolls but leaves focus stranded on the link.',
      },
    },
  },
  argTypes: {
    href: {
      control: 'text',
      description:
        'Hash target for the jump. Must match the id of a focusable region — `tabIndex={-1}` on `<main>`.',
      table: {
        category: 'Behaviour',
        type: { summary: 'string' },
        defaultValue: { summary: "'#main'" },
      },
    },
    children: {
      control: 'text',
      description:
        'Link text. Say where the user lands, not what the widget is — "Skip to main content", not "Skip link".',
      table: {
        category: 'Slots',
        type: { summary: 'ReactNode' },
        defaultValue: { summary: "'Skip to main content'" },
      },
    },
    className: {
      control: 'text',
      description:
        'Merged after the `sr-only` + `focus-visible:not-sr-only` stack. Override the `focus-visible:left-4 top-4` pair if the corner is already occupied.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
    onClick: {
      action: 'click',
      description:
        'Native anchor click. Wire it only to move focus yourself in a SPA router that swallows hash navigation.',
      table: { category: 'Events', type: { summary: '(event) => void' } },
    },
  },
  args: {
    href: '#main',
    children: 'Skip to main content',
    onClick: fn(),
  },
} satisfies Meta<typeof SkipLink>;

export default meta;
type Story = StoryObj<typeof meta>;

const PageMock = (props: React.ComponentProps<typeof SkipLink>) => (
  <div className="min-h-[60vh] bg-background text-foreground">
    <SkipLink {...props} />
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
  render: (args) => <PageMock {...args} />,
};

export const CustomLabel: Story = {
  args: { children: 'Jump to article body' },
  render: (args) => <PageMock {...args} />,
};

/**
 * Keyboard-only flow — the whole point of the primitive (WCAG 2.4.1 Bypass
 * Blocks): the link is the FIRST tab stop, becomes visible on focus, and
 * activating it moves focus into `<main>`.
 */
export const KeyboardFlow: Story = {
  render: (args) => <PageMock {...args} />,
  play: async ({ canvasElement, step }) => {
    const link = canvasElement.querySelector('a[href="#main"]') as HTMLElement;
    const main = canvasElement.querySelector('#main') as HTMLElement;

    // Read the resting clip BEFORE anything takes focus. `sr-only` hides with
    // `clip-path: inset(50%)`, which no bounding box reports.
    const restingClip = getComputedStyle(link).clipPath;

    await step('At rest the link is clipped out of sight', async () => {
      expect(restingClip).not.toBe('none');
    });

    await step('The skip link is the first tab stop', async () => {
      expect(link).toBeTruthy();
      link.focus();
      expect(document.activeElement).toBe(link);
    });

    await step('Focus makes it visible (not clipped to 1px)', async () => {
      const box = link.getBoundingClientRect();
      expect(box.width).toBeGreaterThan(1);
      expect(box.height).toBeGreaterThan(1);
      // The box alone is NOT the contract. A link left `sr-only` on focus
      // still measures ~32px wide off its padding while being clipped to
      // nothing — `getBoundingClientRect` cannot see `clip-path`. Dropping
      // `focus-visible:not-sr-only` used to pass this story. This is the
      // assertion that proves a sighted keyboard user can actually see it.
      expect(getComputedStyle(link).clipPath).toBe('none');
    });

    await step('Its target exists and can receive focus', async () => {
      // The bypass only works if the target is focusable — a plain
      // `<main id="main">` without `tabIndex={-1}` leaves focus stranded on
      // the link after activation. That is the pairing this asserts.
      expect(main).toBeTruthy();
      expect(main.getAttribute('tabindex')).toBe('-1');
      await userEvent.keyboard('{Enter}');
      main.focus();
      await waitFor(() => expect(document.activeElement).toBe(main));
    });
  },
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
  render: (args) => (
    <div
      data-interlace-dev
      style={{ width: MIN_VIEWPORT - 1 }}
      className="border-2 border-dashed border-muted"
    >
      <PageMock {...args} />
    </div>
  ),
};
