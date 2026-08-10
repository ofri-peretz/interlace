import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeWindow, CodeWindowTitleBar } from '@interlace/ui/patterns/code-window';

const SAMPLE = `import { defineConfig } from '@interlace/eslint-devkit';

export default defineConfig({
  rules: {
    'no-unsafe-regex': 'error',
  },
});`;

/**
 * The chrome is deliberately two components — `CodeWindow` is a bare
 * `<div>` frame (its only own props are `className` + `children`), and every
 * knob a reader wants to turn lives on `CodeWindowTitleBar`. So the story args
 * span both, categorised by which component owns each prop.
 */
interface CodeWindowStoryArgs {
  /** `CodeWindow` — merged onto the frame. */
  className?: string;
  /** `CodeWindow` — the window body. */
  children?: ReactNode;
  /**
   * `CodeWindowTitleBar` — filename / rule id. Empty renders dots only.
   * Narrowed to `string` here (the real prop is `ReactNode`) so the story args
   * stay assignable to `CodeWindow`'s native `<div>` props, whose `title` is a
   * string attribute.
   */
  title?: string;
  /** `CodeWindowTitleBar` — trailing slot. */
  actions?: ReactNode;
  /** `CodeWindow` — code sample rendered in the body. */
  code?: string;
}

const meta: Meta<CodeWindowStoryArgs> = {
  title: 'Blocks/CodeWindow',
  component: CodeWindow,
  subcomponents: { CodeWindowTitleBar },
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Window chrome for code, terminal output, or an editor preview. The three ' +
          'traffic-light dots are decorative and `aria-hidden` — the title slot carries ' +
          'the accessible name — and they paint from the `--window-control-*` brand ' +
          'tokens rather than raw hex, so a consumer forking the brand restyles the ' +
          'chrome from CSS. Reach for it when you want a window-shaped container; reach ' +
          "for MagicUI's `Terminal` when you want an animated terminal prompt.",
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description:
        'Centred label in the bar — typically a filename or rule id. Clearing it renders the dots alone, which is the right call when a surrounding heading already names the content. Typed `ReactNode`, so JSX (a styled filename) works too.',
      table: { category: 'CodeWindowTitleBar', type: { summary: 'ReactNode' } },
    },
    actions: {
      control: false,
      description:
        'Right-aligned trailing slot inside the bar — a copy button, a run control, a status chip. A node rather than a label string so the consumer owns the affordance; not editable from Controls (see the WithActions story).',
      table: { category: 'CodeWindowTitleBar', type: { summary: 'ReactNode' } },
    },
    code: {
      control: 'text',
      description: 'Story-only: the sample source rendered in the window body.',
      table: { category: 'Story', type: { summary: 'string' } },
    },
    children: {
      control: false,
      description:
        'The window body — anything nested after the title bar (an editor, a `<pre>`, terminal output). The frame applies no padding of its own, so the body owns its spacing.',
      table: { category: 'CodeWindow', type: { summary: 'ReactNode' } },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the frame. The frame has no intrinsic width, so this is where a width constraint goes.',
      table: { category: 'CodeWindow', type: { summary: 'string' } },
    },
  },
};

export default meta;
type Story = StoryObj<CodeWindowStoryArgs>;

const Code = ({ children }: { children: string }) => (
  <pre
    tabIndex={0}
    className="overflow-x-auto p-md font-mono text-code focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <code>{children}</code>
  </pre>
);

export const Default: Story = {
  args: {
    title: 'eslint.config.ts',
    code: SAMPLE,
    className: 'w-full max-w-content',
  },
  render: ({ title, actions, code, ...args }) => (
    <CodeWindow {...args}>
      <CodeWindowTitleBar title={title} actions={actions} />
      <Code>{code ?? ''}</Code>
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
