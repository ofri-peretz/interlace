import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeWindow, CodeWindowTitleBar } from '@interlace/ui/patterns/code-window';

const SAMPLE = `import { defineConfig } from '@interlace/eslint-devkit';

export default defineConfig({
  rules: {
    'no-unsafe-regex': 'error',
  },
});`;

const meta: Meta<typeof CodeWindow> = {
  title: 'Blocks/CodeWindow',
  component: CodeWindow,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Window chrome for code, terminal output, or an editor preview. The three ' +
          'traffic-light dots are decorative and `aria-hidden` — the title slot carries ' +
          'the accessible name — and they paint from the `--window-control-*` brand ' +
          'tokens rather than raw hex, so a consumer forking the brand restyles the ' +
          'chrome from CSS.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const Code = ({ children }: { children: string }) => (
  <pre
    tabIndex={0}
    className="overflow-x-auto p-md font-mono text-code focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <code>{children}</code>
  </pre>
);

export const Default: Story = {
  render: () => (
    <CodeWindow className="w-full max-w-content">
      <CodeWindowTitleBar title="eslint.config.ts" />
      <Code>{SAMPLE}</Code>
    </CodeWindow>
  ),
};

export const WithoutTitle: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Bar with dots only — for when a surrounding heading already names the ' +
          'content and repeating it would just be noise.',
      },
    },
  },
  render: () => (
    <CodeWindow className="w-full max-w-content">
      <CodeWindowTitleBar />
      <Code>{SAMPLE}</Code>
    </CodeWindow>
  ),
};

export const WithActions: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The `actions` slot takes any node — a copy button, a run control, a status ' +
          'chip. It is a ReactNode rather than a label string so the consumer owns the ' +
          'affordance.',
      },
    },
  },
  render: () => (
    <CodeWindow className="w-full max-w-content">
      <CodeWindowTitleBar
        title="eslint.config.ts"
        actions={
          <button
            type="button"
            className="rounded-sm px-2 py-0.5 text-caption text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Copy
          </button>
        }
      />
      <Code>{SAMPLE}</Code>
    </CodeWindow>
  ),
};

export const NarrowViewport: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Constrained to the 320px floor. The code body scrolls horizontally rather ' +
          'than wrapping, and the long filename truncates instead of pushing the ' +
          'actions slot off the bar. The `<pre>` carries `tabIndex={0}` so keyboard ' +
          'users can reach that scroll container — which is what keeps axe green on ' +
          'the scrollable-region check.',
      },
    },
  },
  render: () => (
    <div className="w-80">
      <CodeWindow>
        <CodeWindowTitleBar title="a-rather-long-configuration-filename.config.ts" />
        <Code>{SAMPLE}</Code>
      </CodeWindow>
    </div>
  ),
};
