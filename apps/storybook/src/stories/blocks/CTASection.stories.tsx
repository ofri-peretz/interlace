import type { Meta, StoryObj } from '@storybook/react-vite';
import { CTASection } from '@interlace/ui/patterns/cta-section';
import { Button } from '@interlace/ui/button';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof CTASection> = {
  title: 'Blocks/CTASection',
  component: CTASection,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Call-to-action section. Title + description + 1-2 buttons on a tinted surface. Three tones: subtle (default), primary, neutral.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CTASection>;

export const Default: Story = {
  args: {
    title: 'Ship your design system today',
    description:
      'Drop-in primitives, R1-R26 enforced API, every story a11y-scanned in CI. Install with one npx command.',
    actions: (
      <>
        <Button size="lg">Get started</Button>
        <Button variant="outline" size="lg">
          Read the docs
        </Button>
      </>
    ),
  },
};

export const Primary: Story = { args: { ...Default.args, tone: 'primary' } };
export const Neutral: Story = { args: { ...Default.args, tone: 'neutral' } };
export const Loading: Story = { args: { loading: true } };
export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
