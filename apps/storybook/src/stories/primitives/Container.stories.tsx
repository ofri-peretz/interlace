import type { Meta, StoryObj } from '@storybook/react-vite';
import { Container } from '@interlace/ui/container';
import { withRtl } from '@/decorators';

const meta: Meta<typeof Container> = {
  title: 'Primitives/Container',
  component: Container,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Centres a page section and caps its measure. Wrap every top-level section of a page in one so line length and gutters are decided in one place instead of at each call site — reaching for an ad-hoc `max-w-3xl` / `max-w-5xl` in app code is the thing this primitive exists to prevent (LAYOUT_PHILOSOPHY.md §2). It owns the responsive horizontal padding scale `px-4 sm:px-6 lg:px-8`, so do not add your own gutters on top. It is not a grid or a stack — for column layout and spacing between children, compose `Grid` / `Stack` inside it.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['prose', 'content', 'wide', 'full'],
      description:
        'The width contract. `prose` = 65ch for long-form text; `content` = 1024px, the default for landing sections; `wide` = 1280px for card-grid-heavy sections; `full` removes the max-width **and** the horizontal padding, for full-bleed heroes and decorative bands.',
      table: {
        type: { summary: "'prose' | 'content' | 'wide' | 'full'" },
        defaultValue: { summary: 'content' },
        category: 'Appearance',
      },
    },
    className: {
      control: 'text',
      description:
        'Merged after the size variant, so it can override the max-width — which is exactly what this primitive exists to stop. Use it for vertical rhythm (`py-*`) and background, not for width.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
    children: {
      control: false,
      description: 'The section content. Rendered inside the capped, padded box.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    render: {
      control: false,
      description:
        'Base UI composition seam — render as a different element (`<section>`, `<main>`, `<header>`) instead of a `<div>`, keeping the width contract. This DS has no `as` prop; `render` is the seam (CONVENTIONS.md).',
      table: {
        type: { summary: 'ReactElement | (props, state) => ReactElement' },
        category: 'Slots',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Container>;

const Sample = ({ label }: { label: string }) => (
  <div className="rounded-md border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
    {label} — children fit inside the configured max-width with responsive horizontal padding.
  </div>
);

export const Prose: Story = {
  args: { size: 'prose' },
  render: (args) => (
    <Container {...args}>
      <Sample label="size=prose (65ch)" />
    </Container>
  ),
};

export const Content: Story = {
  args: { size: 'content' },
  render: (args) => (
    <Container {...args}>
      <Sample label="size=content (1024px) — default for landing sections" />
    </Container>
  ),
};

export const Wide: Story = {
  args: { size: 'wide' },
  render: (args) => (
    <Container {...args}>
      <Sample label="size=wide (1280px) — card-grid heavy sections" />
    </Container>
  ),
};

export const Full: Story = {
  args: { size: 'full' },
  render: (args) => (
    <Container {...args}>
      <Sample label="size=full (no max-width) — full-bleed hero, decorative bands" />
    </Container>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {(['prose', 'content', 'wide', 'full'] as const).map((size) => (
        <Container key={size} size={size}>
          <Sample label={`size=${size}`} />
        </Container>
      ))}
    </div>
  ),
};

export const Dark: Story = {
  ...Content,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Content,
  decorators: [withRtl],
};
