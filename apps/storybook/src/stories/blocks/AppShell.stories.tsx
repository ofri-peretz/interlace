import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bell, Compass, House, Search, User } from 'lucide-react';
import { expect, within } from 'storybook/test';
import { AppShell } from '@interlace/ui/patterns/app-shell';
import { AppHeader } from '@interlace/ui/patterns/app-header';
import { TabBar } from '@interlace/ui/patterns/tab-bar';
import { Button } from '@interlace/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@interlace/ui/card';
import { withRtl } from '@/decorators';

const TABS = [
  { href: '/', label: 'Home', icon: <House /> },
  { href: '/explore', label: 'Explore', icon: <Compass /> },
  { href: '/updates', label: 'Updates', icon: <Bell />, badge: 2, badgeLabel: '2 new' },
  { href: '/me', label: 'Profile', icon: <User /> },
];

const meta = {
  title: 'Blocks/AppShell',
  component: AppShell,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The frame of an app-like page on a phone: a sticky `AppHeader`, a `<main>` that takes the room between, and a sticky `TabBar`. A column at least `100dvh` tall with nothing fixed-position, so the last line of content always scrolls clear of the tab bar and an on-screen keyboard never drags a bar into the page. For a home-screen app, set `viewport-fit=cover` in the viewport meta; every part pads itself by the safe areas.',
      },
    },
  },
  args: {
    header: (
      <AppHeader
        title="Home"
        largeTitle
        end={
          <Button variant="ghost" size="icon" aria-label="Search">
            <Search />
          </Button>
        }
      />
    ),
    tabBar: <TabBar items={TABS} currentHref="/" hideFrom="never" />,
  },
  render: (args) => (
    <AppShell {...args} className="bg-background text-foreground min-h-[36rem]">
      <div className="grid gap-4 p-4">
        {['Your next session', 'Picked for you', 'From the community'].map((title) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              Cards, lists and forms go in the main column, between the two bars.
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  ),
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Header with a large title, content, tab bar. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('main')).toBeTruthy();
    await expect(canvas.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    await expect(canvas.getByRole('heading', { level: 1, name: 'Home' })).toBeTruthy();
  },
};

/** Right to left. */
export const RightToLeft: Story = {
  decorators: [withRtl],
};
