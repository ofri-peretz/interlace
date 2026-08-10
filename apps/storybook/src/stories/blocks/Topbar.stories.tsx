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
          'The one row every landing, docs and dashboard surface starts with: logo left, primary nav centre-right, action cluster right. Sticky with a translucent backdrop blur, so content scrolls visibly underneath without a colour seam.\n\n' +
          'It is framework-agnostic on purpose. `logo` is a slot rather than an `href`, and `renderLink` is the seam a Next.js or React Router consumer passes its own `<Link>` through — the DS never imports a router. External links opt out of that seam entirely and always render a plain `<a target="_blank">` with a trailing ↗.\n\n' +
          '**The link cluster is hidden below 768px and nothing replaces it.** That is deliberate — a drawer needs app state and a portal, so the consumer composes Sheet + Drawer for the hamburger. If your only navigation is in `links`, the mobile view has no navigation at all.',
      },
    },
  },
  argTypes: {
    logo: {
      control: false,
      description:
        'Wordmark or logo, wrapped by the caller in whatever link component it uses. A slot rather than an `href` prop because the DS cannot know which router is in the app.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    links: {
      control: 'object',
      description:
        'Primary nav: `{ href, label, external? }`. `external: true` forces a plain `<a target="_blank" rel="noopener noreferrer">` with a ↗ affix and bypasses `renderLink`. Hidden below 768px.',
      table: { type: { summary: 'TopbarLink[]' }, defaultValue: { summary: '[]' }, category: 'Data' },
    },
    actions: {
      control: false,
      description:
        'Right-aligned cluster — sign-in, a primary CTA, a theme toggle. Stays visible at every width, unlike `links`, so anything a phone user genuinely needs belongs here.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    containerSize: {
      control: 'inline-radio',
      options: ['wide', 'content', 'prose'],
      description:
        'Max-width of the inner row. Match it to the page beneath — a `wide` bar over a `prose` article leaves the logo floating away from the text it belongs to.',
      table: {
        type: { summary: "'wide' | 'content' | 'prose'" },
        defaultValue: { summary: 'wide' },
        category: 'Appearance',
      },
    },
    renderLink: {
      control: false,
      description:
        'Render prop for internal links — `({ href, className, children }) => ReactElement`. Defaults to a plain `<a>`, which is a full page load; pass your framework\'s Link to get SPA navigation. The `className` argument carries the DS link styling and must be forwarded.',
      table: { type: { summary: '(props) => ReactElement' }, category: 'Slots' },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the `<header>`. This is where `sticky top-0 z-10` lives — raise the z-index here if the page has an overlay that must sit under the bar.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Topbar>;

const sampleLogo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-6 rounded-md bg-linear-to-br from-primary to-chart-2"
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
    containerSize: 'wide',
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
