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
 * With `href` the wordmark is a link, and `label` is its accessible name
 * ("Acme, home"), read once instead of every line in a row.
 * Without `href` it is an image of text: `role="img"` with `label` as its
 * name.
 *
 * ## Anatomy
 *
 *   Wordmark                 (a | span — data-slot="wordmark", data-variant, data-size)
 *     └─ WordmarkLine × n    (span — lang, dir)
 *
 * ## MIN_VIEWPORT — 320
 *
 * The lockup is about 9rem wide at most; nothing wraps.
 *
 * | Rule | Concept                 | Where in this file                                       |
 * | ---- | ----------------------- | -------------------------------------------------------- |
 * | R4   | Extends native el       | `a` / `span` props                                       |
 * | R6   | data-slot per part      | wordmark / wordmark-line                                 |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                        |
 * | R8   | Enums, not booleans     | `variant`, `size`                                        |
 * | R14  | Declares min viewport   | `data-min-viewport` on the root + exported const         |
 * | R19  | Tokens only             | `bg-background`, `text-primary`, `outline-primary`       |
 * | R25  | Server component        | No hooks → no `'use client'`                             |
 * | R26  | A11y from native el     | A link or an image with one name; each line keeps its `lang` |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

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

type WordmarkProps = Omit<React.ComponentProps<'a'>, 'children'> & {
  /** The name, read once: "Acme" or "Acme, home". */
  label: string;
  /** @default 'framed' */
  variant?: WordmarkVariant;
  /** `sm` is about two thirds the size; `responsive` is `sm` below the `md` breakpoint. @default 'md' */
  size?: WordmarkSize;
  /** One `Wordmark.Line` per script, top to bottom. */
  children: React.ReactNode;
};

function Wordmark({ label, variant = 'framed', size = 'md', href, className, children, ...props }: WordmarkProps) {
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
  return href ? (
    <a href={href} aria-label={label} {...shared} {...props}>
      {children}
    </a>
  ) : (
    <span role="img" aria-label={label} {...shared} {...(props as React.ComponentProps<'span'>)}>
      {children}
    </span>
  );
}

type WordmarkLineProps = React.ComponentProps<'span'> & {
  /** The line's language: "en", "ja", "ar". */
  lang: string;
};

function WordmarkLine({ className, ...props }: WordmarkLineProps) {
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
    />
  );
}

const WordmarkWithLine = Object.assign(Wordmark, { Line: WordmarkLine });

export { WordmarkWithLine as Wordmark, WordmarkLine };
export type { WordmarkProps, WordmarkLineProps };
