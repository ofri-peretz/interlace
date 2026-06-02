import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SectionBoundary } from '@interlace/ui/section-boundary';
import { Skeleton } from '@interlace/ui/skeleton';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof SectionBoundary> = {
  title: 'Primitives/SectionBoundary',
  component: SectionBoundary,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Stream-per-section primitive. Fuses React Suspense + an ErrorBoundary inside one component so a template can render section-by-section: each region declares its own skeleton + error fallback, and a slow / failed region degrades in place without blocking the rest of the page. Required `name` prop becomes a telemetry breadcrumb + an aria-label landmark.',
      },
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
  render: () => (
    <div className="w-[420px]">
      <SectionBoundary name="example-section">
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
 * resolves so the skeleton stays.
 */
const ForeverPending = () => {
  throw new Promise(() => {});
};

export const Loading: Story = {
  render: () => (
    <div className="w-[420px]">
      <SectionBoundary name="example-section" skeletonVariant="article-card">
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
  render: () => (
    <div className="w-[420px]">
      <SectionBoundary name="example-section">
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
    <div className="flex w-[420px] flex-col gap-md">
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
    <div className="flex w-[420px] flex-col gap-md">
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
  decorators: [withDark],
};

export const RTL: Story = {
  ...ThreeIndependentSections,
  decorators: [withRtl],
};
