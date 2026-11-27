/**
 * @interlace/ui — Wordmark
 *
 * A text logo of one or more stacked lines: a name over its tagline, or the
 * same name in several languages or scripts. Each line is a `Wordmark.Line`
 * with its own `lang` (and `dir` for a right-to-left script), so a screen
 * reader, a hyphenator and the browser's font fallback all know which
 * language each line is. It goes in `Topbar`'s `logo` slot, a footer, or
 * anywhere the name stands alone.
 *
 * ## Variants
 *
 * | `variant` | Looks like                                                   |
 * | --------- | ------------------------------------------------------------ |
 * | `framed`  | A page-coloured plate, brand-coloured text, an inset rule     |
 * | `plain`   | The stacked lines alone, in the surrounding text colour       |
 *
 * ## Sizes
 *
 * | `size`       | Lockup                                                     |
 * | ------------ | ---------------------------------------------------------- |
 * | `md`         | The full lockup (default)                                  |
 * | `sm`         | About two thirds: text a step down, a thinner plate        |
 * | `responsive` | `sm` below the `md` breakpoint, `md` from it: for a topbar |
 *
 * ## Fonts
 *
 * Lines use the heading font (`--font-heading`). For a script that font
 * lacks, add a font for it to the same stack (`--font-heading: "Inter",
 * "Noto Sans Arabic", sans-serif`): the browser picks a font per glyph, so
 * each line gets the right one with no per-language setting. Loading fonts
 * is the site's job; this file names none.
 *
 * ## Name
 *
 * A link's name must contain the words printed on it (WCAG 2.5.3, Label in
 * Name), or a person who speaks the words to a voice control finds nothing.
 * A wordmark prints every `Wordmark.Line`, so:
 *
 * - **One language or a tagline:** `label` must contain the lines, for
 *   example "Acme Field notes, home".
 * - **Several scripts:** leave `label` out. The link is then named by its
 *   lines, each in its own `lang`, and `hint=", home"` says where it goes
 *   (visually hidden, after the lines). Do not write one translated name in
 *   `label`: it will not contain the other lines.
 * - **Check it:** run axe with `label-content-name-mismatch` enabled on the
 *   page that holds the logo.
 *
 * In development a `label` that does not contain every line logs one
 * warning; it is silent in production. `hint` is ignored when `label` is
 * given, and is not allowed without `href`.
 *
 * Without `href` the wordmark is an image of text: `role="img"` with `label`
 * (required) as its name.
 *
 * ## Anatomy
 *
 *   Wordmark                 (a | span — data-slot="wordmark", data-variant, data-size)
 *     ├─ WordmarkLine × n    (span — lang, dir)
 *     └─ hint                (span — data-slot="wordmark-hint", sr-only; link only)
 *
 * ## MIN_VIEWPORT — 320
 *
 * The lockup is about 9rem wide at most; nothing wraps.
 *
 * | Rule | Concept                 | Where in this file                                       |
 * | ---- | ----------------------- | -------------------------------------------------------- |
 * | R4   | Extends native el       | `a` / `span` props                                       |
 * | R6   | data-slot per part      | wordmark / wordmark-line / wordmark-hint                                |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                        |
 * | R8   | Enums, not booleans     | `variant`, `size`                                        |
 * | R14  | Declares min viewport   | `data-min-viewport` on the root + exported const         |
 * | R19  | Tokens only             | `bg-background`, `text-primary`, `outline-primary`       |
 * | R25  | Server component        | No hooks → no `'use client'`                             |
 * | R26  | A11y from native el     | A link or an image with one name; each line keeps its `lang` |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

// Bundlers replace `process.env.NODE_ENV` at build time; this only types it, with no @types/node.
declare const process: { env: { NODE_ENV?: string } };

export const MIN_VIEWPORT = 320 as const;

export type WordmarkVariant = 'framed' | 'plain';

export type WordmarkSize = 'md' | 'sm' | 'responsive';

const VARIANT: Record<WordmarkVariant, string> = {
  // A plate in the page colour with a brand rule set inside its edge.
  framed: 'bg-background text-primary border-background outline-primary',
  plain: '',
};

// The plate's padding and rule. `sm` keeps the proportions at about two
// thirds; `responsive` is `sm` on a phone and `md` from the `md` breakpoint,
// so a stacked lockup does not take a fifth of a phone's screen in a sticky bar.
const MD_FRAME = 'rounded-lg border-[3px] px-5 pt-2 pb-1.5 outline-[3px] outline-offset-[-7px]';
const SM_FRAME = 'rounded-md border-2 px-3 pt-1 pb-0.5 outline-2 outline-offset-[-5px]';
const FRAME: Record<WordmarkSize, string> = {
  md: MD_FRAME,
  sm: SM_FRAME,
  responsive: `${SM_FRAME} md:rounded-lg md:border-[3px] md:px-5 md:pt-2 md:pb-1.5 md:outline-[3px] md:outline-offset-[-7px]`,
};

type WordmarkCommon = {
  /** @default 'framed' */
  variant?: WordmarkVariant;
  /** `sm` is about two thirds the size; `responsive` is `sm` below the `md` breakpoint. @default 'md' */
  size?: WordmarkSize;
  /** One `Wordmark.Line` per script, top to bottom. */
  children: React.ReactNode;
};

type WordmarkLinkProps = Omit<React.ComponentProps<'a'>, 'children'> &
  WordmarkCommon & {
    href: string;
    /**
     * The link's name, replacing its lines. Leave it out and the link is named by its lines. When given
     * it must contain every line ("Acme Field notes, home"): WCAG 2.5.3, Label in Name.
     */
    label?: string;
    /** Words only a screen reader needs, after the lines: ", home". Ignored when `label` is given. */
    hint?: string;
  };

type WordmarkImageProps = Omit<React.ComponentProps<'span'>, 'children'> &
  WordmarkCommon & {
    href?: undefined;
    /** The image's name, read once: "Acme". */
    label: string;
    hint?: never;
  };

type WordmarkProps = WordmarkLinkProps | WordmarkImageProps;

// The text of each line that is a plain string, in order, looking through fragments. A line
// built from elements is skipped: its text is only known after render, so nothing is claimed.
function lineTexts(children: React.ReactNode): string[] {
  const texts: string[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return;
    if (child.type === React.Fragment) {
      texts.push(...lineTexts(child.props.children));
    } else if (child.type === WordmarkLine) {
      const parts = React.Children.toArray(child.props.children);
      if (parts.every((part) => typeof part === 'string' || typeof part === 'number')) {
        const text = parts.join('').trim();
        if (text) texts.push(text);
      }
    }
  });
  return texts;
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

function warnIfLabelMissesLines(label: string, children: React.ReactNode) {
  if (process.env.NODE_ENV === 'production') return;
  const name = squash(label);
  const missing = lineTexts(children).filter((line) => !name.includes(squash(line)));
  if (missing.length > 0) {
    console.warn(
      `Wordmark: label "${label}" does not contain the visible ${missing.length === 1 ? 'line' : 'lines'} ` +
        `${missing.map((m) => `"${m}"`).join(', ')} (WCAG 2.5.3, Label in Name). ` +
        'Leave `label` out to name the link by its lines, or write a label that contains them.',
    );
  }
}

function Wordmark({ label, hint, variant = 'framed', size = 'md', href, className, children, ...props }: WordmarkProps) {
  const classes = cn(
    'group/wordmark font-heading inline-flex shrink-0 flex-col items-center leading-[1.05] whitespace-nowrap',
    VARIANT[variant],
    variant === 'framed' && FRAME[size],
    // The focus ring is a box-shadow, so the framed plate keeps its inset rule.
    href && 'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    href && variant === 'plain' && 'outline-none',
    className,
  );
  const shared = {
    'data-slot': 'wordmark',
    'data-variant': variant,
    'data-size': size,
    'data-min-viewport': String(MIN_VIEWPORT),
    className: classes,
  };
  if (href === undefined) {
    return (
      <span role="img" aria-label={label} {...shared} {...(props as React.ComponentProps<'span'>)}>
        {children}
      </span>
    );
  }
  if (label !== undefined) warnIfLabelMissesLines(label, children);
  return (
    <a href={href} aria-label={label} {...shared} {...(props as React.ComponentProps<'a'>)}>
      {children}
      {label === undefined && hint ? (
        <span data-slot="wordmark-hint" className="sr-only">
          {hint}
        </span>
      ) : null}
    </a>
  );
}

type WordmarkLineProps = React.ComponentProps<'span'> & {
  /** The line's language: "en", "ja", "ar". */
  lang: string;
};

function WordmarkLine({ className, children, ...props }: WordmarkLineProps) {
  // A trailing space (collapsed, so invisible) separates this line from the next in the name a
  // browser computes and in the text axe reads, in any CSS: "ACME アクメ أكمي", not "ACMEアクメأكمي".
  return (
    <span
      data-slot="wordmark-line"
      className={cn(
        'block text-base font-extrabold first:text-lg [&:lang(en)]:tracking-wide',
        // The size lives on the Wordmark; a line reads it from there.
        'group-data-[size=sm]/wordmark:text-xs group-data-[size=sm]/wordmark:first:text-sm',
        'max-md:group-data-[size=responsive]/wordmark:text-xs max-md:group-data-[size=responsive]/wordmark:first:text-sm',
        className,
      )}
      {...props}
    >
      {children}{' '}
    </span>
  );
}

const WordmarkWithLine = Object.assign(Wordmark, { Line: WordmarkLine });

export { WordmarkWithLine as Wordmark, WordmarkLine };
export type { WordmarkProps, WordmarkLinkProps, WordmarkImageProps, WordmarkLineProps };
