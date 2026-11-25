'use client';

/**
 * @interlace/ui — JoinCode
 *
 * How people get into a live room: the address to visit, a code to type
 * there, and a QR code that does both in one scan. Built for the host's big
 * screen first (`size="stage"`), and just as usable on a phone that wants to
 * pass the room on, with a copy-link button.
 *
 * ## Anatomy
 *
 *   JoinCode                       (div — data-slot="join-code", @container)
 *     ├─ QrCode                    (data-slot="join-code-qr", the full join link)
 *     └─ div                       (data-slot="join-code-text")
 *         ├─ p                     (data-slot="join-code-where": "Join at example.com/play")
 *         ├─ p                     (data-slot="join-code-value": "K7Q 4MZ", read letter by letter)
 *         ├─ p?                    (data-slot="join-code-expiry": "Works for 12 more minutes")
 *         ├─ Button                (data-slot="join-code-copy": copies the link)
 *         └─ span aria-live        (data-slot="join-code-status": "Link copied.")
 *
 * ## Reading the code
 *
 * The code is drawn in groups of three in tabular, monospaced figures, and
 * screen readers get it spaced letter by letter ("K 7 Q 4 M Z") through an
 * `aria-label`, so it is never read as a word. Codes from `makeJoinCode`
 * leave out the characters people mix up (0/O, 1/I/L).
 *
 * ## Layout
 *
 * A container query, not the viewport: side by side from `@md` (28rem) of
 * its own width, stacked and centred below. In RTL the QR moves to the
 * inline start, like any other leading element; the code itself stays LTR.
 *
 * ## Expiry
 *
 * With `expiresAt` (the room's `codeExpiresAt`), a line says how many
 * minutes the code still works, updated each minute. Once it has passed,
 * `data-state="expired"`: the QR code goes, the code is struck through, and
 * the line says so, announced once. Expiry is enforced by the room
 * (`rejectRoomEvent` refuses new joins with `expired`); this only shows it.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                     |
 * | ---- | ------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`                          |
 * | R6   | data-slot per part        | join-code / -qr / -text / -where / -value / -copy / -status |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                      |
 * | R8   | Enums, not booleans       | `size`                                                 |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                   |
 * | R26  | A11y                      | code spelled out; copy result announced                |
 */

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { QrCode } from './qr-code.js';
import { formatJoinCode } from './room-model.js';

export const MIN_VIEWPORT = 320 as const;

interface JoinCodeLabels {
  /** Before the address. @default (where) => `Join at ${where}` */
  where?: (where: string) => string;
  /** Names the code for assistive tech. @default (spelled) => `Room code ${spelled}` */
  code?: (spelled: string) => string;
  /** Names the QR code. @default 'QR code to join the room' */
  qr?: string;
  /** @default 'Copy link' */
  copy?: string;
  /** @default 'Link copied.' */
  copied?: string;
  /** @default 'Copy failed. Select the address and copy it.' */
  copyFailed?: string;
  /** While the code works, in whole minutes rounded up. @default (minutes) => `Works for ${minutes} more minute(s)` */
  expiresIn?: (minutes: number) => string;
  /** After it stopped working. @default 'This code has expired.' */
  expired?: string;
}

const SIZE = {
  default: { qr: 'default', code: 'text-3xl', where: 'text-sm' },
  stage: { qr: 'lg', code: 'text-5xl @3xl:text-6xl', where: 'text-lg' },
} as const;

type JoinCodeProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** The room code, e.g. from `makeJoinCode`. */
  code: string;
  /** The link the QR code opens: usually the join page with the code in it. */
  href: string;
  /** The address people type, shown as "Join at …". @default `href` without its protocol, path and query */
  where?: string;
  /** Characters per group on screen. @default 3 */
  group?: number;
  /** @default 'default' */
  size?: keyof typeof SIZE;
  /** Show the copy-link button. @default true */
  copyable?: boolean;
  /** When the code stops admitting new players, in ms: the room's `codeExpiresAt`. */
  expiresAt?: number | null;
  /** Your clock, corrected to the host's. @default Date.now */
  now?: () => number;
  labels?: JoinCodeLabels;
};

const EXPIRES_IN: NonNullable<JoinCodeLabels['expiresIn']> = (m) =>
  `Works for ${m} more ${m === 1 ? 'minute' : 'minutes'}`;

/** Minutes left until `target`, rounded up, re-rendering when the number changes; -1 once passed, null with no target. */
function useMinutesLeft(target: number | null | undefined, now: () => number): number | null {
  const has = typeof target === 'number' && Number.isFinite(target);
  const ms = has ? target - now() : 0;
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    if (!has || ms <= 0) return;
    // Wake at the next whole-minute boundary, or when the code runs out.
    const wait = ms % 60_000 || 60_000;
    const t = setTimeout(() => tick((n) => n + 1), Math.min(wait, ms));
    return () => clearTimeout(t);
  });
  if (!has) return null;
  return ms > 0 ? Math.ceil(ms / 60_000) : -1;
}

function hostOf(href: string): string {
  try {
    return new URL(href).host;
  } catch {
    return href.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0] ?? href;
  }
}

function JoinCode({
  code,
  href,
  where,
  group = 3,
  size = 'default',
  copyable = true,
  expiresAt,
  now = Date.now,
  labels,
  className,
  ...props
}: JoinCodeProps) {
  const minutes = useMinutesLeft(expiresAt, now);
  const expired = minutes !== null && minutes < 0;
  const [copied, setCopied] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  React.useEffect(() => () => clearTimeout(timer.current), []);

  const place = where ?? hostOf(href);
  const spelled = Array.from(code).join(' ');
  const s = SIZE[size];

  const copy = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setStatus(labels?.copied ?? 'Link copied.');
    } catch {
      setCopied(false);
      setStatus(labels?.copyFailed ?? 'Copy failed. Select the address and copy it.');
    }
    timer.current = setTimeout(() => {
      setCopied(false);
      setStatus('');
    }, 2400);
  };

  return (
    <div
      data-slot="join-code"
      data-size={size}
      data-state={expired ? 'expired' : 'live'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container', className)}
      {...props}
    >
      <div className="flex flex-col items-center gap-5 text-center @md:flex-row @md:items-center @md:gap-8 @md:text-start">
        {expired ? null : (
          <QrCode
            data-slot="join-code-qr"
            value={href}
            label={labels?.qr ?? 'QR code to join the room'}
            size={s.qr}
            className="border-border border"
          />
        )}
        <div data-slot="join-code-text" className="flex min-w-0 flex-col items-center gap-2 @md:items-start">
          <p data-slot="join-code-where" className={cn('text-muted-foreground', s.where)}>
            {(labels?.where ?? ((w: string) => `Join at ${w}`))(place)}
          </p>
          <p
            data-slot="join-code-value"
            dir="ltr"
            role="img"
            aria-label={(labels?.code ?? ((sp: string) => `Room code ${sp}`))(spelled)}
            className={cn(
              'font-mono leading-none font-semibold tracking-widest tabular-nums',
              expired && 'text-muted-foreground line-through',
              s.code,
            )}
          >
            {formatJoinCode(code, group)}
          </p>
          {minutes !== null ? (
            <p data-slot="join-code-expiry" className={cn('text-muted-foreground', s.where)}>
              {expired ? (labels?.expired ?? 'This code has expired.') : (labels?.expiresIn ?? EXPIRES_IN)(minutes)}
            </p>
          ) : null}
          {copyable && !expired ? (
            <Button
              data-slot="join-code-copy"
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={copy}
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {labels?.copy ?? 'Copy link'}
            </Button>
          ) : null}
          <span data-slot="join-code-status" aria-live="polite" className="sr-only">
            {expired ? (labels?.expired ?? 'This code has expired.') : status}
          </span>
        </div>
      </div>
    </div>
  );
}
JoinCode.displayName = 'JoinCode';

export { JoinCode };
export type { JoinCodeProps, JoinCodeLabels };
