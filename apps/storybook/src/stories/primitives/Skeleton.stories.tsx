import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Skeleton,
  SKELETON_VARIANTS,
  type SkeletonVariant,
} from '@interlace/ui/skeleton';
import { withReducedMotion, withRtl } from '@/decorators';

const meta: Meta<typeof Skeleton> = {
  title: 'Primitives/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Single component, many shapes. Pick a `variant` to paint the silhouette of the resting primitive/pattern; the page lays out the same as it will when real data arrives (CLS=0). Pulse animation is killed under `prefers-reduced-motion`. The variant union is the SKELETON_VARIANTS const tuple — invalid values fail TypeScript at dev time, and the skeleton-variant-coverage-lock vitest test fails CI if any `<Skeleton variant="…">` call site uses an unregistered value.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: SKELETON_VARIANTS,
      description:
        'Silhouette to paint. Pick the one named after the component being waited on — a shape that does not match the arriving content reintroduces the layout shift the skeleton exists to prevent.',
      table: { type: { summary: 'SkeletonVariant' }, defaultValue: { summary: 'rect' }, category: 'Appearance' },
    },
    count: {
      control: { type: 'range', min: 1, max: 10, step: 1 },
      description:
        'Render N copies stacked with `gap-sm` — a 5-line paragraph or a 3-card list without composing in the consumer. The group carries a single `role="status"`; the copies are silent.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '1' }, category: 'Data' },
    },
    label: {
      control: 'text',
      description:
        'Visually hidden loading text announced by screen readers. Set it to `null` when the surrounding region already exposes a busy state, so the page does not announce "Loading…" once per placeholder.',
      table: { type: { summary: 'string | null' }, defaultValue: { summary: "'Loading…'" }, category: 'State' },
    },
    className: {
      control: 'text',
      description:
        'Merged after the variant classes — the escape hatch for a one-off footprint (`h-12 w-48`) when no registered variant matches.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  args: { variant: 'rect', count: 1, label: 'Loading…' },
  render: (args) => (
    <div className="w-[360px] max-w-full">
      <Skeleton {...args} />
    </div>
  ),
};

/**
 * The full variant catalogue at a glance — one row per variant, labelled
 * so contributors can pick the right one for their loading-state use
 * case without reading the source.
 */
export const Catalogue: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="flex flex-col gap-md p-lg">
      {SKELETON_VARIANTS.map((variant) => (
        <CatalogueRow key={variant} variant={variant} />
      ))}
    </div>
  ),
};

function CatalogueRow({ variant }: { variant: SkeletonVariant }) {
  return (
    // flex-col below sm: the 176px `w-44 shrink-0` label plus a specimen leaves
    // under 100px for the specimen on a 375px phone, so the row overflows.
    <div className="flex flex-col items-start gap-md sm:flex-row">
      <code className="text-muted-foreground font-mono text-ui-sm pt-2 sm:w-44 sm:shrink-0">
        variant=&quot;{variant}&quot;
      </code>
      <div className="w-full max-w-float">
        <Skeleton variant={variant} />
      </div>
    </div>
  );
}

/**
 * `count={n}` stacks N copies with `gap-sm`. Useful for list placeholders
 * (5-line paragraph, 3-card grid, etc.) without composing in the
 * consumer.
 */
export const Count: Story = {
  args: { variant: 'text', count: 5 },
  render: (args) => (
    <div className="w-[360px] max-w-full">
      <Skeleton {...args} />
    </div>
  ),
};

/**
 * Composite variant — `article-card` paints the full image-on-top
 * pattern (image surface + title lines + description + author row).
 */
export const ArticleCardSkeleton: Story = {
  args: { variant: 'article-card' },
  render: (args) => (
    <div className="w-[360px] max-w-full">
      <Skeleton {...args} />
    </div>
  ),
};

export const Dark: Story = {
  ...Catalogue,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Catalogue,
  decorators: [withRtl],
};

export const ReducedMotion: Story = {
  ...Catalogue,
  decorators: [withReducedMotion],
};
