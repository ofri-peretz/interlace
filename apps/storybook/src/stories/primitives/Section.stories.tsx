import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@interlace/ui/card";
import { Checkbox } from "@interlace/ui/checkbox";
import { ComboboxCompose } from "@interlace/ui/combobox";
import { Input } from "@interlace/ui/input";
import { Label } from "@interlace/ui/label";
import { Section } from "@interlace/ui/section";
import { Textarea } from "@interlace/ui/textarea";
import { withRtl } from "@/decorators";

const meta: Meta<typeof Section> = {
  title: "Primitives/Section",
  component: Section,
  tags: ["autodocs"],
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
      control: "select",
      options: ["tight", "comfortable", "spacious", "none"],
      description:
        "Vertical padding, responsive at every step (e.g. `comfortable` = `py-16 md:py-20 lg:py-24`). Every variant clears the §3 mobile/desktop section floors; `none` is the escape hatch for a band whose child owns its own padding.",
      table: {
        type: { summary: "'tight' | 'comfortable' | 'spacious' | 'none'" },
        defaultValue: { summary: "comfortable" },
        category: "Appearance",
      },
    },
    tone: {
      control: "select",
      options: ["default", "muted", "inset", "brand"],
      description:
        "Background. `default` is transparent; `muted` (`bg-card/30`) separates adjacent bands without a rule; `inset` adds a backdrop blur for a strip that should read as a raised surface; `brand` is the full-bleed brand band (`bg-band` with `text-band-foreground`; both follow the primary pair unless `--band` / `--band-foreground` are set).",
      table: {
        type: { summary: "'default' | 'muted' | 'inset' | 'brand'" },
        defaultValue: { summary: "default" },
        category: "Appearance",
      },
    },
    divider: {
      control: "select",
      options: ["none", "top", "bottom", "both"],
      description:
        "Border at the section transition. Pick one side per boundary — `both` on every band doubles the rules between neighbours.",
      table: {
        type: { summary: "'none' | 'top' | 'bottom' | 'both'" },
        defaultValue: { summary: "none" },
        category: "Appearance",
      },
    },
    overlap: {
      control: "select",
      options: ["none", "sm", "md", "lg"],
      description:
        "Ride up over the band above by this depth: the section drops its own top padding, pulls up, and stacks above. Use it for a card that straddles the edge of a `brand` band. Keep the depth below the band's bottom padding.",
      table: {
        type: { summary: "'none' | 'sm' | 'md' | 'lg'" },
        defaultValue: { summary: "none" },
        category: "Layout",
      },
    },
    container: {
      control: "select",
      options: ["prose", "content", "wide", "full"],
      description:
        "Width of the `<Container>` wrapped around the children: `prose` 65ch, `content` 1024px, `wide` 1280px, `full` full-bleed with no horizontal padding.",
      table: {
        type: { summary: "'prose' | 'content' | 'wide' | 'full'" },
        defaultValue: { summary: "content" },
        category: "Appearance",
      },
    },
    as: {
      control: "select",
      options: ["section", "header", "footer", "aside", "div"],
      description:
        "Element rendered for the band. Keep the semantic honest — `header` / `footer` / `aside` are landmarks, and `div` is for a band that carries no meaning of its own.",
      table: {
        type: { summary: "'section' | 'header' | 'footer' | 'aside' | 'div'" },
        defaultValue: { summary: "section" },
        category: "Structure",
      },
    },
    children: {
      control: false,
      description:
        "Band content. Always mounted inside the `<Container>` — never add another one here.",
      table: { type: { summary: "ReactNode" }, category: "Slots" },
    },
    className: {
      control: "text",
      description:
        "Merged after the variant classes — the seam for a one-off background image or a `min-h-screen` hero, not for re-specifying spacing.",
      table: { type: { summary: "string" }, category: "Appearance" },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Section>;

const SectionBody = ({ label }: { label: string }) => (
  <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
    {label}
  </div>
);

export const Default: Story = {
  args: {
    spacing: "comfortable",
    tone: "default",
    divider: "none",
    container: "content",
    as: "section",
  },
  render: (args) => (
    <Section {...args}>
      <SectionBody label="Default — comfortable spacing, no tone, no divider, content container." />
    </Section>
  ),
};

export const MutedWithDivider: Story = {
  args: {
    spacing: "comfortable",
    tone: "muted",
    divider: "both",
    container: "wide",
  },
  render: (args) => (
    <Section {...args}>
      <SectionBody label="tone='muted' + divider='both' + container='wide' — the 'What it catches' geometry on the home." />
    </Section>
  ),
};

export const InsetStrip: Story = {
  args: {
    spacing: "tight",
    tone: "inset",
    divider: "both",
    container: "content",
  },
  render: (args) => (
    <Section {...args}>
      <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
        <div>
          <div className="text-3xl font-bold">18</div>
          <div className="text-xs uppercase text-muted-foreground">Plugins</div>
        </div>
        <div>
          <div className="text-3xl font-bold">350+</div>
          <div className="text-xs uppercase text-muted-foreground">Rules</div>
        </div>
        <div>
          <div className="text-3xl font-bold">11</div>
          <div className="text-xs uppercase text-muted-foreground">
            Security
          </div>
        </div>
        <div>
          <div className="text-3xl font-bold">7</div>
          <div className="text-xs uppercase text-muted-foreground">Quality</div>
        </div>
      </div>
    </Section>
  ),
};

export const SpacingScale: Story = {
  render: () => (
    <div>
      {(["tight", "comfortable", "spacious"] as const).map((spacing) => (
        <Section
          key={spacing}
          spacing={spacing}
          divider="bottom"
          tone={spacing === "comfortable" ? "muted" : "default"}
        >
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
        <SectionBody label='tone="muted" — bg-card/30' />
      </Section>
      <Section spacing="comfortable" tone="inset" divider="bottom">
        <SectionBody label='tone="inset" — bg-card/50 with backdrop-blur' />
      </Section>
    </div>
  ),
};

/** A brand band with a card riding over its bottom edge: two Sections, the second with `overlap`. */
export const BrandBandWithOverlap: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div>
      <Section as="header" tone="brand" spacing="tight">
        <p className="text-sm font-semibold tracking-widest uppercase">
          The claim
        </p>
        <h1 className="font-heading mt-3 text-4xl font-extrabold tracking-tight">
          &quot;The bridge was closed for months.&quot;
        </h1>
      </Section>
      <Section overlap="md" spacing="tight">
        <Card>
          <CardHeader>
            <CardTitle>Say it straight</CardTitle>
          </CardHeader>
          <CardContent>
            It was six weeks, from 3 March to 14 April. It felt longer because
            the detour was slow.
          </CardContent>
        </Card>
      </Section>
    </div>
  ),
};

/**
 * A band of its own in the dark scheme. A dark theme lightens its primary so
 * links and buttons read on a dark page; the same colour as a full-width band
 * glares. Setting `--band` and `--band-foreground` (here inline; in an app, on
 * `.dark`) keeps the band deep while the primary stays light.
 */
export const DeepBandInDark: Story = {
  ...BrandBandWithOverlap,
  globals: { theme: "dark" },
  decorators: [
    (Story) => (
      <div
        style={
          {
            "--band": "oklch(0.36 0.14 264)",
            "--band-foreground": "oklch(1 0 0)",
          } as CSSProperties
        }
      >
        <Story />
      </div>
    ),
  ],
};

const TOPICS = [
  { value: "roads", label: "Roads and bridges" },
  { value: "parks", label: "Parks" },
  { value: "water", label: "Water" },
];

/**
 * Form fields on a brand band. Every field paints its own opaque face and
 * text colour, so it reads on the band in both schemes; the labels inherit
 * the band's foreground.
 */
export const FieldsOnBrandBand: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <Section tone="brand" spacing="tight">
      <form
        className="grid max-w-prose gap-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="grid gap-2">
          <Label htmlFor="band-email">Email</Label>
          <Input id="band-email" type="email" placeholder="you@example.com" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="band-topic">Topic</Label>
          <ComboboxCompose
            items={TOPICS}
            aria-label="Topic"
            placeholder="Pick a topic"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="band-question">Your question</Label>
          <Textarea
            id="band-question"
            placeholder="Ask anything about the works."
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="band-updates" />
          <Label htmlFor="band-updates">Send me updates</Label>
        </div>
      </form>
    </Section>
  ),
};

export const FieldsOnBrandBandDark: Story = {
  ...FieldsOnBrandBand,
  globals: { theme: "dark" },
};

export const Dark: Story = {
  ...Default,
  globals: { theme: "dark" },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};
