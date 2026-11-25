import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bell, Compass, House, MessageCircleQuestion, User } from 'lucide-react';
import { expect, within } from 'storybook/test';
import { TabBar, type TabBarItem } from '@interlace/ui/patterns/tab-bar';
import { withRtl } from '@/decorators';

const ITEMS: TabBarItem[] = [
  { href: '/', label: 'Home', icon: <House /> },
  { href: '/explore', label: 'Explore', icon: <Compass /> },
  { href: '/questions', label: 'Questions', icon: <MessageCircleQuestion />, badge: 3, badgeLabel: '3 new answers' },
  { href: '/updates', label: 'Updates', icon: <Bell />, badge: true, badgeLabel: 'new updates' },
  { href: '/me', label: 'Profile', icon: <User /> },
];

/** A short screen, so the bar sits at the bottom of the frame as it would on a phone. */
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground flex min-h-[28rem] flex-col">
      <div className="flex-1 space-y-3 p-4">
        <p className="text-muted-foreground text-sm">The page scrolls above the bar; its last line always clears it.</p>
      </div>
      {children}
    </div>
  );
}

const meta = {
  title: 'Blocks/TabBar',
  component: TabBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Three to five destinations at the bottom of a phone screen. Each tab is a link with an icon and a word; the current one gets `aria-current="page"`, a filled pill and a heavier label, so it never depends on colour. `currentHref` keeps a parent tab current on its child pages. It sticks to the bottom and pads itself by the safe areas; `hideFrom` hides it where a Topbar takes over (md by default). `renderLink` is the seam for a router link.',
      },
    },
  },
  args: { items: ITEMS, currentHref: '/questions/12', hideFrom: 'never' },
  render: (args) => (
    <Screen>
      <TabBar {...args} />
    </Screen>
  ),
} satisfies Meta<typeof TabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Five tabs, the third current on one of its child pages, with a count and a dot. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole('navigation', { name: 'Primary' });
    await expect(within(nav).getAllByRole('link')).toHaveLength(5);
    await expect(canvas.getByRole('link', { current: 'page' }).getAttribute('href')).toBe('/questions');
  },
};

/** Three tabs share the width. */
export const ThreeTabs: Story = {
  args: { items: ITEMS.slice(0, 3), currentHref: '/' },
};

/** Long labels wrap onto a second line instead of being cut. */
export const LongLabels: Story = {
  args: {
    items: [
      { href: '/', label: 'Home', icon: <House /> },
      { href: '/library', label: 'Saved for later', icon: <Compass /> },
      { href: '/me', label: 'Account settings', icon: <User /> },
    ],
    currentHref: '/library',
  },
};

/** Right to left: the order and the badges mirror. */
export const RightToLeft: Story = {
  decorators: [withRtl],
};
