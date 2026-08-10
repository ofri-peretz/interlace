import type { Meta, StoryObj } from '@storybook/react-vite';
import { Section } from '@interlace/ui/section';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof Section> = {
  title: 'Primitives/Section',
  component: Section,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The band a page is built from: vertical rhythm, background tone, transition dividers and the width contract, in one wrapper (LAYOUT_PHILOSOPHY.md §7-8). A page composes `<Section>` × N and only ever describes what is *in* each band — open-coding `<section className="container mx-auto px-4 py-24">` in app code is what this exists to stop. It always renders a `<Container>` inside, so do not nest another one; for a box inside a band, use `Card` or `Box`.',
      },
    },
  },
  argTypes: {
    spacing: {
      control: 'select',
      options: ['tight', 'comfortable', 'spacious', 'none'],
      description:
        'Vertical padding, responsive at every step (e.g. `comfortable` = `py-16 md:py-20 lg:py-24`). Every variant clears the §3 mobile/desktop section floors; `none` is the escape hatch for a band whose child owns its own padding.',
      table: {
        type: { summary: "'tight' | 'comfortable' | 'spacious' | 'none'" },
        defaultValue: { summary: 'comfortable' },
        category: 'Appearance',
      },
    },
    tone: {
      control: 'select',
      options: ['default', 'muted', 'inset'],
      description:
        'Background. `default` is transparent; `muted` (`bg-card/30`) separates adjacent bands without a rule; `inset` adds a backdrop blur for a strip that should read as a raised surface.',
      table: {
        type: { summary: "'default' | 'muted' | 'inset'" },
        defaultValue: { summary: 'default' },
        category: 'Appearance',
      },
    },
    divider: {
      control: 'select',
      options: ['none', 'top', 'bottom', 'both'],
      description:
        'Border at the section transition. Pick one side per boundary — `both` on every band doubles the rules between neighbours.',
      table: {
        type: { summary: "'none' | 'top' | 'bottom' | 'both'" },
        defaultValue: { summary: 'none' },
        category: 'Appearance',
      },
    },
    container: {
      control: 'select',
      options: ['prose', 'content', 'wide', 'full'],
      description:
        'Width of the `<Container>` wrapped around the children: `prose` 65ch, `content` 1024px, `wide` 1280px, `full` full-bleed with no horizontal padding.',
      table: {
        type: { summary: "'prose' | 'content' | 'wide' | 'full'" },
        defaultValue: { summary: 'content' },
        category: 'Appearance',
      },
    },
    as: {
      control: 'select',
      options: ['section', 'header', 'footer', 'aside', 'div'],
      description:
        'Element rendered for the band. Keep the semantic honest — `header` / `footer` / `aside` are landmarks, and `div` is for a band that carries no meaning of its own.',
      table: {
        type: { summary: "'section' | 'header' | 'footer' | 'aside' | 'div'" },
        defaultValue: { summary: 'section' },
        category: 'Structure',
      },
    },
    children: {
      control: false,
      description: 'Band content. Always mounted inside the `<Container>` — never add another one here.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    className: {
      control: 'text',
      description:
        'Merged after the variant classes — the seam for a one-off background image or a `min-h-screen` hero, not for re-specifying spacing.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Section>;

const SectionBody = ({ label }: { label: string }) => (
  <div className="rounded-md border border-dashed border-fd-border bg-fd-card/40 p-6 text-sm text-fd-muted-foreground">
    {label}
  </div>
);

export const Default: Story = {
  args: {
    spacing: 'comfortable',
    tone: 'default',
    divider: 'none',
    container: 'content',
    as: 'section',
  },
  render: (args) => (
    <Section {...args}>
      <SectionBody label="Default — comfortable spacing, no tone, no divider, content container." />
    </Section>
  ),
};

export const MutedWithDivider: Story = {
  args: { spacing: 'comfortable', tone: 'muted', divider: 'both', container: 'wide' },
  render: (args) => (
    <Section {...args}>
      <SectionBody label="tone='muted' + divider='both' + container='wide' — the 'What it catches' geometry on the home." />
    </Section>
  ),
};

export const InsetStrip: Story = {
  args: { spacing: 'tight', tone: 'inset', divider: 'both', container: 'content' },
  render: (args) => (
    <Section {...args}>
      <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
        <div><div className="text-3xl font-bold">18</div><div className="text-xs uppercase text-fd-muted-foreground">Plugins</div></div>
        <div><div className="text-3xl font-bold">350+</div><div className="text-xs uppercase text-fd-muted-foreground">Rules</div></div>
        <div><div className="text-3xl font-bold">11</div><div className="text-xs uppercase text-fd-muted-foreground">Security</div></div>
        <div><div className="text-3xl font-bold">7</div><div className="text-xs uppercase text-fd-muted-foreground">Quality</div></div>
      </div>
    </Section>
  ),
};

export const SpacingScale: Story = {
  render: () => (
    <div>
      {(['tight', 'comfortable', 'spacious'] as const).map((spacing) => (
        <Section key={spacing} spacing={spacing} divider="bottom" tone={spacing === 'comfortable' ? 'muted' : 'default'}>
          <SectionBody label={`spacing="${spacing}"`} />
        </Section>
      ))}
    </div>
  ),
};

export const ToneVariants: Story = {
  render: () => (
    <div>
      <Section spacing="comfortable" tone="default" divider="bottom">
        <SectionBody label='tone="default" — no background' />
      </Section>
      <Section spacing="comfortable" tone="muted" divider="bottom">
        <SectionBody label='tone="muted" — bg-fd-card/30' />
      </Section>
      <Section spacing="comfortable" tone="inset" divider="bottom">
        <SectionBody label='tone="inset" — bg-fd-card/50 with backdrop-blur' />
      </Section>
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};
