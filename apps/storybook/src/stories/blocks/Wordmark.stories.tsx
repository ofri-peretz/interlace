import type { Meta, StoryObj } from '@storybook/react-vite';
import { Section } from '@interlace/ui/section';
import { Topbar } from '@interlace/ui/patterns/topbar';
import { Wordmark } from '@interlace/ui/patterns/wordmark';

// Placeholder brand "Acme": a name over its tagline, and one name in three scripts.
const TAGLINE = (
  <>
    <Wordmark.Line lang="en">ACME</Wordmark.Line>
    <Wordmark.Line lang="en">Field notes</Wordmark.Line>
  </>
);
const SCRIPTS = (
  <>
    <Wordmark.Line lang="en">ACME</Wordmark.Line>
    <Wordmark.Line lang="ja">アクメ</Wordmark.Line>
    <Wordmark.Line lang="ar" dir="rtl">
      أكمي
    </Wordmark.Line>
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
          'A text logo of stacked lines: a name over its tagline, or one name in several scripts, each line ' +
          'with its own `lang` and `dir`. `variant="framed"` is a plate with an inset rule in the brand colour; ' +
          '`plain` is the lines alone in the text colour. With `href` it is one link named by `label`; without, ' +
          'an image of text. Lines use `--font-heading`: add a font for another script to that stack and the ' +
          'browser picks one per glyph. It fits `Topbar`’s `logo` slot, which grows to hold it.',
      },
    },
  },
  args: { label: 'Acme, home', href: '#', children: TAGLINE },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['framed', 'plain'],
      table: { category: 'Appearance', defaultValue: { summary: 'framed' } },
    },
    children: { control: false },
  },
} satisfies Meta<typeof Wordmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One name in three scripts, each line with its own `lang`; the Arabic line is `dir="rtl"`. */
export const SeveralScripts: Story = { args: { children: SCRIPTS } };

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
