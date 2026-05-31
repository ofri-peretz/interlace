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
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof SettingsTemplate>;

const logo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-6 rounded-md bg-linear-to-br from-violet-500 to-violet-700"
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
          <FieldControl>
            <Input placeholder="Ada Lovelace" />
          </FieldControl>
        </Field>
        <Field>
          <FieldLabel>Bio</FieldLabel>
          <FieldControl>
            <Input placeholder="Engineer @ Interlace" />
          </FieldControl>
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
