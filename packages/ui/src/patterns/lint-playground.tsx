'use client';

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { CodeEditor, type CodeEditorDiagnostic } from '../primitives/code-editor.js';

/**
 * LintPlayground — paste code, watch analysis light it up.
 *
 * ## The seam: the consumer brings the analyzer
 *
 * `lint` is an injected async function. The DS owns the surface —
 * editor, findings list, status — and stays free of any linting
 * dependency; the app owns HOW linting happens (a web worker bundling
 * a real linter, a WASM tool, a mock in Storybook). That inversion is
 * what keeps this a pattern rather than a product: the same component
 * demos an ESLint plugin, a formatter, or anything else that maps code
 * to line-anchored findings.
 *
 * ## Honesty rules
 *
 * - Findings are TEXT first: every diagnostic renders as a list row
 *   (line, rule, message); the editor's bars are the same facts as
 *   position. Colour-and-position alone never carries the message.
 * - Stale results never paint: each keystroke advances a sequence
 *   number and only the newest lint's answer lands. A slow answer to
 *   old code is a wrong answer to current code.
 * - A failed lint says so (`role="status"`, not a silent empty list) —
 *   "no findings" and "could not analyze" license different
 *   conclusions.
 * - The footer states the privacy fact that makes pasting real code
 *   reasonable: analysis runs where the reader is, nothing leaves.
 *
 * | Rule | Concept                    | Where in this file                    |
 * | ---- | -------------------------- | ------------------------------------- |
 * | R5   | testid required, no default| `'data-testid': string`               |
 * | R6   | data-slot on every part    | `"lint-playground" / "-status" / "-findings" / "-footer"` |
 * | R11  | Composition over kind-props| the analyzer is injected, not enumerated |
 * | R16  | No internal coupling       | renders CodeEditor, brings no linter  |
 * | R24  | Product-neutral            | no plugin names, no product copy      |
 * | R25  | Client component           | debounce + async state                |
 */

/** One finding, line-anchored. `message` is the full human sentence. */
export interface PlaygroundDiagnostic {
  line: number;
  column?: number;
  /** Analyzer's rule id, or null for parse-level failures. */
  ruleId: string | null;
  severity: 'error' | 'warn';
  message: string;
}

export interface LintPlaygroundProps
  extends Omit<React.ComponentPropsWithoutRef<'section'>, 'children'> {
  /** Stable selector for E2E tests; consumer provides — no default (R5). */
  'data-testid': string;
  /** Accessible name for the editor inside. */
  label: string;
  /** The code the exhibit opens on — usually a vulnerable-by-design sample. */
  initialCode: string;
  /** The analyzer. Rejections render the failed state, never an empty list. */
  lint: (code: string) => Promise<readonly PlaygroundDiagnostic[]>;
  /**
   * Quiet time after the last keystroke before analyzing.
   * @default 300
   */
  debounceMs?: number;
}

type Status = 'linting' | 'ready' | 'failed';

export const LintPlayground = React.forwardRef<HTMLElement, LintPlaygroundProps>(
  function LintPlayground(
    {
      'data-testid': testId,
      label,
      initialCode,
      lint,
      debounceMs = 300,
      className,
      ...rest
    },
    ref,
  ) {
    const [code, setCode] = React.useState(initialCode);
    const [status, setStatus] = React.useState<Status>('linting');
    const [findings, setFindings] = React.useState<readonly PlaygroundDiagnostic[]>([]);
    const seq = React.useRef(0);

    React.useEffect(() => {
      const mine = ++seq.current;
      setStatus('linting');
      const timer = window.setTimeout(() => {
        lint(code).then(
          (result) => {
            if (seq.current !== mine) return; // stale — newer code exists
            setFindings(result);
            setStatus('ready');
          },
          () => {
            if (seq.current !== mine) return;
            setFindings([]);
            setStatus('failed');
          },
        );
      }, debounceMs);
      return () => window.clearTimeout(timer);
    }, [code, lint, debounceMs]);

    const bars: CodeEditorDiagnostic[] = findings.map((f) => ({
      line: f.line,
      severity: f.severity,
    }));

    return (
      <section
        ref={ref}
        data-slot="lint-playground"
        data-testid={testId}
        data-status={status}
        aria-label={label}
        className={cn('flex flex-col gap-3', className)}
        {...rest}
      >
        <CodeEditor
          data-testid={`${testId}-editor`}
          label={label}
          value={code}
          onValueChange={setCode}
          diagnostics={status === 'ready' ? bars : []}
        />

        {/* One live region carries the state sentence; the list below is
            plain content, so a screen reader is told the COUNT changed
            and can then read each finding at its own pace. */}
        <p
          data-slot="lint-playground-status"
          role="status"
          className="text-xs text-muted-foreground"
        >
          {status === 'linting' && 'Analyzing…'}
          {status === 'failed' &&
            'Could not analyze this code — the result is unknown, not clean.'}
          {status === 'ready' &&
            (findings.length === 0
              ? 'No findings.'
              : `${findings.length} finding${findings.length === 1 ? '' : 's'}.`)}
        </p>

        {status === 'ready' && findings.length > 0 && (
          <ol
            data-slot="lint-playground-findings"
            className="m-0 flex list-none flex-col gap-2 p-0"
          >
            {findings.map((f, index) => (
              <li
                key={`${f.line}-${f.ruleId ?? 'parse'}-${index}`}
                className={cn(
                  'rounded-md border-l-2 bg-muted/40 px-3 py-2 text-xs',
                  f.severity === 'error' ? 'border-destructive' : 'border-chart-4',
                )}
              >
                <span className="font-medium tabular-nums">L{f.line}</span>
                {f.ruleId && (
                  <span className="ml-2 font-mono text-muted-foreground">{f.ruleId}</span>
                )}
                {/* The analyzer's sentence verbatim, line breaks kept —
                    a CWE-tagged multi-line message IS the product. */}
                <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-foreground">
                  {f.message}
                </pre>
              </li>
            ))}
          </ol>
        )}

        <p
          data-slot="lint-playground-footer"
          className="text-xs text-muted-foreground"
        >
          Edits as you type · analysis runs entirely in your browser — nothing
          you type leaves this page.
        </p>
      </section>
    );
  },
);
