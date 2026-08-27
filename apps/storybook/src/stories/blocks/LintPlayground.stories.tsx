import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  LintPlayground,
  type PlaygroundDiagnostic,
} from '@interlace/ui/patterns/lint-playground';
import { expect, waitFor, within } from 'storybook/test';

const SAMPLE = `import jwt from "jsonwebtoken";

export function verify(token, secret) {
  return jwt.verify(token, secret, { algorithms: ["none"] });
}`;

/**
 * A DEMO analyzer, standing in for the injected `lint` seam. In an app
 * this is a web worker bundling a real linter (the browser-bundle spike
 * proved 392KB gz for ESLint + one plugin); Storybook must stay
 * dependency-free, so a two-pattern scan plays the part with a
 * realistically shaped multi-line message.
 */
async function demoLint(code: string): Promise<readonly PlaygroundDiagnostic[]> {
  const findings: PlaygroundDiagnostic[] = [];
  code.split('\n').forEach((line, index) => {
    if (/algorithms:\s*\[[^\]]*["']none["']/.test(line)) {
      findings.push({
        line: index + 1,
        ruleId: 'demo/no-algorithm-none',
        severity: 'error',
        message:
          '🔒 CWE-347 | Including "none" in algorithms allows unsigned tokens | CRITICAL\n   Fix: remove "none" from the algorithms array',
      });
    }
    if (/\beval\s*\(/.test(line)) {
      findings.push({
        line: index + 1,
        ruleId: 'demo/no-eval',
        severity: 'warn',
        message: '⚠️ CWE-95 | eval() executes arbitrary strings | HIGH',
      });
    }
  });
  return findings;
}

const meta: Meta<typeof LintPlayground> = {
  title: 'Blocks/LintPlayground',
  component: LintPlayground,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Paste code, watch analysis light it up — the exhibit IS the product for any tool ' +
          'that maps code to line-anchored findings.\n\n' +
          '**The seam: the consumer brings the analyzer.** `lint` is an injected async ' +
          'function; the DS owns editor + findings list + status and ships no linting ' +
          'dependency. An app supplies a web worker bundling the real thing; these stories ' +
          'inject a two-pattern demo scan.\n\n' +
          '**Honesty rules, enforced by tests:** findings are text first (bars are the same ' +
          'facts as position); stale results never paint (sequence-numbered); a failed ' +
          'analysis says "unknown, not clean" rather than rendering an empty list; and the ' +
          'footer states the privacy fact that makes pasting real code reasonable.',
      },
    },
  },
  argTypes: {
    initialCode: {
      control: 'text',
      description: 'The code the exhibit opens on — usually a vulnerable-by-design sample.',
      table: { category: 'Data' },
    },
    lint: {
      description:
        'The analyzer: `(code) => Promise<readonly PlaygroundDiagnostic[]>`. Rejections ' +
        'render the failed state, never an empty list.',
      table: { category: 'Behavior' },
    },
    label: {
      control: 'text',
      description: 'Accessible name for the editor inside.',
      table: { category: 'A11y' },
    },
    debounceMs: {
      control: 'number',
      description: 'Quiet time after the last keystroke before analyzing.',
      table: { category: 'Behavior', defaultValue: { summary: '300' } },
    },
  },
};
export default meta;

type Story = StoryObj<typeof LintPlayground>;

export const Default: Story = {
  args: {
    'data-testid': 'playground',
    label: 'Try the rule on this code',
    initialCode: SAMPLE,
    lint: demoLint,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The initial (vulnerable) sample lints on mount: finding as TEXT…
    await waitFor(() =>
      expect(canvas.getByText('demo/no-algorithm-none')).toBeInTheDocument(),
    );
    await expect(canvas.getByText(/CWE-347/)).toBeInTheDocument();
    // …and the same fact as position on the editor.
    await expect(canvasElement.querySelector('[data-line="4"]')).not.toBeNull();
    // The privacy fact is printed — pasting real code has to be reasonable.
    await expect(
      canvas.getByText(/nothing\s+you type leaves this page/),
    ).toBeInTheDocument();
  },
};

export const CleanCode: Story = {
  args: {
    'data-testid': 'playground',
    label: 'Try the rule on this code',
    initialCode: 'export const add = (a, b) => a + b;\n',
    lint: demoLint,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('No findings.')).toBeInTheDocument());
  },
};

export const AnalyzerDown: Story = {
  args: {
    'data-testid': 'playground',
    label: 'Try the rule on this code',
    initialCode: SAMPLE,
    lint: async () => {
      throw new Error('worker unavailable');
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Failure is a statement: "unknown, not clean" — an empty list would read as a ' +
          'clean bill of health the analysis never issued.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByText(/unknown, not clean/)).toBeInTheDocument(),
    );
  },
};
