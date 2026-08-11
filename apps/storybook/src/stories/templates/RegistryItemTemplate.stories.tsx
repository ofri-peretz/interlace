import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RegistryItemTemplate } from '@interlace/ui/templates/registry-item-template';
import { CodeBlock } from '@interlace/ui/code-block';
import { Typography } from '@interlace/ui/typography';
import { withRtl } from '@/decorators';

const meta: Meta<typeof RegistryItemTemplate> = {
  title: 'Templates/RegistryItemTemplate',
  component: RegistryItemTemplate,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Full-page surface for a single registry item on ds.interlace.tools (e.g. `/c/skeleton`). Composes header (name + description + install), anatomy, variants matrix, related-components grid, and footer — each in its own <SectionBoundary>.',
      },
    },
  },
  argTypes: {
    name: {
      control: 'text',
      description: 'Component name — rendered as the page h1 and used in the install command.',
      table: { category: 'Content', type: { summary: 'string' } },
    },
    description: {
      control: 'text',
      description: 'One-line summary under the name. Say what the component is for, not what it is called.',
      table: { category: 'Content', type: { summary: 'ReactNode' } },
    },
    install: {
      control: false,
      description:
        'Install command, normally a `<CodeBlock language="bash">`. Passed as a node so the template takes no hard dependency on CodeBlock.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    anatomy: {
      control: false,
      description: 'Anatomy diagram plus the API surface — slots, props, R-rule mapping.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    variants: {
      control: false,
      description: 'Variants matrix — the CVA cells, shown in both light and dark.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    related: {
      control: false,
      description: '"Often used with…" grid of sibling components.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    footer: {
      control: false,
      description:
        'Trailing content — back-to-index CTA, "report an issue" link. Renders after `related`, in its own SectionBoundary.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RegistryItemTemplate>;

const InstallSnippet = () => (
  <CodeBlock language="bash" title="install">
    npx shadcn@latest add @interlace/skeleton
  </CodeBlock>
);

const AnatomyContent = () => (
  <CodeBlock language="tsx">{`<Skeleton variant="rect" />
<Skeleton variant="circle" />
<Skeleton variant="text" count={3} />
<Skeleton variant="article-card" />`}</CodeBlock>
);

const VariantsContent = () => (
  <Typography variant="long" tone="muted">
    18 registered variants: 4 generic shapes, 8 primitive-shaped, 5
    pattern-shaped. See the live story under{' '}
    <code className="font-mono">Primitives/Skeleton</code> for the full
    catalogue with token-driven hover/dark/RTL surfaces.
  </Typography>
);

const RelatedContent = () => (
  <Typography variant="long" tone="muted">
    Often used with <code className="font-mono">DataState</code> (state
    orchestrator) and <code className="font-mono">SectionBoundary</code>{' '}
    (per-section Suspense + ErrorBoundary fusion).
  </Typography>
);

export const Default: Story = {
  render: () => (
    <RegistryItemTemplate
      name="Skeleton"
      description="One component, many shapes. Pick a variant to paint the silhouette of the resting primitive — CLS=0 when real data arrives."
      install={<InstallSnippet />}
      anatomy={<AnatomyContent />}
      variants={<VariantsContent />}
      related={<RelatedContent />}
    />
  ),
};

const ForeverPending = () => {
  throw new Promise(() => {});
};

const Thrower = () => {
  throw new Error('demo: anatomy failed to load');
};

export const Loading: Story = {
  render: () => (
    <RegistryItemTemplate
      name="Loading…"
      description={<ForeverPending />}
      install={<ForeverPending />}
      anatomy={<ForeverPending />}
      variants={<ForeverPending />}
      related={<ForeverPending />}
    />
  ),
};

export const ErrorState: Story = {
  render: () => (
    <RegistryItemTemplate
      name="Skeleton"
      description="One component, many shapes."
      install={<InstallSnippet />}
      anatomy={<Thrower />}
      variants={<VariantsContent />}
      related={<RelatedContent />}
    />
  ),
};

export const Minimal: Story = {
  render: () => (
    <RegistryItemTemplate
      name="DataState"
      description="State-orchestration wrapper."
      install={<InstallSnippet />}
    />
  ),
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
 * PageSkeleton — the page-level loading state a consumer renders from
 * `loading.tsx` while the whole route is in flight. Shapes mirror the
 * real layout so the swap costs no layout shift (R23).
 */
export const PageSkeleton: Story = {
  render: () => <RegistryItemTemplate.Skeleton />,
};
