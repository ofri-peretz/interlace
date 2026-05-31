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
 * The header is omitted entirely when neither `title` nor `language` are
 * provided AND copy is disabled, so the primitive degrades to a clean
 * `<figure><pre><code/></pre></figure>` for inline snippets.
 *
 * ## Anatomy
 *
 *   CodeBlock                          (figure — data-min-viewport=320)
 *     ├─ figcaption                    (header bar; rendered only when needed)
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
};

const CodeBlock = React.forwardRef<HTMLElement, CodeBlockProps>(
  ({ className, title, language, children, loading, ...props }, ref) => {
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
        typeof children === 'string'
          ? children
          : (codeRef.current?.textContent ?? '');

      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        }
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
      } catch {
        // Clipboard can reject in insecure contexts / sandboxed iframes. We
        // intentionally swallow — the snippet is still visible and selectable.
      }
    }, [children]);

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

    const showHeader = Boolean(title) || Boolean(language) || true; // always show — copy button needs a home
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
        {showHeader ? (
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
        ) : null}
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
