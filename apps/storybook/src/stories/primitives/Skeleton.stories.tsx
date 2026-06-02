import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Skeleton,
  SKELETON_VARIANTS,
  type SkeletonVariant,
} from '@interlace/ui/skeleton';
import { withDark, withReducedMotion, withRtl } from '@/decorators';

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
    },
    count: {
      control: { type: 'number', min: 1, max: 10, step: 1 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  args: { variant: 'rect' },
  render: (args) => (
    <div className="w-[360px]">
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
    <div className="flex items-start gap-md">
      <code className="text-muted-foreground font-mono text-ui-sm w-44 shrink-0 pt-2">
        variant=&quot;{variant}&quot;
      </code>
      <div className="w-[420px] max-w-full">
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
    <div className="w-[360px]">
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
    <div className="w-[360px]">
      <Skeleton {...args} />
    </div>
  ),
};

export const Dark: Story = {
  ...Catalogue,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Catalogue,
  decorators: [withRtl],
};

export const ReducedMotion: Story = {
  ...Catalogue,
  decorators: [withReducedMotion],
};
