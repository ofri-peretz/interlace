import type { Meta, StoryObj } from '@storybook/react-vite';
import { Footer } from '@interlace/ui/patterns/footer';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof Footer> = {
  title: 'Blocks/Footer',
  component: Footer,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Site-wide footer landmark: a brand block beside one to four grouped link columns, ' +
          'over a tail row carrying the copyright and social links. Each group is its own ' +
          '`<nav>` labelled by its heading, and the column template widens with the number of ' +
          'groups. Internal links go through the `renderLink` slot so a Next.js app gets SPA ' +
          'navigation; external ones are always plain anchors with `rel="noopener noreferrer"`.',
      },
    },
  },
  argTypes: {
    brand: {
      control: false,
      description:
        'Brand mark plus tagline, rendered as the first (and widest) column. Not editable from Controls — pass a node in code.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    groups: {
      control: 'object',
      description:
        'The link columns. Each is `{ title, links: [{ href, label, external? }] }`; `title` labels the column\'s `<nav>`, and an `external` link renders a plain anchor with a ↗ affordance and `target="_blank"`. Beyond four groups the grid template stops widening.',
      table: {
        category: 'Data',
        type: {
          summary:
            'Array<{ title: string; links: Array<{ href: string; label: ReactNode; external?: boolean }> }>',
        },
        defaultValue: { summary: '[]' },
      },
    },
    copyright: {
      control: 'text',
      description: 'Left side of the tail row. The whole tail row is omitted when both this and `social` are absent.',
      table: { category: 'Content', type: { summary: 'ReactNode' } },
    },
    social: {
      control: false,
      description:
        'Right side of the tail row — icon links or extra chrome. Not editable from Controls; pass nodes in code.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    containerSize: {
      control: 'select',
      options: ['wide', 'content', 'prose'],
      description:
        'Max width of the inner container. Match it to the page it closes — a `prose` footer under a `wide` page reads as misaligned.',
      table: {
        category: 'Appearance',
        type: { summary: "'wide' | 'content' | 'prose'" },
        defaultValue: { summary: 'wide' },
      },
    },
    renderLink: {
      control: false,
      description:
        'Render-prop for INTERNAL links only, defaulting to a plain `<a>`. A Next.js consumer passes `({ href, className, children }) => <Link …>` to keep footer navigation client-side. External links ignore it by design.',
      table: {
        category: 'Slots',
        type: {
          summary:
            '(props: { href: string; className: string; children: ReactNode }) => ReactElement',
        },
        defaultValue: { summary: 'plain <a>' },
      },
    },
    className: {
      control: 'text',
      description: 'Merged onto the `<footer>` landmark — the seam for the top border and surface colour.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Footer>;

const sampleBrand = (
  <div>
    <div className="flex items-center gap-2 font-semibold">
      <span
        aria-hidden
        className="inline-block size-6 rounded-md bg-linear-to-br from-primary to-chart-2"
      />
      <span>Interlace</span>
    </div>
    <p className="text-muted-foreground mt-2 text-sm max-w-80">
      Production-grade React primitives for the modern web.
    </p>
  </div>
);

const sampleGroups = [
  {
    title: 'Product',
    links: [
      { href: '/docs', label: 'Docs' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/changelog', label: 'Changelog' },
    ],
  },
  {
    title: 'Community',
    links: [
      { href: 'https://github.com', label: 'GitHub', external: true },
      { href: 'https://twitter.com', label: 'X', external: true },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
];

const sampleSocial = (
  <>
    <a
      href="https://github.com"
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
    >
      GitHub
    </a>
    <a
      href="https://twitter.com"
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
    >
      X
    </a>
  </>
);

export const Default: Story = {
  args: {
    brand: sampleBrand,
    groups: sampleGroups,
    copyright: '© 2026 Interlace. All rights reserved.',
    social: sampleSocial,
    containerSize: 'wide',
  },
};

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
