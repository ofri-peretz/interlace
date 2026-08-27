'use client';

import * as React from 'react';

import { cn } from '../lib/cn.js';

/**
 * CodeEditor — an editable code surface whose visual layer is
 * DIAGNOSTICS, not syntax colour.
 *
 * ## Why there is no client-side syntax highlighting
 *
 * Every in-browser highlighter is a dependency with a grammar registry
 * (Shiki ships megabytes of them), and the editor exists for one job:
 * let a reader paste code and watch analysis light it up. The finding
 * bars ARE the highlighting. A consumer that wants coloured tokens for
 * READ-ONLY code already has CodeBlock — this component is the other
 * half of that pair, not a replacement.
 *
 * ## The zero-sync layout trick
 *
 * Line-highlight overlays usually die by scroll-sync: a scrolling
 * textarea and an absolutely positioned bar layer drift the moment a
 * frame drops. Here the textarea AUTO-GROWS (`rows` = line count, no
 * vertical scroll exists) and soft wrap is off (`wrap="off"`,
 * horizontal overflow scrolls the box like every code block in this
 * package) — so a bar for line N sits at a fixed offset computed from
 * the line-height, forever. No listeners, no rAF, nothing to drift.
 * The pairing is a CONTRACT: `PAD_Y_PX`/`LINE_HEIGHT_PX` below must
 * match the `py-4`/`leading-6` classes on the textarea, and the test
 * suite pins them together.
 *
 * ## A11y
 *
 * A textarea is natively focusable, editable, and announced; `label`
 * is required because an unnamed editor is a mystery box. The bars are
 * `aria-hidden` POSITION, never information: the consumer (see
 * LintPlayground) renders every finding as text beside the editor —
 * colour-and-position alone never carries the message.
 *
 * | Rule | Concept                    | Where in this file                |
 * | ---- | -------------------------- | --------------------------------- |
 * | R5   | testid required, no default| `'data-testid': string`           |
 * | R6   | data-slot on every part    | `"code-editor" / "-highlights" / "-input"` |
 * | R8   | No isXxx booleans          | (none needed)                     |
 * | R13  | Ecosystem first            | native `<textarea>` IS the editor |
 * | R14  | Controlled + uncontrolled  | `value`/`onValueChange` + `defaultValue` |
 * | R18  | Tailwind; dynamic inline   | bar offsets are computed values   |
 * | R25  | Client component           | editing state                     |
 */

/** One highlighted line. Position only — the message lives in text, beside. */
export interface CodeEditorDiagnostic {
  /** 1-indexed line. Out-of-range lines are simply not drawn. */
  line: number;
  severity: 'error' | 'warn';
}

/**
 * The layout contract with the textarea's classes. `leading-6` = 24px
 * rows, `py-4` = 16px top pad; a bar for line N sits at
 * `PAD_Y_PX + (N-1) * LINE_HEIGHT_PX`. Change either side only with
 * the other.
 */
export const LINE_HEIGHT_PX = 24;
export const PAD_Y_PX = 16;

const SEVERITY_BAR: Record<CodeEditorDiagnostic['severity'], string> = {
  error: 'bg-destructive/15 border-l-2 border-destructive',
  warn: 'bg-chart-4/15 border-l-2 border-chart-4',
};

export interface CodeEditorProps
  extends Omit<
    React.ComponentPropsWithoutRef<'textarea'>,
    'value' | 'defaultValue' | 'onChange' | 'children' | 'wrap' | 'rows'
  > {
  /** Stable selector for E2E tests; consumer provides — no default (R5). */
  'data-testid': string;
  /** Accessible name. Required: an unnamed editor is a mystery box. */
  label: string;
  /** Controlled code. Pair with `onValueChange`. */
  value?: string;
  /** Uncontrolled starting code. */
  defaultValue?: string;
  onValueChange?: (code: string) => void;
  /** Lines to light up. Position only — render the messages as text too. */
  diagnostics?: readonly CodeEditorDiagnostic[];
  /**
   * Minimum visible rows, so an empty editor still reads as a place to
   * type rather than a collapsed input.
   * @default 4
   */
  minRows?: number;
}

export const CodeEditor = React.forwardRef<HTMLTextAreaElement, CodeEditorProps>(
  function CodeEditor(
    {
      'data-testid': testId,
      label,
      value,
      defaultValue,
      onValueChange,
      diagnostics = [],
      minRows = 4,
      className,
      ...rest
    },
    ref,
  ) {
    const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? '');
    const code = value ?? uncontrolled;
    const lines = code.split('\n').length;

    return (
      <div
        data-slot="code-editor"
        data-testid={testId}
        className={cn(
          'relative overflow-hidden rounded-lg border border-border bg-card',
          className,
        )}
      >
        {/* Bars are position, not information: aria-hidden, and every
            severity also changes the left border, so error/warn stay
            apart in greyscale. */}
        <div
          aria-hidden
          data-slot="code-editor-highlights"
          className="pointer-events-none absolute inset-0"
        >
          {diagnostics
            .filter((d) => d.line >= 1 && d.line <= lines)
            .map((d, index) => (
              <div
                key={`${d.line}-${index}`}
                data-line={d.line}
                className={cn('absolute inset-x-0', SEVERITY_BAR[d.severity])}
                style={{
                  top: PAD_Y_PX + (d.line - 1) * LINE_HEIGHT_PX,
                  height: LINE_HEIGHT_PX,
                }}
              />
            ))}
        </div>
        <textarea
          ref={ref}
          data-slot="code-editor-input"
          aria-label={label}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          // wrap="off": line N must BE row N for the bars to be honest —
          // long lines scroll horizontally, the code-block rule.
          wrap="off"
          rows={Math.max(minRows, lines)}
          value={code}
          onChange={(event) => {
            if (value === undefined) setUncontrolled(event.target.value);
            onValueChange?.(event.target.value);
          }}
          className={cn(
            // leading-6 + py-4 are the LINE_HEIGHT_PX / PAD_Y_PX contract.
            'relative block w-full resize-none overflow-x-auto overflow-y-hidden',
            'whitespace-pre bg-transparent px-4 py-4 font-mono text-sm leading-6',
            'text-foreground caret-foreground outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring',
          )}
          {...rest}
        />
      </div>
    );
  },
);
