import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeBlock, MIN_VIEWPORT } from '@interlace/ui/code-block';
import { withDark, withRtl } from '@/decorators';

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
          'Fenced code block with a header bar (title left, language tag + copy button right). Client component — owns a `useState` for the 1.5s "Copied!" affordance, delegates the actual copy to `navigator.clipboard.writeText`. MIN_VIEWPORT = 320px; long lines `overflow-x-auto` rather than wrap.',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
    language: { control: 'text' },
  },
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'eslint.config.mjs',
    language: 'ts',
    children: SAMPLE_TS,
  },
  render: (args) => (
    <div className="w-[640px]">
      <CodeBlock {...args} />
    </div>
  ),
};

/**
 * Permutations of `title` / `language` so the header degrades cleanly when
 * one or both slots are empty. The copy button remains in every variant.
 */
export const Variants: Story = {
  render: () => (
    <div className="w-[720px] space-y-lg">
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
  decorators: [withDark],
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
