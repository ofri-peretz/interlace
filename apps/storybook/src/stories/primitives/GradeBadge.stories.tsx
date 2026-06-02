import type { Meta, StoryObj } from '@storybook/react-vite';
import { GradeBadge, GRADE_VALUES } from '@interlace/ui/grade-badge';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof GradeBadge> = {
  title: 'Primitives/GradeBadge',
  component: GradeBadge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Visual grade pill — A+ / A / A- / B+ / B / … / F. Drives scorecard pages. 13-grade ladder maps to 5 tones (excellent/good/fair/poor/fail); each tone clears WCAG 2.2 AAA in both modes.',
      },
    },
  },
  argTypes: {
    grade: { control: 'select', options: GRADE_VALUES },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;
type Story = StoryObj<typeof GradeBadge>;

export const Default: Story = { args: { grade: 'A+' } };

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

export const Dark: Story = { ...Ladder, decorators: [withDark] };
export const RTL: Story = { ...Ladder, decorators: [withRtl] };
