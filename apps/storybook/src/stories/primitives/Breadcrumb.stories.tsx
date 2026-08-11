import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Skeleton } from '@interlace/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
  BreadcrumbEllipsis,
  MIN_VIEWPORT,
} from '@interlace/ui/breadcrumb';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Primitives/Breadcrumb',
  component: Breadcrumb,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Ancestor trail for a page that sits several levels down a hierarchy the reader can actually walk (docs, rule pages, nested settings). Skip it on flat sites — a two-segment trail is noise. Compositional API: `Breadcrumb` (nav) > `BreadcrumbList` (ol) > `BreadcrumbItem` (li) > `BreadcrumbLink` / `BreadcrumbPage` / `BreadcrumbSeparator` / `BreadcrumbEllipsis`. `BreadcrumbLink` supports `asChild` for composing with routing primitives (e.g. `next/link`) without forcing a client boundary. MIN_VIEWPORT = 480px — below it, collapse with `BreadcrumbEllipsis`.',
      },
    },
  },
  // The root is a bare `<nav aria-label="breadcrumb">`: it owns the landmark
  // and nothing else. Every meaningful knob (href, asChild, the separator
  // glyph, aria-current) lives on the parts composed as children, which is
  // why this Controls panel is deliberately short.
  argTypes: {
    'aria-label': {
      control: 'text',
      description:
        'Landmark name. Defaults to "breadcrumb"; override only when a page carries more than one trail, so each landmark is distinguishable.',
      table: {
        category: 'Accessibility',
        defaultValue: { summary: 'breadcrumb' },
      },
    },
    className: {
      control: 'text',
      description:
        'Applied to the `<nav>`. Type scale and colour live on `BreadcrumbList`; use this for placement (margins, ordering in a page header).',
      table: { category: 'Appearance' },
    },
    children: {
      control: false,
      description:
        'Exactly one `BreadcrumbList`, holding `BreadcrumbItem`s separated by `BreadcrumbSeparator`. The last item is a `BreadcrumbPage`, never a link.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
  },
} satisfies Meta<typeof Breadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

// 4-segment path — Home / Docs / Plugins / Secure Coding (current).
export const Default: Story = {
  args: { 'aria-label': 'breadcrumb', className: '' },
  render: (args) => (
    <Breadcrumb {...args}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/docs">Docs</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/docs/plugins">Plugins</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Secure Coding</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
};

/**
 * Variants — three compositional shapes the breadcrumb supports:
 *   1. Full 4-segment trail (Default).
 *   2. Collapsed trail with `BreadcrumbEllipsis` for deep paths.
 *   3. Long trail that demonstrates wrapping via `flex-wrap` on the list.
 */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-lg">
      <section className="flex flex-col gap-xs">
        <div className="text-ui-sm text-muted-foreground">Full trail (4 segments)</div>
        <Breadcrumb aria-label="Breadcrumb — full trail">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/docs">Docs</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/docs/plugins">Plugins</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Secure Coding</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </section>

      <section className="flex flex-col gap-xs">
        <div className="text-ui-sm text-muted-foreground">Collapsed (ellipsis)</div>
        <Breadcrumb aria-label="Breadcrumb — collapsed">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/docs/plugins">Plugins</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Secure Coding</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </section>

      <section className="flex flex-col gap-xs">
        <div className="text-ui-sm text-muted-foreground">
          Long trail — wraps via flex-wrap (constrained to 360px)
        </div>
        <div className="w-[360px] max-w-full">
          <Breadcrumb aria-label="Breadcrumb — long wrapping trail">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/docs">Documentation</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/docs/plugins">Plugins</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/docs/plugins/secure-coding">
                  Secure Coding
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/docs/plugins/secure-coding/rules">
                  Rules
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>no-hardcoded-credentials</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </section>
    </div>
  ),
};

/**
 * Keyboard-only flow: every ancestor is a real link in the tab order and the
 * current page is NOT one — it carries `aria-current="page"` instead, so
 * screen-reader users aren't offered a link to where they already are.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/docs">Docs</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Secure Coding</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('The trail is a named navigation landmark', async () => {
      expect(canvas.getByRole('navigation', { name: /breadcrumb/i })).toBeTruthy();
    });

    await step('Only the ancestors are navigable', async () => {
      // The current page renders as `<span role="link" aria-disabled="true"
      // aria-current="page">` (shadcn canon) — it is in the a11y tree as a
      // link so the trail reads consistently, but it is NOT an anchor and
      // NOT focusable, so it can't send you to the page you're already on.
      const anchors = canvasElement.querySelectorAll('a');
      expect(anchors).toHaveLength(2);

      const current = canvas.getByText('Secure Coding');
      expect(current.getAttribute('aria-current')).toBe('page');
      expect(current.getAttribute('aria-disabled')).toBe('true');
      expect(current.tagName.toLowerCase()).not.toBe('a');
    });

    await step('Tab walks the ancestors in document order', async () => {
      const anchors = [...canvasElement.querySelectorAll('a')];
      anchors[0].focus();
      await userEvent.tab();
      expect(document.activeElement).toBe(anchors[1]);
    });
  },
};

/**
 * Async route trail — reserve the crumb row so the page header doesn't jump
 * once the ancestor path resolves.
 */
export const Loading: Story = {
  render: () => <Skeleton variant="breadcrumb" className="w-80" />,
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

/**
 * Below-min-viewport demo — wrap in a (MIN_VIEWPORT - 1)px container with the
 * `data-interlace-dev` flag so preflight's dashed warning outline appears.
 * The breadcrumb still functions; the outline is a dev-only signal that the
 * trail has dropped below its supported width and should be collapsed with
 * `BreadcrumbEllipsis`.
 */
export const BelowMinViewport: Story = {
  render: () => (
    <div className="overflow-x-auto">
      {/* overflow-x-auto: this frame is pinned to a fixed pixel width to trip the
        min-viewport contract, so without an inner scroller it pushes the whole
        page sideways on a 375px phone. */}
      <div data-interlace-dev style={{ width: MIN_VIEWPORT - 1 }}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/docs">Docs</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/docs/plugins">Plugins</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Secure Coding</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  ),
  decorators: [
    (Story) => (
      // Promote the body flag for this story so the preflight selector matches.
      <div
        ref={(node) => {
          if (node && typeof document !== 'undefined') {
            document.body.setAttribute('data-interlace-dev', '');
          }
        }}
      >
        <Story />
      </div>
    ),
  ],
};
