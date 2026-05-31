import type { Meta, StoryObj } from '@storybook/react-vite';
import { DocsPageTemplate } from '@interlace/ui/templates/docs-page-template';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof DocsPageTemplate> = {
  title: 'Templates/DocsPageTemplate',
  component: DocsPageTemplate,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof DocsPageTemplate>;

const logo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-6 rounded-md bg-linear-to-br from-violet-500 to-violet-700"
    />
    <span>Interlace Docs</span>
  </a>
);

const sampleSidebar = (
  <nav aria-label="Docs sections" className="p-md text-sm">
    <h2 className="font-semibold mb-sm">Getting started</h2>
    <ul className="flex flex-col gap-xs text-muted-foreground">
      <li><a href="#intro" className="hover:text-foreground">Introduction</a></li>
      <li><a href="#install" className="hover:text-foreground">Installation</a></li>
      <li><a href="#first" className="hover:text-foreground">Your first page</a></li>
    </ul>
    <h2 className="font-semibold mt-md mb-sm">Guides</h2>
    <ul className="flex flex-col gap-xs text-muted-foreground">
      <li><a href="#theme" className="hover:text-foreground">Theming</a></li>
      <li><a href="#a11y" className="hover:text-foreground">Accessibility</a></li>
    </ul>
  </nav>
);

const sampleToc = (
  <nav aria-label="Table of contents" className="text-sm">
    <h2 className="font-semibold mb-sm">On this page</h2>
    <ul className="flex flex-col gap-xs text-muted-foreground">
      <li><a href="#a" className="hover:text-foreground">Introduction</a></li>
      <li><a href="#b" className="hover:text-foreground">Why this matters</a></li>
      <li><a href="#c" className="hover:text-foreground">How it works</a></li>
    </ul>
  </nav>
);

const sampleBody = (
  <>
    <h1 id="a">Introduction</h1>
    <p>
      Welcome to the Interlace DS docs. Drop in a primitive, get the
      a11y + reduced-motion + min-viewport contract for free.
    </p>
    <h2 id="b">Why this matters</h2>
    <p>
      Shipping a design system means shipping the layers underneath it.
      Tokens, semantics, components, patterns, templates — each layer
      composes the one below.
    </p>
    <h2 id="c">How it works</h2>
    <p>
      Read the CSS contract page to learn how layers interact, then walk
      the semantics catalogue to see every token.
    </p>
  </>
);

export const Default: Story = {
  args: {
    topbar: { logo, links: [{ href: '/', label: 'Home' }] },
    sidebar: sampleSidebar,
    toc: sampleToc,
    body: sampleBody,
  },
};

export const NoSidebar: Story = {
  args: { ...Default.args, sidebar: undefined },
};

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
