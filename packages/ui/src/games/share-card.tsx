'use client';

/**
 * @interlace/ui — ShareCard
 *
 * How the player did today, ready to share without spoiling it: one mark per
 * round (a band, never the answer), the score and the streak, with a Share
 * button that opens the device's share sheet and a Copy button that puts the
 * same text on the clipboard. The text comes from `shareText` in
 * `share-model.ts`, so a server can build the same line for a link preview.
 *
 * ## Anatomy
 *
 *   ShareCard                      (div — data-slot="share-card")
 *     ├─ p                         (data-slot="share-card-title": name and number)
 *     ├─ p                         (data-slot="share-card-marks": the marks, hidden from AT; a sentence beside them)
 *     ├─ p                         (data-slot="share-card-note": one line of news, with `note`)
 *     ├─ p                         (data-slot="share-card-score")
 *     ├─ div                       (data-slot="share-card-actions": Share, Copy)
 *     └─ p aria-live="polite"      (data-slot="share-card-status": "Copied.")
 *
 * ## Marks and assistive tech
 *
 * A row of emoji reads as "green square, yellow square, direct hit". The
 * marks are `aria-hidden`, and a sentence ("Round 1: close. Round 2: near.")
 * carries the same thing in words, from `bandLabels`.
 *
 * ## Share, then copy
 *
 * Share shows only where `navigator.share` exists (most phones). Copy is
 * always there; without clipboard access it selects a read-only field
 * holding the text so the player can copy it by hand.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                              |
 * | ---- | ------------------------- | ----------------------------------------------- |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                   |
 * | R6   | data-slot per part        | share-card / -title / -marks / -note / -score / -actions / -status |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`               |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const            |
 * | R19  | Tokens only               | card, border, muted-foreground                  |
 * | R26  | A11y                      | marks in words; live status; real buttons       |
 */

import * as React from 'react';
import { Copy, Share2 } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { DEFAULT_SYMBOLS, shareMarks, shareText, type ShareTextInput } from './share-model.js';

export const MIN_VIEWPORT = 320 as const;

const BAND_LABELS: Record<string, string> = {
  exact: 'spot on',
  close: 'close',
  near: 'not far',
  far: 'far off',
  right: 'right',
  wrong: 'wrong',
};

interface ShareCardLabels {
  share?: string;
  copy?: string;
  copied?: string;
  /** When the clipboard is not available. @default 'Select the text and copy it.' */
  copyFallback?: string;
  /** @default (i, band) => `Round ${i}: ${band}.` */
  round?: (index: number, band: string) => string;
  /** @default (score, max) => `${score} of ${max} points` */
  score?: (score: string, max?: string) => string;
  /** @default n => `${n}-day streak` */
  streak?: (n: string) => string;
}

type ShareCardProps = Omit<React.ComponentProps<'div'>, 'title' | 'results'> &
  ShareTextInput & {
    /** Words for each result key, read in place of the marks. */
    bandLabels?: Readonly<Record<string, string>>;
    /** Called after a share or a copy, with how it went. */
    onShare?: (method: 'share' | 'copy' | 'manual') => void;
    locale?: string;
    labels?: ShareCardLabels;
  };

function ShareCard({
  title,
  number,
  results,
  score,
  maxScore,
  note,
  streak,
  url,
  symbols = DEFAULT_SYMBOLS,
  fallback,
  numberLabel,
  streakSymbol,
  bandLabels,
  onShare,
  locale,
  labels,
  className,
  ...props
}: ShareCardProps) {
  const [status, setStatus] = React.useState('');
  const [manual, setManual] = React.useState(false);
  const [canShare, setCanShare] = React.useState(false);
  const fieldRef = React.useRef<HTMLTextAreaElement>(null);
  const text = shareText({ title, number, results, score, maxScore, note, streak, url, symbols, fallback, numberLabel, streakSymbol });
  const nf = new Intl.NumberFormat(locale);

  React.useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);
  React.useEffect(() => {
    if (manual) fieldRef.current?.select();
  }, [manual]);

  // A live region speaks only when its text changes, so clear it first and
  // set the message a moment later: a second copy is announced again.
  const announceTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  React.useEffect(() => () => clearTimeout(announceTimer.current), []);
  const announce = (message: string) => {
    setStatus('');
    clearTimeout(announceTimer.current);
    announceTimer.current = setTimeout(() => setStatus(message), 50);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setManual(false);
      announce(labels?.copied ?? 'Copied.');
      onShare?.('copy');
    } catch {
      setManual(true);
      announce(labels?.copyFallback ?? 'Select the text and copy it.');
      onShare?.('manual');
    }
  };

  const share = async () => {
    try {
      await navigator.share({ text });
      onShare?.('share');
    } catch (error) {
      // The player closed the sheet: nothing to say. Anything else: copy instead.
      if ((error as Error)?.name !== 'AbortError') await copy();
    }
  };

  const words = { ...BAND_LABELS, ...bandLabels };
  const roundWord = labels?.round ?? ((i: number, band: string) => `Round ${i}: ${band}.`);
  const sentence = results.map((r, i) => roundWord(i + 1, words[r] ?? r)).join(' ');
  const head = number === undefined ? title : `${title} ${(numberLabel ?? ((n: number) => `No. ${n}`))(number)}`;
  const scoreText =
    score === undefined
      ? null
      : (labels?.score ?? ((s: string, m?: string) => (m ? `${s} of ${m} points` : `${s} points`)))(
          nf.format(score),
          maxScore === undefined ? undefined : nf.format(maxScore),
        );

  return (
    <div
      data-slot="share-card"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('border-border bg-card text-card-foreground grid gap-3 rounded-xl border p-5', className)}
      {...props}
    >
      <p data-slot="share-card-title" className="font-heading font-semibold">
        {head}
      </p>
      {results.length ? (
        <p data-slot="share-card-marks" className="text-2xl leading-none tracking-[0.2em]">
          <span aria-hidden>{shareMarks(results, symbols, fallback)}</span>
          <span className="sr-only">{sentence}</span>
        </p>
      ) : null}
      {note ? (
        <p data-slot="share-card-note" className="font-medium">
          {note}
        </p>
      ) : null}
      {scoreText || streak ? (
        <p data-slot="share-card-score" className="text-muted-foreground text-sm tabular-nums">
          {scoreText}
          {scoreText && streak ? <span aria-hidden> · </span> : null}
          {streak ? (labels?.streak ?? ((n: string) => `${n}-day streak`))(nf.format(streak)) : null}
        </p>
      ) : null}
      <div data-slot="share-card-actions" className="flex flex-wrap gap-2">
        {canShare ? (
          <Button type="button" onClick={share}>
            <Share2 aria-hidden />
            {labels?.share ?? 'Share'}
          </Button>
        ) : null}
        <Button type="button" variant={canShare ? 'outline' : 'default'} onClick={copy}>
          <Copy aria-hidden />
          {labels?.copy ?? 'Copy result'}
        </Button>
      </div>
      {manual ? (
        <textarea
          ref={fieldRef}
          readOnly
          data-slot="share-card-text"
          aria-label={labels?.copy ?? 'Copy result'}
          rows={text.split('\n').length}
          value={text}
          className="border-input bg-background w-full resize-none rounded-md border p-2 font-mono text-sm"
        />
      ) : null}
      <p data-slot="share-card-status" aria-live="polite" className="text-sm font-medium empty:hidden">
        {status}
      </p>
    </div>
  );
}
ShareCard.displayName = 'ShareCard';

export { ShareCard };
export type { ShareCardProps, ShareCardLabels };
