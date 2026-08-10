import type { Meta, StoryObj } from '@storybook/react-vite';
import { Trophy } from 'lucide-react';
import { SectionHeader } from '@interlace/ui/patterns/section-header';

const meta: Meta<typeof SectionHeader> = {
  title: 'Blocks/SectionHeader',
  component: SectionHeader,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The "text-center mb-12 + h2 + tagline" pattern from LAYOUT_PHILOSOPHY.md §1, ' +
          'lifted into one component so six homepage sections stop drifting apart. It ' +
          'owns the heading and its bottom margin only — no background, no container — ' +
          'so it drops into whatever section wrapper you already have. Use PageHeader ' +
          'for the page h1 and Hero for above-the-fold display type.',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'The heading text. Rendered at the level given by `as`.',
      table: { type: { summary: 'ReactNode' } },
    },
    tagline: {
      control: 'text',
      description:
        'Subhead under the title, capped at `max-w-prose` and centred with the title when `align="center"`.',
      table: { type: { summary: 'ReactNode' } },
    },
    eyebrow: {
      control: false,
      description:
        'Chip / badge above the title. Always centre-aligned regardless of `align` — see the WithEyebrow story.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    align: {
      control: 'select',
      options: ['center', 'start'],
      description:
        'Centred for full-width marketing sections; `start` inside a prose-width column, where a centred heading fights the text gutter.',
      table: {
        type: { summary: "'center' | 'start'" },
        defaultValue: { summary: 'center' },
        category: 'Appearance',
      },
    },
    spacing: {
      control: 'select',
      options: ['md', 'lg'],
      description: 'Bottom margin before the section body — `md` = mb-12, `lg` = mb-16.',
      table: {
        type: { summary: "'md' | 'lg'" },
        defaultValue: { summary: 'lg' },
        category: 'Appearance',
      },
    },
    as: {
      control: 'select',
      options: ['h1', 'h2', 'h3'],
      description:
        'Heading level. Keep the document outline honest — h2 for a top-level section, h3 for a nested one. The visual size does not change with it.',
      table: {
        type: { summary: "'h1' | 'h2' | 'h3'" },
        defaultValue: { summary: 'h2' },
        category: 'Accessibility',
      },
    },
    className: {
      control: 'text',
      description: 'Merged after the align / spacing variants — the override seam.',
      table: { category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SectionHeader>;

export const Default: Story = {
  args: {
    title: 'See it in action',
    tagline:
      'Clean configuration, powerful protection. Works with ESLint 8 and 9, flat config or legacy.',
    align: 'center',
    spacing: 'lg',
    as: 'h2',
  },
};

export const WithEyebrow: Story = {
  args: {
    eyebrow: (
      <span className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card px-3 py-1 text-xs font-medium text-fd-muted-foreground">
        <Trophy className="size-3.5 text-orange-500" aria-hidden />
        Featured in DEV Community Top 7
      </span>
    ),
    title: 'Trusted by developers',
    tagline: 'Security insights from teams shipping production JavaScript.',
  },
};

export const TitleOnly: Story = {
  args: {
    title: 'How it works',
  },
};

export const LeftAligned: Story = {
  args: {
    title: 'Long-form rule docs',
    tagline:
      'When the section sits inside a prose-width container, the start alignment keeps the eye on the gutter.',
    align: 'start',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div>
      <SectionHeader title="Centered (default)" tagline="Tagline takes max-w-prose under the headline." />
      <SectionHeader
        align="start"
        title="Left-aligned"
        tagline="Used inside prose-width containers."
      />
      <SectionHeader
        eyebrow={
          <span className="rounded-full border border-fd-border bg-fd-card px-3 py-1 text-xs font-medium text-fd-muted-foreground">
            With eyebrow
          </span>
        }
        title="Eyebrow above"
        tagline="Use the eyebrow slot for chips / badges that frame the section."
      />
    </div>
  ),
};
