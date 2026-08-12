import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@interlace/ui/badge';
import { withRtl } from '@/decorators';

const meta: Meta<typeof Badge> = {
  title: 'Primitives/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Compact, non-interactive label that qualifies something next to it: status, category, count, severity. If the reader is meant to click it, render a `Button` (or pass `render` an anchor) — a badge that acts like a control but does not look like one is a trap. Token-only colours per `COLOR_PHILOSOPHY.md`; never paint with raw hex.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'destructive',
        'outline',
        'ghost',
        'link',
      ],
      description:
        'Pigment ladder. `default` is the emphatic one — using it everywhere flattens the signal; reach for `secondary` / `outline` for neutral metadata and reserve `destructive` for failure.',
      table: {
        category: 'Appearance',
        type: {
          summary:
            "'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'",
        },
        defaultValue: { summary: 'default' },
      },
    },
    loading: {
      control: 'boolean',
      description:
        'Render a shape-matched `<Skeleton variant="badge" />` (h-5 w-16 pill) so a metadata row does not shift when the value arrives.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    children: {
      control: 'text',
      description:
        'Label text, optionally preceded by a lucide icon (auto-sized to `size-3`).',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    className: {
      control: 'text',
      description:
        'Escape hatch for layout only (margins, `max-w`). Colour belongs in `variant`.',
      table: { category: 'Appearance' },
    },
    render: {
      control: false,
      description:
        'Replace the rendered `<span>` — pass `<a href="…" />` to get the anchor hover states baked into every variant.',
      table: { category: 'Slots', type: { summary: 'ReactElement | function' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: 'Security', variant: 'default', loading: false },
};
/**
 * The skeleton the registry embeds as this component's loading demo.
 *
 * A dedicated story rather than the site's `args: loading:!true` override:
 * the preview story is a `render` composition, and a render callback that
 * ignores `args` swallows an arg override silently — the page would have
 * shown a normal Badge under a "loading state" caption.
 */
export const Loading: Story = {
  args: { children: 'Security', loading: true },
};
export const Variants: Story = {
  // The registry's thumbnail for this component — see the preview policy in
  // apps/registry/scripts/build-story-map.mjs. Default renders too small to
  // read at thumbnail size.
  tags: ['preview'],
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="link">Link</Badge>
    </div>
  ),
};
export const Dark: Story = {
  ...Variants,
  globals: { theme: 'dark' },
  parameters: { backgrounds: { default: 'dark' } },
  decorators: [(S) => <div className="dark"><S /></div>],
};

export const RTL: Story = {
  args: { children: 'أمان' },
  decorators: [withRtl],
};
