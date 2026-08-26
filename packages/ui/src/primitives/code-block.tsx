'use client';

/**
 * @interlace/ui — CodeBlock
 *
 * Fenced code block with a title bar (title left, language tag + copy button
 * right). The copy action shells out to `navigator.clipboard.writeText` and
 * flips an inline "Copied!" affordance for 1.5s — the only piece of state
 * this primitive owns. Everything else is structural: a `<figure>` wrapping
 * a `<pre><code class="language-{lang}">`, ready for any downstream syntax
 * highlighter (Shiki, Prism, hand-rolled — we don't care).
 *
 * The header ALWAYS renders — the copy button needs a home even when
 * `title` and `language` are both absent. A snippet too small to deserve
 * the header bar is a snippet that should be a plain inline `<code>`,
 * not a CodeBlock.
 *
 * ## Anatomy
 *
 *   CodeBlock                          (figure — data-min-viewport=320)
 *     ├─ figcaption                    (header bar; always rendered)
 *     │   ├─ {title}                   (left)
 *     │   ├─ {language tag}            (right)
 *     │   └─ <button> "Copy" / "Copied!" (right; client-only)
 *     └─ <pre>
 *         └─ <code class="language-{lang}">{children}</code>
 *
 * ## MIN_VIEWPORT — 320
 *
 * Code blocks are the load-bearing surface of a docs site and MUST work on
 * a 320 CSS-px phone. We never wrap content (would shred indentation) — we
 * `overflow-x-auto` instead, so a narrow viewport gets a horizontally
 * scrollable block rather than mangled syntax.
 *
 * ## Notation contract (highlighted / diff lines)
 *
 * Shiki's `transformerNotationHighlight` / `transformerNotationDiff` mark
 * line spans with `highlighted`, `diff add`, `diff remove`. The block does
 * no highlighting itself (unchanged), but it OWNS how those marks look:
 * token-backed washes that hold in both themes, a `+` / `-` gutter marker
 * so a diff is never color-alone (COLOR_PHILOSOPHY), and edge-to-edge
 * bleed through the pre's padding. Any highlighter emitting the same
 * classes gets the same treatment — the contract is the class names.
 *
 * Removed lines are the OLD code: the copy button and manual selection
 * both yield the post-diff state (`.diff.remove` is skipped on copy and
 * `select-none`), so nobody pastes the vulnerable line by accident.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'figure'> & CodeBlockProps`           |
 * | R6   | data-slot per part               | code-block / code-block-header / code-block-title / code-block-language / code-block-copy / code-block-pre / code-block-code |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R8   | No isXxx; props are scalars      | `title?` / `language?` only — no boolean variants           |
 * | R10  | Composition seam                 | `title` / `language` slots accept ReactNode                 |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes only                   |
 * | R19  | Tokens only                      | `bg-card` / `border-border` / `rounded-md` / `p-md` / `text-code` |
 * | R20  | AA contrast                      | foreground on card surface (semantic tokens, AA-clean)      |
 * | R25  | Client component                 | Owns `useState` for the copy affordance                     |
 * | R26  | A11y                             | Copy button has accessible label + aria-live region for state |
 */

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Skeleton } from './skeleton.js';

export const MIN_VIEWPORT = 320 as const;

const COPIED_RESET_MS = 1500;

/**
 * Notation line styles — see "Notation contract" in the header. Decorated
 * lines bleed through the pre's `p-md` padding via the inline-block +
 * negative-margin recipe (the same one VitePress ships); the bleed width
 * tracks the `--spacing-md` token so a padding change cannot desync it.
 * Diff markers sit absolutely in the bled padding gutter, so code
 * alignment across marked and unmarked lines is untouched.
 */
const NOTATION_LINES = cn(
  '[&_.line.highlighted]:relative [&_.line.highlighted]:inline-block [&_.line.highlighted]:-mx-md [&_.line.highlighted]:px-md [&_.line.highlighted]:w-[calc(100%_+_var(--spacing-md)*2)]',
  '[&_.line.diff]:relative [&_.line.diff]:inline-block [&_.line.diff]:-mx-md [&_.line.diff]:px-md [&_.line.diff]:w-[calc(100%_+_var(--spacing-md)*2)]',
  '[&_.line.highlighted]:bg-accent',
  '[&_.line.diff.add]:bg-success/15',
  '[&_.line.diff.remove]:bg-destructive/10 [&_.line.diff.remove]:select-none',
  '[&_.line.diff]:before:absolute [&_.line.diff]:before:left-xs',
  "[&_.line.diff.add]:before:content-['+'] [&_.line.diff.add]:before:text-success",
  "[&_.line.diff.remove]:before:content-['-'] [&_.line.diff.remove]:before:text-destructive",
);

/**
 * textContent minus `.diff.remove` lines — copying a diff must yield the
 * post-diff (fixed) code, never the removed line someone is being told to
 * delete. Each removed span's trailing newline (a sibling text node in
 * Shiki's output) goes with it, so removals don't leave blank lines in
 * the pasted result.
 */
function copyableText(code: HTMLElement | null): string {
  if (!code) return '';
  if (!code.querySelector('.line.diff.remove')) return code.textContent ?? '';
  const clone = code.cloneNode(true) as HTMLElement;
  for (const line of clone.querySelectorAll('.line.diff.remove')) {
    const next = line.nextSibling;
    if (
      next?.nodeType === Node.TEXT_NODE &&
      next.textContent?.startsWith('\n')
    ) {
      next.textContent = next.textContent.slice(1);
    }
    line.remove();
  }
  return clone.textContent ?? '';
}

type CodeBlockProps = Omit<React.ComponentProps<'figure'>, 'title' | 'children'> & {
  /** Optional header title — usually a filename like `eslint.config.mjs`. */
  title?: React.ReactNode;
  /** Optional language tag — lowercases into `language-{lang}` on `<code>`. */
  language?: string;
  /**
   * The fenced code source — a string, JSX, or pre-highlighted markup.
   * Optional when `loading={true}` (the skeleton has no content to render).
   */
  children?: React.ReactNode;
  /**
   * When true, render a `<Skeleton variant="code-block" />` (multi-line
   * monospace silhouette) in place of the figure. Useful while a Shiki
   * highlight or fetch resolves.
   */
  loading?: boolean;
  /**
   * Fired after a SUCCESSFUL clipboard write, with the exact text that
   * was copied — the measurement seam for consumers (a copy affordance
   * that can't be measured contradicts the receipts doctrine).
   *
   * Named `onCopied` (past tense), not `onCopy` (R17 — documented
   * deviation): the native `onCopy` clipboard event already reaches the
   * root `<figure>` via `...props` and fires on selection-copy too;
   * this seam reports only the button's completed write.
   */
  onCopied?: (text: string) => void;
};

const CodeBlock = React.forwardRef<HTMLElement, CodeBlockProps>(
  ({ className, title, language, children, loading, onCopied, ...props }, ref) => {
    // Hooks must run unconditionally per React rules — the loading
    // early-return goes AFTER hook declarations so the call order is
    // stable across renders when `loading` flips.
    const [copied, setCopied] = React.useState(false);
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Clear the pending reset timer on unmount so we don't setState on a
    // detached node (R25 — client component must clean up its own side-effects).
    React.useEffect(() => {
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, []);

    const handleCopy = React.useCallback(async () => {
      // Pull the raw text out of children. Strings copy directly; for nodes
      // we fall back to the textContent of the rendered <code>. We capture
      // it lazily here so a pre-highlighted JSX child still copies cleanly.
      const text =
        typeof children === 'string' ? children : copyableText(codeRef.current);

      try {
        // No clipboard API (insecure context, sandboxed iframe): do NOT
        // flip "Copied!". An affordance that claims success without a
        // write happening is a lie — the snippet stays selectable and
        // manual copy still works.
        if (!navigator?.clipboard?.writeText) return;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        onCopied?.(text);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
      } catch {
        // Clipboard can reject in insecure contexts / sandboxed iframes. We
        // intentionally swallow — the snippet is still visible and selectable.
      }
    }, [children, onCopied]);

    const codeRef = React.useRef<HTMLElement>(null);

    // Loading early-return AFTER all hooks (useState, useEffect,
    // useCallback, useRef) so hook order stays stable across renders.
    if (loading) {
      return (
        <Skeleton
          variant="code-block"
          data-slot="code-block"
          data-min-viewport={String(MIN_VIEWPORT)}
          className={className}
        />
      );
    }

    const langClass = language ? `language-${language}` : undefined;

    return (
      <figure
        ref={ref}
        data-slot="code-block"
        data-min-viewport={String(MIN_VIEWPORT)}
        data-language={language ?? undefined}
        className={cn(
          'bg-card border-border overflow-hidden rounded-md border',
          className,
        )}
        {...props}
      >
        {/* Always rendered — the copy button needs a home (see the
            header docs above). */}
        <figcaption
          data-slot="code-block-header"
          className={cn(
            'border-border flex items-center justify-between gap-sm border-b px-md py-xs',
            'text-ui-sm text-muted-foreground',
          )}
        >
          <span
            data-slot="code-block-title"
            className="min-w-0 truncate font-medium text-foreground"
          >
            {title}
          </span>
          <div className="flex items-center gap-sm">
            {language ? (
              <span
                data-slot="code-block-language"
                className="font-mono uppercase tracking-wide"
              >
                {language}
              </span>
            ) : null}
            <button
              type="button"
              data-slot="code-block-copy"
              onClick={handleCopy}
              aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
              className={cn(
                'inline-flex items-center gap-xs rounded-md px-xs py-xs',
                'text-ui-sm text-muted-foreground hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'transition-colors',
              )}
            >
              {copied ? (
                <Check aria-hidden className="size-4" />
              ) : (
                <Copy aria-hidden className="size-4" />
              )}
              <span aria-live="polite">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </figcaption>
        <pre
          data-slot="code-block-pre"
          // tabIndex=0 keeps overflow scroll keyboard-reachable per axe
          // `scrollable-region-focusable` (WCAG 2.1.1). On narrow viewports
          // this lets keyboard users scroll the snippet sideways with arrow
          // keys; the focus-visible ring is the standard DS contract.
          tabIndex={0}
          className={cn(
            'overflow-x-auto p-md',
            'text-code font-mono text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            NOTATION_LINES,
          )}
        >
          <code
            ref={codeRef}
            data-slot="code-block-code"
            className={langClass}
          >
            {children}
          </code>
        </pre>
      </figure>
    );
  },
);
CodeBlock.displayName = 'CodeBlock';

export { CodeBlock };
export type { CodeBlockProps };
