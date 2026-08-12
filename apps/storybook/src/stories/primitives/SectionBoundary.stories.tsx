import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SectionBoundary } from '@interlace/ui/section-boundary';
import { Skeleton, SKELETON_VARIANTS } from '@interlace/ui/skeleton';
import { withRtl } from '@/decorators';

const meta: Meta<typeof SectionBoundary> = {
  title: 'Primitives/SectionBoundary',
  component: SectionBoundary,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One Suspense boundary fused with one error boundary, so a page can stream section by section: each region paints its own skeleton while its data is in flight and its own error fallback if that data throws, and neither state blocks its siblings. Wrap every independently-loaded region of a template in one — without it React promotes the suspense to the nearest ancestor boundary (usually the page root) and the whole page stays blank until the slowest source resolves. It is not a retry mechanism: recovering from the error state needs a remount.',
      },
    },
  },
  argTypes: {
    name: {
      control: 'text',
      description:
        'Required telemetry handle. Lands on the DOM as `data-name` (a stable E2E selector), as the region\'s `aria-label`, and in the `console.error` breadcrumb when the boundary catches.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    skeletonVariant: {
      control: 'select',
      options: SKELETON_VARIANTS,
      description:
        'One-prop shortcut for the loading fallback — picks the `<Skeleton variant>` whose silhouette matches what is streaming in. Shape-match it to the real content or the page will still jump when data lands.',
      table: { type: { summary: 'SkeletonVariant' }, defaultValue: { summary: 'card' }, category: 'Appearance' },
    },
    skeleton: {
      control: false,
      description:
        'Full control over the loading fallback. Wins over `skeletonVariant`; use it when the resting shape is a composition rather than one silhouette.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    error: {
      control: false,
      description:
        'Fallback rendered when a descendant throws. Defaults to a `role="alert"` line in `text-destructive`. Pass a node with a recovery affordance when the user can do something about it.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    children: {
      control: false,
      description:
        'The section content — typically one async server component. Anything that suspends or throws below here is caught by this boundary and nothing above it.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the wrapping `<section>`, which is `display: contents` by default so the boundary adds no box of its own. Override that only if the region really needs to be a layout parent.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'contents' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SectionBoundary>;

/**
 * Idle — children render normally; boundary is invisible. Demonstrates
 * the "happy path" where no suspense fires and no error throws.
 */
export const Idle: Story = {
  args: { name: 'example-section', skeletonVariant: 'card' },
  render: (args) => (
    <div className="w-full max-w-float">
      <SectionBoundary {...args}>
        <div className="border-border rounded-md border p-md">
          <h3 className="font-body text-h5 font-semibold">Hello, world</h3>
          <p className="text-muted-foreground text-ui">
            Section content rendered idle.
          </p>
        </div>
      </SectionBoundary>
    </div>
  ),
};

/**
 * Loading — child throws a promise (`throw promise`) to trigger
 * Suspense. The boundary's `skeletonVariant="card"` fallback paints
 * while the promise is unresolved; in this demo the promise never
 * resolves so the skeleton stays. Change `skeletonVariant` in Controls to
 * see every silhouette the one-prop shortcut can produce.
 */
const ForeverPending = () => {
  throw new Promise(() => {});
};

export const Loading: Story = {
  args: { name: 'example-section', skeletonVariant: 'article-card' },
  render: (args) => (
    <div className="w-full max-w-float">
      <SectionBoundary {...args}>
        {/* never resolves */}
        {React.createElement(ForeverPending)}
      </SectionBoundary>
    </div>
  ),
};

/**
 * Error — child throws synchronously. The ErrorBoundary catches it and
 * renders the default `text-destructive` fallback (`role="alert"`).
 */
const Thrower = () => {
  throw new Error('demo: section failed to load');
};

export const ErrorState: Story = {
  args: { name: 'example-section' },
  render: (args) => (
    <div className="w-full max-w-float">
      <SectionBoundary {...args}>
        {React.createElement(Thrower)}
      </SectionBoundary>
    </div>
  ),
};

/**
 * Custom fallbacks — pass `skeleton` / `error` directly when the
 * defaults aren't enough.
 */
export const CustomFallbacks: Story = {
  render: () => (
    <div className="flex w-full max-w-float flex-col gap-md">
      <SectionBoundary
        name="custom-loading"
        skeleton={
          <div className="border-border bg-muted/50 flex items-center justify-center rounded-md border border-dashed p-lg">
            <Skeleton variant="text" count={3} />
          </div>
        }
      >
        {React.createElement(ForeverPending)}
      </SectionBoundary>
      <SectionBoundary
        name="custom-error"
        error={
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-md"
          >
            <strong className="font-body font-semibold">Couldn&apos;t load.</strong>{' '}
            Please refresh the page.
          </div>
        }
      >
        {React.createElement(Thrower)}
      </SectionBoundary>
    </div>
  ),
};

/**
 * Multiple boundaries — independent streaming. In a real template each
 * `<SectionBoundary>` wraps a separate `async` RSC; here we just stack
 * three boundaries with different states to show they don't interact.
 */
export const ThreeIndependentSections: Story = {
  render: () => (
    <div className="flex w-full max-w-float flex-col gap-md">
      <SectionBoundary name="header" skeletonVariant="page-header">
        <div className="border-border rounded-md border p-md">
          <h3 className="text-h5 font-semibold">Header (idle)</h3>
        </div>
      </SectionBoundary>
      <SectionBoundary name="body" skeletonVariant="article-card">
        {React.createElement(ForeverPending)}
      </SectionBoundary>
      <SectionBoundary name="footer">
        {React.createElement(Thrower)}
      </SectionBoundary>
    </div>
  ),
};

export const Dark: Story = {
  ...ThreeIndependentSections,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...ThreeIndependentSections,
  decorators: [withRtl],
};
