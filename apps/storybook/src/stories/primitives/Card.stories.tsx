import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@interlace/ui/card';
import { Button } from '@interlace/ui/button';
import { withRtl } from '@/decorators';

const meta: Meta<typeof Card> = {
  title: 'Primitives/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Bounded surface for one self-contained unit that repeats — a plugin in a grid, a result in a list, a settings block. If the content is the page rather than an item on it, use `Section`/`Container` and skip the border. Composes `Box` for the surface floor: `bg-card`/`text-card-foreground` per `COLOR_PHILOSOPHY.md`, so contrast holds in both themes without override.',
      },
    },
  },
  // Card is a styled `Box` plus one state prop. Its structure comes from the
  // parts (`CardHeader` / `CardTitle` / `CardDescription` / `CardAction` /
  // `CardContent` / `CardFooter`) composed as children, not from props.
  argTypes: {
    loading: {
      control: 'boolean',
      description:
        'Swap the surface for a `<Skeleton variant="card" />` composite (title + body-line silhouette) that matches the card footprint, so a card grid does not reflow when data lands.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    className: {
      control: 'text',
      description:
        'The measure seam — Card fills its parent, so the caller sets width (or lets a grid do it). Also where you add hover/interactive affordances.',
      table: { category: 'Appearance' },
    },
    children: {
      control: false,
      description:
        '`CardHeader` (with `CardTitle` / `CardDescription` / optional `CardAction`), then `CardContent`, then `CardFooter`.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: { loading: false, className: 'w-[360px] max-w-full' },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Plugin: secure-coding</CardTitle>
        <CardDescription>
          31 rules covering tainted input, prototype pollution, and unsafe IO.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        Type-unaware. Drop-in for ESLint 9+ flat config.
      </CardContent>
      <CardFooter>
        <Button>Read docs</Button>
      </CardFooter>
    </Card>
  ),
};

/**
 * `loading` — the skeleton is shape-matched to the resolved card, so a grid
 * mid-fetch holds its geometry. Shown side by side to make that testable by
 * eye rather than by claim.
 */
export const Loading: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Card loading className="w-[360px] max-w-full" />
      <Card className="w-[360px] max-w-full">
        <CardHeader>
          <CardTitle>Plugin: secure-coding</CardTitle>
          <CardDescription>
            31 rules covering tainted input, prototype pollution, and unsafe IO.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Type-unaware. Drop-in for ESLint 9+ flat config.
        </CardContent>
        <CardFooter>
          <Button>Read docs</Button>
        </CardFooter>
      </Card>
    </div>
  ),
};
export const Dark: Story = {
  globals: { theme: 'dark' },
  parameters: { backgrounds: { default: 'dark' } },
  render: () => (
    <div className="dark">
      <Card className="w-[360px] max-w-full">
        <CardHeader>
          <CardTitle>Plugin: secure-coding</CardTitle>
          <CardDescription>
            31 rules covering tainted input, prototype pollution, and unsafe IO.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button>Read docs</Button>
        </CardFooter>
      </Card>
    </div>
  ),
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};
