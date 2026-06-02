import type { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardTemplate } from '@interlace/ui/templates/dashboard-template';
import { Button } from '@interlace/ui/button';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof DashboardTemplate> = {
  title: 'Templates/DashboardTemplate',
  component: DashboardTemplate,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof DashboardTemplate>;

const logo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-6 rounded-md bg-linear-to-br from-violet-500 to-violet-700"
    />
    <span>Interlace App</span>
  </a>
);

const sampleSidebar = (
  <nav className="p-md text-sm">
    <ul className="flex flex-col gap-xs text-muted-foreground">
      <li><a href="/" className="hover:text-foreground block rounded-md px-sm py-xs">Overview</a></li>
      <li><a href="/projects" className="hover:text-foreground block rounded-md px-sm py-xs">Projects</a></li>
      <li><a href="/team" className="hover:text-foreground block rounded-md px-sm py-xs">Team</a></li>
      <li><a href="/settings" className="hover:text-foreground block rounded-md px-sm py-xs">Settings</a></li>
    </ul>
  </nav>
);

const sampleHeader = (
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-h2 font-semibold tracking-heading">Overview</h1>
      <p className="text-muted-foreground text-sm mt-xs">
        What&apos;s happening in your workspace today.
      </p>
    </div>
    <Button>New project</Button>
  </div>
);

export const Default: Story = {
  args: {
    topbar: { logo },
    sidebar: sampleSidebar,
    header: sampleHeader,
    children: (
      <div className="grid grid-cols-1 gap-md md:grid-cols-3">
        {['Active', 'In review', 'Shipped'].map((label) => (
          <div
            key={label}
            className="border-border bg-card rounded-lg border p-md"
          >
            <div className="text-muted-foreground text-sm">{label}</div>
            <div className="text-h2 font-semibold mt-xs">12</div>
          </div>
        ))}
      </div>
    ),
  },
};

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
