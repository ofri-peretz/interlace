import type { Meta, StoryObj } from '@storybook/react-vite';
import { Topbar } from '@interlace/ui/patterns/topbar';
import { Button } from '@interlace/ui/button';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof Topbar> = {
  title: 'Blocks/Topbar',
  component: Topbar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Site-wide horizontal navigation. Logo (left), nav links (middle, hidden on mobile), actions (right). Sticky-top with semi-transparent backdrop blur.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Topbar>;

const sampleLogo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-6 rounded-md bg-linear-to-br from-violet-500 to-violet-700"
    />
    <span>Interlace</span>
  </a>
);

const sampleLinks = [
  { href: '/docs', label: 'Docs' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
  { href: 'https://github.com', label: 'GitHub', external: true },
];

export const Default: Story = {
  args: {
    logo: sampleLogo,
    links: sampleLinks,
    actions: (
      <>
        <Button variant="ghost" size="sm">
          Sign in
        </Button>
        <Button size="sm">Get started</Button>
      </>
    ),
  },
};

export const NoActions: Story = {
  args: {
    logo: sampleLogo,
    links: sampleLinks,
  },
};

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
