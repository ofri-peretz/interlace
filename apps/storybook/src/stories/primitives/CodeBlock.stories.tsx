import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeBlock, MIN_VIEWPORT } from '@interlace/ui/code-block';
import { withRtl } from '@/decorators';

const SAMPLE_TS = `import { defineConfig } from 'eslint/config';
import interlace from '@interlace/eslint-config';

export default defineConfig([
  interlace.recommended,
  {
    rules: {
      'no-console': 'warn',
    },
  },
]);
`;

const SAMPLE_BASH = `pnpm add -D @interlace/eslint-config
pnpm lint
`;

const SAMPLE_JSON = `{
  "name": "@interlace/ui",
  "version": "0.1.0"
}
`;

const meta = {
  title: 'Primitives/CodeBlock',
  component: CodeBlock,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders a multi-line snippet as `<figure><pre><code class="language-{lang}">`, with a header bar carrying the filename, the language tag, and a copy button. Reach for it whenever a snippet is long enough that a reader will want to copy it rather than retype it — docs pages, rule examples, install instructions. It does no highlighting itself: the `language-*` class and `data-language` attribute are the seam a downstream highlighter (Shiki, Prism) hooks into. Do not use it for a single inline token — the header bar always renders, so a one-word snippet should be a plain `<code>`.',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description:
        'Header title, left-aligned. Usually the filename the snippet belongs to. Truncates rather than wrapping when the header is narrow.',
      table: { type: { summary: 'ReactNode' }, category: 'Content' },
    },
    language: {
      control: 'text',
      description:
        'Language tag shown at the right of the header. Also emitted as `class="language-{lang}"` on the `<code>` and `data-language` on the `<figure>` — the contract a syntax highlighter reads. Omit it and no tag renders.',
      table: { type: { summary: 'string' }, category: 'Content' },
    },
    children: {
      control: 'text',
      description:
        'The fenced source. A string copies verbatim; pre-highlighted JSX copies via the rendered `textContent` instead.',
      table: { type: { summary: 'ReactNode' }, category: 'Content' },
    },
    loading: {
      control: 'boolean',
      description:
        'Replace the whole figure with a `<Skeleton variant="code-block">` while a highlight or fetch resolves. Reserves the block so the page around it does not reflow when the snippet lands.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the `<figure>` (and onto the skeleton while `loading`). Sizing is the caller’s job — the figure is block-level and fills its parent.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'eslint.config.mjs',
    language: 'ts',
    children: SAMPLE_TS,
    loading: false,
    className: 'w-[640px] max-w-full',
  },
  render: (args) => <CodeBlock {...args} />,
};

/**
 * `loading` swaps the figure for the `code-block` skeleton variant — a
 * multi-line monospace silhouette at the same height, so a snippet that
 * arrives after a Shiki pass or a fetch does not shift the page.
 */
export const Loading: Story = {
  args: {
    ...Default.args,
    loading: true,
  },
  render: (args) => <CodeBlock {...args} />,
};

/**
 * Permutations of `title` / `language` so the header degrades cleanly when
 * one or both slots are empty. The copy button remains in every variant.
 */
export const Variants: Story = {
  render: () => (
    <div className="w-[720px] max-w-full space-y-lg">
      <div className="space-y-xs">
        <div className="text-ui-sm font-mono text-muted-foreground">
          title + language
        </div>
        <CodeBlock title="install.sh" language="bash">
          {SAMPLE_BASH}
        </CodeBlock>
      </div>
      <div className="space-y-xs">
        <div className="text-ui-sm font-mono text-muted-foreground">
          language only
        </div>
        <CodeBlock language="json">{SAMPLE_JSON}</CodeBlock>
      </div>
      <div className="space-y-xs">
        <div className="text-ui-sm font-mono text-muted-foreground">
          title only
        </div>
        <CodeBlock title="notes.txt">{`Plain text — no language tag.\nCopy still works.`}</CodeBlock>
      </div>
      <div className="space-y-xs">
        <div className="text-ui-sm font-mono text-muted-foreground">
          neither (copy still available)
        </div>
        <CodeBlock>{`const answer = 42;`}</CodeBlock>
      </div>
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

/**
 * Below-min-viewport demo — wrap in a (MIN_VIEWPORT - 1)px container with the
 * `data-interlace-dev` flag so preflight's dashed warning outline appears.
 * The block still renders and the horizontal scroll keeps the snippet legible.
 */
export const BelowMinViewport: Story = {
  render: () => (
    <div data-interlace-dev style={{ width: MIN_VIEWPORT - 1 }}>
      <CodeBlock title="tight.ts" language="ts">
        {SAMPLE_TS}
      </CodeBlock>
    </div>
  ),
  decorators: [
    (Story) => (
      <div
        ref={(node) => {
          if (node && typeof document !== 'undefined') {
            document.body.setAttribute('data-interlace-dev', '');
          }
        }}
      >
        <Story />
      </div>
    ),
  ],
};
