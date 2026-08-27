import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeEditor } from '@interlace/ui/code-editor';
import { expect, within } from 'storybook/test';

const SAMPLE = `import jwt from "jsonwebtoken";

export function verify(token, secret) {
  return jwt.verify(token, secret, { algorithms: ["none"] });
}`;

const meta: Meta<typeof CodeEditor> = {
  title: 'Primitives/CodeEditor',
  component: CodeEditor,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An editable code surface whose visual layer is DIAGNOSTICS, not syntax colour — ' +
          'the other half of the CodeBlock pair (read-only code keeps its Shiki tokens there; ' +
          'editable code lights up with findings here).\n\n' +
          '**The zero-sync layout trick.** Line-highlight overlays usually die by scroll-sync. ' +
          'This textarea auto-grows (`rows` = line count) with soft wrap off, so a bar for ' +
          'line N sits at a fixed offset computed from the line-height — no listeners, ' +
          'nothing to drift. The `leading-6`/`py-4` classes and the exported ' +
          '`LINE_HEIGHT_PX`/`PAD_Y_PX` constants are one contract, pinned by tests.\n\n' +
          '**Bars are position, never information.** The highlight layer is `aria-hidden`, ' +
          'severities differ by border (not hue alone), and the consumer renders every ' +
          'finding as text beside the editor — see Blocks/LintPlayground.',
      },
    },
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Accessible name. Required — an unnamed editor is a mystery box.',
      table: { category: 'A11y' },
    },
    value: {
      control: 'text',
      description: 'Controlled code; pair with `onValueChange`. Omit for uncontrolled.',
      table: { category: 'Data' },
    },
    defaultValue: {
      control: 'text',
      description: 'Uncontrolled starting code.',
      table: { category: 'Data' },
    },
    diagnostics: {
      control: 'object',
      description:
        'Lines to light up — `{ line, severity }`, 1-indexed, out-of-range lines are not ' +
        'drawn. Position only: render the messages as text too.',
      table: { type: { summary: 'readonly CodeEditorDiagnostic[]' }, category: 'Data' },
    },
    minRows: {
      control: 'number',
      description: 'Minimum visible rows, so an empty editor still reads as a place to type.',
      table: { category: 'Appearance', defaultValue: { summary: '4' } },
    },
  },
};
export default meta;

type Story = StoryObj<typeof CodeEditor>;

export const Default: Story = {
  args: {
    'data-testid': 'editor',
    label: 'Sample code',
    defaultValue: SAMPLE,
  },
};

export const WithFindings: Story = {
  args: {
    'data-testid': 'editor',
    label: 'Sample code with findings',
    defaultValue: SAMPLE,
    diagnostics: [
      { line: 4, severity: 'error' },
      { line: 1, severity: 'warn' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The editor is a REAL textarea — focusable, editable, announced.
    const input = canvas.getByLabelText('Sample code with findings');
    await expect(input.tagName.toLowerCase()).toBe('textarea');
    // Bars carry position only and stay out of the tree.
    await expect(
      canvasElement.querySelector('[data-slot="code-editor-highlights"]'),
    ).toHaveAttribute('aria-hidden', 'true');
    await expect(canvasElement.querySelectorAll('[data-line]')).toHaveLength(2);
  },
};

export const EmptyInvitesTyping: Story = {
  args: {
    'data-testid': 'editor',
    label: 'Paste your code',
    defaultValue: '',
    minRows: 6,
  },
};
