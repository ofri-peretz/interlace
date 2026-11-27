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

type Looks = { variant?: 'framed' | 'plain'; size?: 'md' | 'sm' | 'responsive' };

// A link named by its lines, plus a hidden ", home": the form for a wordmark in several scripts.
// It has no `label`, so the name is the three lines, each read in its own language.
const ByLines = ({ variant, size }: Looks) => (
  <Wordmark href="#" hint=", home" variant={variant} size={size}>
    {SCRIPTS}
  </Wordmark>
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
          '`plain` is the lines alone in the text colour. `size="sm"` is about two thirds; `responsive` is `sm` on a phone, ' +
          '`md` from the `md` breakpoint, for a sticky topbar. With `href` it is one link, named by its lines (plus an optional `hint`) or by a `label` that contains them; ' +
          'without, an image of text named by `label`. Lines use `--font-heading`: add a font for another script to that stack and the ' +
          'browser picks one per glyph. It fits `Topbar`’s `logo` slot, which grows to hold it.',
      },
    },
  },
  args: { label: 'Acme Field notes, home', href: '#', children: TAGLINE },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['framed', 'plain'],
      table: { category: 'Appearance', defaultValue: { summary: 'framed' } },
    },
    size: {
      control: 'inline-radio',
      options: ['md', 'sm', 'responsive'],
      table: { category: 'Appearance', defaultValue: { summary: 'md' } },
    },
    children: { control: false },
  },
} satisfies Meta<typeof Wordmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One name in three scripts, each line with its own `lang`; the Arabic line is `dir="rtl"`. */
export const SeveralScripts: Story = {
  args: { children: SCRIPTS },
  render: (args) => <ByLines {...args} />,
};

/**
 * The wrong form, kept to show what the docs warn about: the `label` does not contain the other two
 * lines, so a voice-control user who says "click アクメ" finds nothing (WCAG 2.5.3, Label in Name).
 * Excluded from the axe sweep on purpose; the unit test asserts that axe flags it.
 */
export const LabelThatDoesNotMatch: Story = {
  parameters: { a11y: { skip: true } },
  args: { label: 'Acme, home', children: SCRIPTS },
};

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

/** The three sizes side by side. `responsive` is `sm` below the `md` breakpoint, `md` from it. */
export const Sizes: Story = {
  args: { children: SCRIPTS },
  render: (args) => (
    <div className="flex items-center gap-8">
      <ByLines {...args} size="md" />
      <ByLines {...args} size="sm" />
      <ByLines {...args} size="responsive" />
    </div>
  ),
};

/** In the Topbar's logo slot: the row grows to fit the stacked lines. */
export const InTheTopbar: Story = {
  args: { children: SCRIPTS },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <Topbar
      logo={<ByLines {...args} />}
      links={[
        { href: '#questions', label: 'Questions' },
        { href: '#practice', label: 'Practice a talk' },
        { href: '#about', label: 'About us' },
      ]}
    />
  ),
};
