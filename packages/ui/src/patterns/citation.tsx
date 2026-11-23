'use client';

/**
 * @interlace/ui — Citation
 *
 * An inline source marker for a sentence that makes a claim. The reader taps
 * or tabs to the marker and a popover lists every source behind the claim:
 * who published it, what kind of source it is, and the exact words quoted
 * from it. Several sources stack in one popover, in the order given.
 *
 * Built for writing that has to show its work (explainers, fact checks,
 * reports): the sentence stays readable, the evidence is one keystroke away.
 *
 * ## Anatomy
 *
 *   Citation                          (span — data-slot="citation")
 *     ├─ {children}                   (the claim text; inside the trigger for `marker="underline"`)
 *     └─ Popover
 *         ├─ PopoverTrigger           (sup > button for `number`, the underlined text for `underline`)
 *         └─ PopoverContent           (data-min-viewport=320)
 *             ├─ status Badge         (optional: enough / short of sources)
 *             └─ ol > CitationSource  (publisher link, kind, blockquote)
 *
 * ## Markers
 *
 * - `number` (default): the text renders as plain text and a superscript
 *   number follows it, like a footnote. Use it in dense prose.
 * - `underline`: the text itself is the trigger, with a dotted underline.
 *   Use it when the whole phrase is the claim.
 *
 * ## Safety
 *
 * Only `https:` URLs become links. Anything else (an `http:` page, a
 * `javascript:` string from bad data) renders the publisher as plain text,
 * so a malformed source can never put a dangerous link in front of a reader.
 *
 * ## Server rendering
 *
 * The claim text and the marker are in the server HTML; only the popover
 * needs the client. Without JavaScript the reader still sees the sentence and
 * the marker.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The popover is `w-80` capped at `100vw - 2rem`, and Base UI's positioner
 * shifts it into view, so it fits the 320 floor.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'span'>` on the root                  |
 * | R6   | data-slot per part               | citation / -trigger / -content / -source                    |
 * | R7   | cn + ...rest                     | `cn(…, className)` + `{...props}` on the root               |
 * | R8   | Enums, not booleans              | `marker`, `status`                                          |
 * | R12  | Reuse over wrap                  | Popover owns dismissal, focus return, positioning           |
 * | R14  | Declares min viewport            | `data-min-viewport` on the popup + exported const           |
 * | R19  | Tokens only                      | `text-primary`, `border-border`, Badge tones                |
 * | R25  | Client component                 | Required — Popover ships client hooks                       |
 * | R26  | Keyboard + touch                 | Native button trigger: Enter/Space/tap open, Escape closes  |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Badge } from '../primitives/badge.js';
import { Popover, PopoverContent, PopoverTrigger } from '../primitives/popover.js';

export const MIN_VIEWPORT = 320 as const;

export interface CitationSourceData {
  /** Who published it: "Reuters", "UN OCHA", "The Times of Israel". */
  publisher: string;
  /** Link to the page the quote comes from. Only `https:` URLs render as links. */
  url?: string;
  /** What kind of source: "news report", "official record", "academic paper". */
  kind?: string;
  /** The exact words from the source. Rendered as a blockquote. */
  quote?: React.ReactNode;
  /** Extra detail after the kind, such as "AP wire copy". */
  note?: string;
}

export type CitationStatus = 'enough' | 'short';

const STATUS_LABEL: Record<CitationStatus, string> = {
  enough: 'Enough sources',
  short: 'Short of sources',
};

/** `https:` only. Anything else renders as plain text. */
export const safeHref = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  try {
    return new URL(url).protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
};

export type CitationProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  /** The claim text the sources back. */
  children: React.ReactNode;
  /** One or more sources. They stack in the popover in this order. */
  sources: CitationSourceData[];
  /** `number` puts a footnote number after the text; `underline` makes the text the trigger. @default 'number' */
  marker?: 'number' | 'underline';
  /** The footnote number for `marker="number"`. @default 1 */
  number?: number;
  /** Whether the claim meets your sourcing bar. `short` shows a warning badge. */
  status?: CitationStatus;
  /** Replace the status badge text, for example to translate it. */
  statusLabel?: string;
  /** Accessible name of the trigger. @default "Sources (n)" */
  triggerLabel?: string;
};

function CitationSource({ source }: { source: CitationSourceData }) {
  const href = safeHref(source.url);
  const detail = [source.kind, source.note].filter(Boolean).join(', ');
  return (
    <li data-slot="citation-source" className="space-y-2">
      <p className="text-sm">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium underline underline-offset-4"
          >
            {source.publisher}
          </a>
        ) : (
          <span className="font-medium">{source.publisher}</span>
        )}
        {detail ? <span className="text-muted-foreground"> ({detail})</span> : null}
      </p>
      {source.quote ? (
        <blockquote className="border-border text-muted-foreground border-l-2 pl-3 text-sm italic">
          {source.quote}
        </blockquote>
      ) : null}
    </li>
  );
}

function Citation({
  children,
  sources,
  marker = 'number',
  number = 1,
  status,
  statusLabel,
  triggerLabel,
  className,
  ...props
}: CitationProps) {
  const label = triggerLabel ?? `Sources (${sources.length})`;
  const content = (
    <PopoverContent
      data-slot="citation-content"
      align="start"
      className="max-h-96 w-80 max-w-[calc(100vw-2rem)] space-y-3 overflow-y-auto"
    >
      {status ? (
        <Badge variant={status === 'short' ? 'warning' : 'success'}>
          {statusLabel ?? STATUS_LABEL[status]}
        </Badge>
      ) : null}
      <ol className="space-y-4">
        {sources.map((source, i) => (
          <CitationSource key={`${source.publisher}-${i}`} source={source} />
        ))}
      </ol>
    </PopoverContent>
  );

  return (
    <span data-slot="citation" data-marker={marker} className={cn('inline', className)} {...props}>
      <Popover>
        {marker === 'underline' ? (
          // A span, not a button: a button is an atomic inline box, so a
          // long phrase would refuse to wrap across lines. Base UI gives the
          // span role="button", tabIndex and Enter/Space handling.
          <PopoverTrigger
            data-slot="citation-trigger"
            nativeButton={false}
            render={<span />}
            className="decoration-muted-foreground hover:decoration-foreground cursor-help rounded-sm underline decoration-dotted underline-offset-4"
          >
            {children}
            <span className="sr-only">, {label}</span>
          </PopoverTrigger>
        ) : (
          <>
            {children}
            <sup className="ms-0.5">
              <PopoverTrigger
                data-slot="citation-trigger"
                aria-label={label}
                className="text-primary hover:bg-accent inline-flex min-h-6 min-w-6 items-center justify-center rounded-sm px-0.5 text-xs font-semibold tabular-nums"
              >
                [{number}]
              </PopoverTrigger>
            </sup>
          </>
        )}
        {content}
      </Popover>
    </span>
  );
}

export { Citation, CitationSource };
