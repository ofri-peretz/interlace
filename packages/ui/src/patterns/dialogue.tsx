/**
 * @interlace/ui — Dialogue
 *
 * A written conversation: a script of turns, each with a speaker. Use it for
 * a sample support chat, an interview
 * excerpt, or a worked example of a hard conversation. Turns from the two
 * sides sit on opposite edges so the back-and-forth reads at a glance, and
 * every turn names its speaker in text, so nothing depends on position or
 * colour.
 *
 * ## Speakers
 *
 * `speakers="above"` (default) sets each name over its bubble, small and
 * muted. `speakers="inside"` sets it as the bubble's first line, in bold, so
 * a tight transcript reads like a chat. Either way the name is text and is
 * read before the turn.
 *
 * ## Tones
 *
 * A turn's bubble defaults by side: `muted` at the start, `accent` at the
 * end. `inverse` is the high-contrast bubble (`bg-foreground` with
 * `text-background`) for the voice the page wants heard. A `Citation` chip
 * inside an `inverse` bubble flips to a light pill so it keeps its contrast.
 *
 * ## Suggestions
 *
 * `DialogueSuggestions` is the row of follow-ups under a transcript ("They
 * might ask: …", "See all 9 sources"). Each `DialogueSuggestion` is a pill:
 * a link with `href`, a button without, or your own element with `asChild`
 * (`next/link`), cloned server-side.
 *
 * ## Anatomy
 *
 *   Dialogue                          (ol — data-min-viewport=320, data-speakers)
 *     └─ DialogueTurn × n             (li — data-side=start|end, data-tone)
 *         ├─ speaker                  (p — above the bubble, or over its top padding)
 *         └─ bubble                   (div — children)
 *   DialogueSuggestions               (div — a wrapping row)
 *     └─ DialogueSuggestion × n       (a | button | asChild)
 *
 * ## MIN_VIEWPORT — 320
 *
 * Bubbles cap at 85% of the column, so both sides still read at 320px.
 * Suggestions wrap.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `ol` / `li` / `div` / `a` props                             |
 * | R6   | data-slot per part               | dialogue / -turn / -speaker / -bubble / -suggestions / -suggestion |
 * | R7   | cn + ...rest                     | `cn(…, className)` + `{...props}`                           |
 * | R8   | Enums, not booleans              | `side`, `tone`, `speakers`                                  |
 * | R10  | Composition seam                 | `DialogueSuggestion asChild` (server-safe cloneElement)     |
 * | R14  | Declares min viewport            | `data-min-viewport` on the root + exported const            |
 * | R19  | Tokens only                      | `bg-muted`, `bg-accent`, `bg-foreground`, `border-primary`  |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | An ordered list of turns; the speaker is text               |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

export type DialogueTone = 'muted' | 'accent' | 'inverse';

type DialogueProps = React.ComponentProps<'ol'> & {
  /** Where each turn names its speaker: over the bubble, or as its first line. @default 'above' */
  speakers?: 'above' | 'inside';
};

function Dialogue({ speakers = 'above', className, ...props }: DialogueProps) {
  return (
    <ol
      data-slot="dialogue"
      data-speakers={speakers}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('group/dialogue isolate flex flex-col gap-4', className)}
      {...props}
    />
  );
}

const BUBBLE: Record<DialogueTone, string> = {
  muted: 'bg-muted text-foreground',
  accent: 'bg-accent text-accent-foreground',
  // A Citation chip is text-primary on a primary tint; on the inverse
  // surface that pair loses its contrast, so the chip turns light.
  inverse:
    'bg-foreground text-background [&_[data-slot=citation-trigger]]:bg-background [&_[data-slot=citation-trigger]]:text-foreground',
};

/** The speaker's colour when it sits inside the bubble. */
const SPEAKER_INSIDE: Record<DialogueTone, string> = {
  muted: '[--dialogue-speaker:var(--primary)]',
  accent: '[--dialogue-speaker:var(--accent-foreground)]',
  inverse: '[--dialogue-speaker:var(--background)]',
};

/*
 * `speakers="inside"` stacks the speaker and the bubble in one grid cell:
 * one element, read once and in order, drawn over the bubble's top padding.
 */
const INSIDE_LI =
  "group-data-[speakers=inside]/dialogue:grid group-data-[speakers=inside]/dialogue:[grid-template-areas:'turn']";
const INSIDE_SPEAKER =
  'group-data-[speakers=inside]/dialogue:z-raised group-data-[speakers=inside]/dialogue:[grid-area:turn] group-data-[speakers=inside]/dialogue:self-start group-data-[speakers=inside]/dialogue:justify-self-start group-data-[speakers=inside]/dialogue:px-4 group-data-[speakers=inside]/dialogue:pt-3 group-data-[speakers=inside]/dialogue:font-bold group-data-[speakers=inside]/dialogue:text-(--dialogue-speaker)';
const INSIDE_BUBBLE =
  'group-data-[speakers=inside]/dialogue:[grid-area:turn] group-data-[speakers=inside]/dialogue:pt-8';

type DialogueTurnProps = React.ComponentProps<'li'> & {
  /** Who is speaking. Always shown. */
  speaker: React.ReactNode;
  /** Which edge the turn sits on. Keep one speaker per side. @default 'start' */
  side?: 'start' | 'end';
  /** The bubble. @default 'muted' at the start, 'accent' at the end */
  tone?: DialogueTone;
};

function DialogueTurn({ speaker, side = 'start', tone, className, children, ...props }: DialogueTurnProps) {
  const end = side === 'end';
  const resolvedTone = tone ?? (end ? 'accent' : 'muted');
  return (
    <li
      data-slot="dialogue-turn"
      data-side={side}
      data-tone={resolvedTone}
      className={cn(
        'flex max-w-[85%] flex-col gap-1',
        end ? 'items-end self-end' : 'items-start',
        INSIDE_LI,
        SPEAKER_INSIDE[resolvedTone],
        className,
      )}
      {...props}
    >
      <p data-slot="dialogue-speaker" className={cn('text-muted-foreground text-xs font-semibold', INSIDE_SPEAKER)}>
        {speaker}
      </p>
      <div
        data-slot="dialogue-bubble"
        className={cn(
          'rounded-2xl px-4 py-3 text-base leading-relaxed',
          end ? 'rounded-se-sm' : 'rounded-ss-sm',
          BUBBLE[resolvedTone],
          INSIDE_BUBBLE,
        )}
      >
        {children}
      </div>
    </li>
  );
}

function DialogueSuggestions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialogue-suggestions"
      className={cn('flex flex-wrap items-center gap-2', className)}
      {...props}
    />
  );
}

const SUGGESTION =
  'border-primary text-primary hover:bg-primary/10 focus-visible:ring-ring/50 inline-flex min-h-control items-center rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-[3px]';

type DialogueSuggestionProps = React.ComponentProps<'a'> & {
  /**
   * Render as the single child element (`<Link href="…">`), cloned on the
   * server with the pill's classes merged in.
   */
  asChild?: boolean;
};

function DialogueSuggestion({ asChild, href, className, children, ...props }: DialogueSuggestionProps) {
  const classes = cn(SUGGESTION, className);
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    return React.cloneElement(child, {
      ...props,
      ...child.props,
      'data-slot': 'dialogue-suggestion',
      className: cn(classes, child.props.className),
    } as React.HTMLAttributes<HTMLElement>);
  }
  if (href) {
    return (
      <a data-slot="dialogue-suggestion" href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      data-slot="dialogue-suggestion"
      className={classes}
      {...(props as React.ComponentProps<'button'>)}
    >
      {children}
    </button>
  );
}

const DialogueWithDot = Object.assign(Dialogue, {
  Turn: DialogueTurn,
  Suggestions: DialogueSuggestions,
  Suggestion: DialogueSuggestion,
});

export { DialogueWithDot as Dialogue, DialogueTurn, DialogueSuggestions, DialogueSuggestion };
export type { DialogueProps, DialogueTurnProps, DialogueSuggestionProps };
