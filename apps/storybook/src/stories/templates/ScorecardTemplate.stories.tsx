import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScorecardTemplate } from '@interlace/ui/templates/scorecard-template';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof ScorecardTemplate> = {
  title: 'Templates/ScorecardTemplate',
  component: ScorecardTemplate,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Graded-evaluation report — an overall grade header over per-dimension ScorecardRow entries, with an optional methodology note. Built for Lighthouse-style reports and plugin scorecards. Each dimension streams independently, so the overall grade paints before the detail rows resolve.",
      },
    },
  },
  argTypes: {
    topbar: { control: 'object', description: 'Props forwarded to Topbar.', table: { category: 'Data' } },
    title: { control: 'text', description: 'What was graded.', table: { category: 'Content' } },
    lead: { control: 'text', description: 'One-line summary under the title.', table: { category: 'Content' } },
    overall: { control: 'object', description: 'Headline grade + score for the whole evaluation.', table: { category: 'Data' } },
    dimensions: { control: 'object', description: 'Per-dimension rows — name, grade, score, caption.', table: { category: 'Data' } },
    methodology: { control: 'text', description: 'How the grades were computed. Omit to drop the footnote.', table: { category: 'Content' } },
    footer: { control: 'object', description: 'Props forwarded to Footer.', table: { category: 'Data' } },
  },
};

export default meta;
type Story = StoryObj<typeof ScorecardTemplate>;

const logo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-6 rounded-md bg-linear-to-br from-primary to-chart-2"
    />
    <span>Interlace</span>
  </a>
);

export const Default: Story = {
  args: {
    topbar: { logo, links: [{ href: '/', label: 'Home' }] },
    title: 'Flagship Scorecard',
    lead:
      'Per-rule latency, findings, and head-to-head numbers for the 10 flagship rules — measured, dated, sourced.',
    overall: { grade: 'A', score: 92, caption: '12 of 14 dimensions passing' },
    dimensions: [
      {
        name: 'Performance',
        grade: 'A',
        score: 95,
        caption: 'p95 latency under 12ms on every flagship rule.',
      },
      {
        name: 'Coverage',
        grade: 'A-',
        score: 90,
        caption: '88 of 95 cases caught across 5 OSS repos.',
      },
      {
        name: 'Adoption',
        grade: 'B+',
        score: 88,
        caption: '2.1M weekly installs across the ecosystem.',
      },
      {
        name: 'Documentation',
        grade: 'A+',
        score: 98,
        caption: 'Every rule has a docs page + example fix.',
      },
      {
        name: 'CI velocity',
        grade: 'C+',
        score: 78,
        caption: '8-min full ESLint pass — bench median.',
      },
    ],
    methodology:
      'Scores derived from the ILB-Flagship bench suite. See benchmarks/results/ilb-flagship for the raw JSON snapshots.',
    footer: { copyright: '© 2026 Interlace.' },
  },
};

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };

/**
 * PageSkeleton — the page-level loading state a consumer renders from
 * `loading.tsx` while the whole route is in flight. Shapes mirror the
 * real layout so the swap costs no layout shift (R23).
 */
export const PageSkeleton: Story = {
  render: () => <ScorecardTemplate.Skeleton />,
};
