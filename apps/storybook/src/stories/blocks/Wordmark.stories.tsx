import type { Meta, StoryObj } from '@storybook/react-vite';
import { Section } from '@interlace/ui/section';
import { Topbar } from '@interlace/ui/patterns/topbar';
import { Wordmark } from '@interlace/ui/patterns/wordmark';

// Placeholder name: "hello" in Hebrew, Arabic and English.
const LINES = (
  <>
    <Wordmark.Line lang="he" dir="rtl">
      שלום
    </Wordmark.Line>
    <Wordmark.Line lang="ar" dir="rtl">
      مرحبا
    </Wordmark.Line>
    <Wordmark.Line lang="en">HELLO</Wordmark.Line>
  </>
);

const meta = {
  title: 'Blocks/Wordmark',
  component: Wordmark,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A name in more than one script, stacked, each line with its own `lang` and `dir`. ' +
          '`variant="sign"` is a street-sign plate; `plain` is the lines alone in the text colour. ' +
          'With `href` it is one link named by `label`; without, an image of text. Arabic lines use ' +
          '`--font-arabic` when the site defines it. It fits `Topbar`’s `logo` slot, which grows to hold it.',
      },
    },
  },
  args: { label: 'Hello, home', href: '#', children: LINES },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['sign', 'plain'],
      table: { category: 'Appearance', defaultValue: { summary: 'sign' } },
    },
    children: { control: false },
  },
} satisfies Meta<typeof Wordmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Both variants on a brand band: the plain lockup takes the band's text colour. */
export const OnABrandBand: Story = {
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <Section tone="brand" spacing="tight">
      <div className="flex items-center gap-10">
        <Wordmark {...args} />
        <Wordmark {...args} variant="plain" />
      </div>
    </Section>
  ),
};

/** In the Topbar's logo slot: the row grows to fit the stacked lines. */
export const InTheTopbar: Story = {
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <Topbar
      logo={<Wordmark {...args} />}
      links={[
        { href: '#questions', label: 'Questions' },
        { href: '#practice', label: 'Practice a talk' },
        { href: '#about', label: 'About us' },
      ]}
    />
  ),
};
