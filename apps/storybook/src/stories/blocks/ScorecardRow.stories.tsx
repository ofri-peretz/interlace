import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScorecardRow } from '@interlace/ui/patterns/scorecard-row';

const meta: Meta<typeof ScorecardRow> = {
  title: 'Blocks/ScorecardRow',
  component: ScorecardRow,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One dimension of a scorecard: name, letter grade, numeric score, and an ' +
          'optional detail slot. The score is tabular so a column of rows aligns on ' +
          'the digit, not on the glyph width — the reason a scorecard reads as a table ' +
          'even when it is a stack of articles.',
      },
    },
  },
  argTypes: {
    name: {
      control: 'text',
      description: 'The dimension being scored — the row\'s label column.',
      table: { type: { summary: 'ReactNode' } },
    },
    grade: {
      control: 'select',
      options: [
        'A+', 'A', 'A-',
        'B+', 'B', 'B-',
        'C+', 'C', 'C-',
        'D+', 'D', 'D-',
        'F',
      ],
      description:
        'Letter grade. The 13 rungs collapse onto five tones (excellent / good / fair / poor / fail) inside GradeBadge — the row does not pick a colour itself.',
      table: {
        type: { summary: "'A+' | 'A' | 'A-' | … | 'F'" },
        category: 'Data',
      },
    },
    score: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description:
        'Numeric score, 0–100. Rendered tabular so a column of rows aligns on the digit. Not derived from `grade` — the two are independent inputs, so keep them consistent at the call site.',
      table: { type: { summary: 'number' }, category: 'Data' },
    },
    caption: {
      control: 'text',
      description: 'Sub-line under the name — what the number is counting.',
      table: { type: { summary: 'ReactNode' } },
    },
    details: {
      control: false,
      description:
        'Expanded content under the header: a breakdown table, a sparkline, a list of failing checks. ReactNode, so the row never learns what any of those are.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    loading: {
      control: 'boolean',
      description:
        'Paint the resting shape while the aggregate query runs, so a column of rows does not reflow when the numbers land.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    className: {
      control: 'text',
      description: 'Merged onto the `<article>` — the border / padding seam.',
      table: { category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: 'Accessibility',
    grade: 'A',
    score: 94,
    caption: '18 of 19 checks passing',
    loading: false,
  },
  decorators: [
    // A single row alone in a 1200px canvas reads as a stray line of text; the
    // content-width frame is the width it actually ships at.
    (Story) => (
      <div className="w-full max-w-content">
        <Story />
      </div>
    ),
  ],
};

export const Grades: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The five tones across the 13-grade ladder. `poor` (D-tier) rides the ' +
          '`caution` token — the rung between warning and destructive that the DS ' +
          'added so this ladder stopped reaching outside the palette for an orange.',
      },
    },
  },
  render: () => (
    <div className="flex w-full max-w-content flex-col gap-2">
      <ScorecardRow name="Accessibility" grade="A+" score={99} caption="excellent" />
      <ScorecardRow name="Performance" grade="B" score={84} caption="good" />
      <ScorecardRow name="Bundle size" grade="C" score={71} caption="fair" />
      <ScorecardRow name="Test coverage" grade="D" score={58} caption="poor" />
      <ScorecardRow name="Type safety" grade="F" score={31} caption="fail" />
    </div>
  ),
};

export const WithDetails: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The `details` slot is a ReactNode, so a row can carry a breakdown table, a ' +
          'sparkline, or a list of failing checks without the component knowing what ' +
          'any of those are.',
      },
    },
  },
  args: {
    name: 'Rule coverage',
    grade: 'B+',
    score: 88,
    caption: '3 rules below threshold',
    details: (
      <ul className="flex flex-col gap-1 text-ui text-muted-foreground">
        <li>no-unsafe-regex — 62% of call sites</li>
        <li>require-error-cause — 71% of call sites</li>
        <li>no-sync-in-handler — 74% of call sites</li>
      </ul>
    ),
  },
};

export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Scorecards are assembled from an async aggregate, so the resting shape has ' +
          'to exist before the numbers do — otherwise the whole column reflows the ' +
          'moment the query returns.',
      },
    },
  },
  args: { name: '', grade: 'A', score: 0, loading: true },
};

export const Stack: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A full scorecard — what these rows are actually for.',
      },
    },
  },
  render: () => (
    <div className="flex w-full max-w-content flex-col gap-2">
      {[
        { name: 'Accessibility', grade: 'A+' as const, score: 99 },
        { name: 'Performance', grade: 'A-' as const, score: 91 },
        { name: 'Best practices', grade: 'B+' as const, score: 88 },
        { name: 'SEO', grade: 'A' as const, score: 95 },
      ].map((row) => (
        <ScorecardRow key={row.name} {...row} />
      ))}
    </div>
  ),
};
