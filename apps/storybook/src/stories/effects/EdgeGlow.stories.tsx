import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@interlace/ui/card';
import { EdgeGlow } from '@interlace/ui/effects/edge-glow';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof EdgeGlow> = {
  title: 'Effects/EdgeGlow',
  component: EdgeGlow,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A light that runs around the edge of its parent, following its corner radius. Drop it inside a `Card` (already positioned) to mark the recommended plan or the live item. Hidden from assistive tech and the pointer. Under reduced motion the arc holds still at the top-left corner, so the card is still marked.',
      },
    },
  },
  argTypes: {
    from: { control: 'text', table: { defaultValue: { summary: 'var(--primary)' } } },
    to: { control: 'text', table: { defaultValue: { summary: 'var(--chart-2)' } } },
    width: { control: { type: 'number', min: 0.5, step: 0.5 }, table: { defaultValue: { summary: '1.5' } } },
    length: { control: { type: 'range', min: 0.05, max: 1, step: 0.05 }, table: { defaultValue: { summary: '0.2' } } },
    duration: { control: { type: 'number', min: 1, step: 1 }, table: { defaultValue: { summary: '8' } } },
    direction: { control: 'inline-radio', options: ['clockwise', 'counterclockwise'], table: { defaultValue: { summary: 'clockwise' } } },
  },
  render: (args) => (
    <Card className="w-80">
      <EdgeGlow {...args} />
      <CardHeader>
        <CardTitle>Recommended</CardTitle>
        <CardDescription>The plan most readers pick.</CardDescription>
      </CardHeader>
      <CardContent>Everything in Basic, plus sourced answers by email.</CardContent>
    </Card>
  ),
};

export default meta;
type Story = StoryObj<typeof EdgeGlow>;

export const Default: Story = {};
export const LongArc: Story = { args: { length: 0.45, width: 2 } };
