import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus } from 'lucide-react';
import { Button } from '@interlace/ui/button';
import { PageHeader } from '@interlace/ui/patterns/page-header';

const meta: Meta<typeof PageHeader> = {
  title: 'Blocks/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The rule-bounded `<header>` that opens an admin, docs or settings page: ' +
          'breadcrumb, h1, description, a right-aligned actions cluster and a meta ' +
          'strip. It renders the page h1, so use exactly one per route — a marketing ' +
          'landing page wants Hero (which owns its own display type and background) ' +
          'and a mid-page divider wants SectionHeader.',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'The page h1. Required in practice — the header has no other anchor.',
      table: { type: { summary: 'ReactNode' } },
    },
    description: {
      control: 'text',
      description: 'Muted supporting line under the title.',
      table: { type: { summary: 'ReactNode' } },
    },
    breadcrumb: {
      control: false,
      description:
        'Slot above the title — pass your own `<nav aria-label="Breadcrumb">`. The block does not own breadcrumb semantics, so the router stays the router.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    actions: {
      control: false,
      description:
        'Right-aligned cluster, typically Buttons. Wraps under the title below `sm`.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    meta: {
      control: false,
      description:
        'Strip below the title for tags, version, status, dates. Rendered as a flex row of whatever you pass.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    loading: {
      control: 'boolean',
      description:
        'Swap the whole header for a `<Skeleton variant="page-header" />` so the page does not reflow when the title resolves.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    className: {
      control: 'text',
      description: 'Merged onto the `<header>` — the bottom-border / padding seam.',
      table: { category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Plugin catalog',
    description: 'Every Interlace ESLint plugin and its rules, grouped by domain.',
    loading: false,
  },
};

export const WithActions: Story = {
  args: {
    title: 'Rules',
    description: '397 rules across 9 OWASP categories.',
    actions: (
      <Button>
        <Plus className="mr-1 size-4" aria-hidden />
        Add rule
      </Button>
    ),
  },
};

export const WithBreadcrumbAndMeta: Story = {
  args: {
    breadcrumb: (
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <a href="#" className="hover:text-foreground">
          Plugins
        </a>
        <span className="px-2" aria-hidden>
          /
        </span>
        <span>node-security</span>
      </nav>
    ),
    title: 'eslint-plugin-node-security',
    description: '42 rules locking down Node, Express, and MongoDB attack surfaces.',
    meta: (
      <>
        <span>v2.4.1</span>
        <span>·</span>
        <span>MIT license</span>
        <span>·</span>
        <span>70.3K weekly downloads</span>
      </>
    ),
    actions: <Button variant="outline">Install</Button>,
  },
};

/**
 * The header is the tallest above-the-fold element on an admin route, so it
 * reserves its own footprint rather than letting the whole page slide down
 * when the record resolves.
 */
export const Loading: Story = {
  args: { loading: true },
};
