import { UnderlineLink } from '@interlace/ui/effects/underline-link';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof UnderlineLink> = {
  title: 'Effects/UnderlineLink',
  component: UnderlineLink,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A text link whose underline draws itself in when the reader points at it or tabs to it, from the inline-start edge. A thin underline stays at rest by default, so a link is never told apart by colour alone. CSS only; works as a server component; `render` swaps in a router link.',
      },
    },
  },
  argTypes: {
    rest: { control: 'inline-radio', options: ['thin', 'none'], table: { defaultValue: { summary: 'thin' } } },
    tone: { control: 'inline-radio', options: ['inherit', 'primary'], table: { defaultValue: { summary: 'inherit' } } },
  },
};

export default meta;
type Story = StoryObj<typeof UnderlineLink>;

export const Default: Story = {
  args: { rest: 'thin', tone: 'primary', href: '#history' },
  render: (args) => (
    <p className="text-foreground max-w-prose text-lg leading-relaxed">
      The bridge opened in the spring. You can read <UnderlineLink {...args}>how the river was surveyed</UnderlineLink>{' '}
      before the first pier went in.
    </p>
  ),
};

/** A nav bar, where every item is plainly a link, can drop the line at rest. */
export const Navigation: Story = {
  render: () => (
    <nav aria-label="Example" className="flex gap-6 text-sm font-medium">
      {['Overview', 'Sessions', 'Research', 'About'].map((item) => (
        <UnderlineLink key={item} href={`#${item.toLowerCase()}`} rest="none">
          {item}
        </UnderlineLink>
      ))}
    </nav>
  ),
};

/** In a right-to-left line the underline grows from the right. */
export const RightToLeft: Story = {
  render: () => (
    <p dir="rtl" lang="ar" className="text-foreground max-w-prose text-lg">
      اقرأ <UnderlineLink href="#survey" tone="primary">كيف جرى مسح النهر</UnderlineLink> قبل بناء الجسر.
    </p>
  ),
};
