import type { Meta, StoryObj } from '@storybook/react-vite';
import { Search, Share } from 'lucide-react';
import { expect, within } from 'storybook/test';
import { AppHeader, AppHeaderBack } from '@interlace/ui/patterns/app-header';
import { Button } from '@interlace/ui/button';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Blocks/AppHeader',
  component: AppHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The bar at the top of an app-like view: a way back at the start, the title in the middle, one or two actions at the end. It sticks, clears the notch (`env(safe-area-inset-top)`), and shows its surface once content scrolls under it (`edge="scroll"`, the default). `largeTitle` sets the title big under the bar; once it scrolls away the small title fades into the bar, and the title is still read only once. `AppHeaderBack` is the start link, with an arrow that mirrors in RTL.',
      },
    },
  },
  args: {
    title: 'Saved questions',
    start: <AppHeaderBack href="/" label="Home" />,
    end: (
      <Button variant="ghost" size="icon" aria-label="Search">
        <Search />
      </Button>
    ),
  },
  render: (args) => (
    <div className="bg-background text-foreground min-h-[24rem]">
      <AppHeader {...args} />
      <div className="text-muted-foreground space-y-3 p-4 text-sm">
        <p>Scroll the page: the bar gains its surface once content passes beneath it.</p>
      </div>
    </div>
  ),
} satisfies Meta<typeof AppHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Back, title and an action. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 1, name: 'Saved questions' })).toBeTruthy();
    await expect(canvas.getByRole('link', { name: 'Home' })).toBeTruthy();
  },
};

/** A top-level view: a large title that collapses into the bar on scroll. */
export const LargeTitle: Story = {
  args: { title: 'Today', largeTitle: true, start: undefined },
  render: (args) => (
    <div className="bg-background text-foreground">
      <AppHeader {...args} />
      <div className="space-y-4 p-4">
        {Array.from({ length: 12 }, (_, i) => `Item ${i + 1}`).map((item) => (
          <p key={item} className="text-muted-foreground text-sm">
            {item}. Scroll up to see the title move into the bar.
          </p>
        ))}
      </div>
    </div>
  ),
};

/** An arrow alone, and two actions. */
export const IconOnlyBack: Story = {
  args: {
    start: <AppHeaderBack href="/" label="Back to questions" iconOnly />,
    end: (
      <>
        <Button variant="ghost" size="icon" aria-label="Share">
          <Share />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Search">
          <Search />
        </Button>
      </>
    ),
    edge: 'always',
  },
};

/** Right to left: the back arrow points the other way. */
export const RightToLeft: Story = {
  decorators: [withRtl],
};
