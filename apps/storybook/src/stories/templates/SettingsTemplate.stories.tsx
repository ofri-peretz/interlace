import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsTemplate } from '@interlace/ui/templates/settings-template';
import { Button } from '@interlace/ui/button';
import { Field, FieldControl, FieldLabel } from '@interlace/ui/form';
import { Input } from '@interlace/ui/input';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof SettingsTemplate> = {
  title: 'Templates/SettingsTemplate',
  component: SettingsTemplate,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Account/app settings surface — topbar, section rail, and the active section's content. The active section comes from the consumer's router (one route per section), not internal state, so the template stays a server component. Below 480px the rail becomes a horizontal scroller above the content.",
      },
    },
  },
  argTypes: {
    topbar: { control: 'object', description: 'Props forwarded to Topbar.', table: { category: 'Data' } },
    title: { control: 'text', description: 'Page heading above the rail.', table: { category: 'Content' } },
    sections: { control: 'object', description: 'Rail entries — { id, label, href }. Each is a real route, not a tab.', table: { category: 'Data' } },
    activeSection: { control: 'text', description: 'Which section id is current. Driven by the router, not by state.', table: { category: 'State' } },
    children: { control: false, description: 'The active section body.', table: { category: 'Slots', type: { summary: 'ReactNode' } } },
  },
};

export default meta;
type Story = StoryObj<typeof SettingsTemplate>;

const logo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-6 rounded-md bg-linear-to-br from-primary to-chart-2"
    />
    <span>Interlace App</span>
  </a>
);

const sampleSections = [
  { id: 'profile', label: 'Profile', href: '#profile' },
  { id: 'account', label: 'Account', href: '#account' },
  { id: 'billing', label: 'Billing', href: '#billing' },
  { id: 'team', label: 'Team', href: '#team' },
  { id: 'security', label: 'Security', href: '#security' },
];

export const Profile: Story = {
  args: {
    topbar: { logo },
    sections: sampleSections,
    activeSection: 'profile',
    children: (
      <form className="border-border bg-card rounded-lg border p-md flex flex-col gap-md">
        <Field>
          <FieldLabel>Display name</FieldLabel>
          {/* `render=`, not children — see AuthTemplate.stories.tsx. */}
          <FieldControl render={<Input placeholder="Ada Lovelace" />} />
        </Field>
        <Field>
          <FieldLabel>Bio</FieldLabel>
          <FieldControl render={<Input placeholder="Engineer @ Interlace" />} />
        </Field>
        <div className="flex gap-sm">
          <Button>Save</Button>
          <Button variant="outline">Cancel</Button>
        </div>
      </form>
    ),
  },
};

export const Dark: Story = { ...Profile, decorators: [withDark] };
export const RTL: Story = { ...Profile, decorators: [withRtl] };

/**
 * PageSkeleton — the page-level loading state a consumer renders from
 * `loading.tsx` while the whole route is in flight. Shapes mirror the
 * real layout so the swap costs no layout shift (R23).
 */
export const PageSkeleton: Story = {
  render: () => <SettingsTemplate.Skeleton />,
};
