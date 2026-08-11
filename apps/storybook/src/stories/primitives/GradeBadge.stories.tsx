import type { Meta, StoryObj } from '@storybook/react-vite';
import { GradeBadge, GRADE_VALUES } from '@interlace/ui/grade-badge';
import { withRtl } from '@/decorators';

const meta: Meta<typeof GradeBadge> = {
  title: 'Primitives/GradeBadge',
  component: GradeBadge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A single letter-grade chip for scorecard surfaces — it states a tier so the reader never has to convert a raw score into a judgement. The colour is derived, not passed: `grade` is the only input, and the 13-step ladder collapses onto five tones (A* excellent, B* good, C* fair, D* poor, F fail). Use it where a verdict is the payload; use `Badge` for neutral metadata and `Progress` when the magnitude, not the tier, is the point.',
      },
    },
  },
  argTypes: {
    grade: {
      control: 'select',
      options: GRADE_VALUES,
      description:
        'The grade itself, and the only colour input — the tone (and therefore the background/foreground token pair) is looked up from it. Also rendered as the chip text and as `aria-label="Grade: …"`.',
      table: {
        category: 'Data',
        type: { summary: "'A+' | 'A' | 'A-' | 'B+' | … | 'F'" },
      },
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description:
        'Chip scale. `sm` for dense table cells, `md` inline in prose or a list row, `lg` as the headline verdict on a scorecard.',
      table: {
        category: 'Appearance',
        type: { summary: "'sm' | 'md' | 'lg'" },
        defaultValue: { summary: 'md' },
      },
    },
    className: {
      control: 'text',
      description:
        'Merged via `cn()` after the variant classes, so it can override the tone — do that only for a deliberate, contrast-checked exception.',
      table: { category: 'Appearance' },
    },
    // NOTE: there is deliberately no `tone` or `children` control. `tone` is
    // derived from `grade` (GRADE_TONE_MAP) and `children` is Omit-ed from the
    // props type — the chip always renders its own grade text.
  },
};

export default meta;
type Story = StoryObj<typeof GradeBadge>;

export const Default: Story = {
  args: { grade: 'A+', size: 'md', className: '' },
  // Shown in the row it was built for — a chip alone in the canvas hides the
  // one thing that matters, that the colour is legible next to real copy.
  render: (args) => (
    <div className="flex w-full max-w-float items-center justify-between rounded-md border border-fd-border px-4 py-3">
      <div className="flex flex-col">
        <span className="text-sm font-medium">eslint-plugin-jwt</span>
        <span className="text-xs text-muted-foreground">Security scorecard</span>
      </div>
      <GradeBadge {...args} />
    </div>
  ),
};

export const Ladder: Story = {
  render: () => (
    <div className="flex flex-wrap gap-sm">
      {GRADE_VALUES.map((grade) => (
        <GradeBadge key={grade} grade={grade} />
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-sm">
      <GradeBadge grade="A+" size="sm" />
      <GradeBadge grade="A+" size="md" />
      <GradeBadge grade="A+" size="lg" />
    </div>
  ),
};

export const Dark: Story = { ...Ladder, globals: { theme: 'dark' } };
export const RTL: Story = { ...Ladder, decorators: [withRtl] };
