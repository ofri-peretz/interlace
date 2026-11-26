'use client';

/**
 * @interlace/ui — ReflectionCard
 *
 * A quiet minute in a loud room: one prompt ("What surprised you today?"),
 * a field, and a promise that the answer is yours. It is private by
 * default; when the session allows it, the writer can choose to share it
 * with the room without their name, and only then is it checked like any
 * other room text (no links, no contact details, the blocklist). Saving
 * keeps the words in the card; where they are stored (this device, an
 * account) is the app's choice, and `privacy` says so in its own words.
 *
 * ## Anatomy
 *
 *   ReflectionCard                 (form — data-slot="reflection-card", data-state=writing|saved)
 *     ├─ div                       (data-slot="reflection-card-meta": e.g. "1 of 3", optional)
 *     ├─ label                     (data-slot="reflection-card-prompt": names the field)
 *     ├─ Textarea                  (data-slot="reflection-card-field": described by privacy + count)
 *     ├─ p                         (data-slot="reflection-card-privacy": "Only you see this.")
 *     ├─ label + Checkbox          (data-slot="reflection-card-share", when `shareable`)
 *     ├─ Button                    (data-slot="reflection-card-save")
 *     └─ p aria-live               (data-slot="reflection-card-message": saved, shared, or why not)
 *
 * ## Motion
 *
 * None beyond the controls' own. A reflection is not a reveal.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `form` props                                         |
 * | R6   | data-slot per part        | reflection-card / -meta / -prompt / -field / -privacy / -share / -save / -message |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R9   | Controlled + uncontrolled | `value` / `defaultValue` / `onChange` / `onSave`     |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R26  | A11y                      | labelled field; privacy and count describe it; outcome announced |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { Checkbox } from '../primitives/checkbox.js';
import { Textarea } from '../primitives/textarea.js';
import { checkText, visibleLength, type TextRefusal } from './text-safety-model.js';

export const MIN_VIEWPORT = 320 as const;

interface ReflectionCardLabels {
  /** @default 'Only you see this.' */
  privacy?: string;
  /** @default 'Share it with the room, without my name' */
  share?: string;
  /** @default 'Save' */
  save?: string;
  /** @default 'Saved.' */
  saved?: string;
  /** @default 'Saved, and shared without your name.' */
  shared?: string;
  /** @default (n) => `${n} characters left` */
  left?: (remaining: number) => string;
  /** Why a shared reflection was not sent. It is still saved. */
  refused?: Partial<Record<TextRefusal, string>>;
}

type ReflectionCardProps = Omit<React.ComponentProps<'form'>, 'children' | 'onChange' | 'defaultValue' | 'onSubmit'> & {
  prompt: React.ReactNode;
  /** Above the prompt, e.g. "1 of 3". */
  meta?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: (text: string) => void;
  /** Called on save with the text and whether it is shared. A shared text has passed the room's checks. */
  onSave?: (text: string, options: { shared: boolean }) => void;
  /** Offer to share it with the room, without a name. @default false */
  shareable?: boolean;
  /** Words the room refuses, for a shared reflection. */
  blocklist?: readonly string[];
  /** @default 500 */
  maxLength?: number;
  /** @default 4 */
  rows?: number;
  placeholder?: string;
  labels?: ReflectionCardLabels;
};

const REFUSED: Record<TextRefusal, string> = {
  empty: 'Write something first.',
  'too-long': 'Saved. It is too long to share; try a shorter version.',
  'too-many-words': 'Saved. It is too long to share; try a shorter version.',
  link: 'Saved, not shared: links cannot be shared with the room.',
  contact: 'Saved, not shared: email addresses and phone numbers cannot be shared.',
  blocked: 'Saved, not shared: try other words to share it.',
};

type Status = { kind: 'writing' } | { kind: 'saved'; shared: boolean } | { kind: 'refused'; reason: TextRefusal };

function ReflectionCard({
  prompt,
  meta,
  value: valueProp,
  defaultValue = '',
  onChange,
  onSave,
  shareable = false,
  blocklist,
  maxLength = 500,
  rows = 4,
  placeholder,
  labels,
  className,
  ...props
}: ReflectionCardProps) {
  const [own, setOwn] = React.useState(defaultValue);
  const text = valueProp ?? own;
  const [share, setShare] = React.useState(false);
  const [status, setStatus] = React.useState<Status>({ kind: 'writing' });
  const fieldId = React.useId();
  const privacyId = React.useId();
  const countId = React.useId();
  const remaining = maxLength - visibleLength(text);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setStatus({ kind: 'refused', reason: 'empty' });
      return;
    }
    if (share) {
      const check = checkText(trimmed, { maxLength, blocklist });
      if (!check.ok) {
        // A private reflection is never refused: it is saved, just not shared.
        onSave?.(trimmed, { shared: false });
        setStatus({ kind: 'refused', reason: check.reason });
        return;
      }
      onSave?.(check.text, { shared: true });
      setStatus({ kind: 'saved', shared: true });
      return;
    }
    onSave?.(trimmed, { shared: false });
    setStatus({ kind: 'saved', shared: false });
  };

  const message =
    status.kind === 'saved'
      ? status.shared
        ? (labels?.shared ?? 'Saved, and shared without your name.')
        : (labels?.saved ?? 'Saved.')
      : status.kind === 'refused'
        ? (labels?.refused?.[status.reason] ?? REFUSED[status.reason])
        : '';

  return (
    <form
      data-slot="reflection-card"
      data-state={status.kind === 'saved' ? 'saved' : 'writing'}
      data-min-viewport={String(MIN_VIEWPORT)}
      noValidate
      onSubmit={submit}
      className={cn('bg-card grid max-w-xl gap-3 rounded-xl border p-5', className)}
      {...props}
    >
      {meta ? (
        <div data-slot="reflection-card-meta" className="text-muted-foreground text-sm font-medium">
          {meta}
        </div>
      ) : null}
      <label
        htmlFor={fieldId}
        data-slot="reflection-card-prompt"
        className="font-heading text-lg font-semibold text-balance"
      >
        {prompt}
      </label>
      <Textarea
        id={fieldId}
        data-slot="reflection-card-field"
        value={text}
        rows={rows}
        placeholder={placeholder}
        aria-describedby={`${privacyId} ${countId}`}
        aria-invalid={status.kind === 'refused' && status.reason === 'empty' ? true : undefined}
        onChange={(e) => {
          if (valueProp === undefined) setOwn(e.target.value);
          onChange?.(e.target.value);
          if (status.kind !== 'writing') setStatus({ kind: 'writing' });
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p id={privacyId} data-slot="reflection-card-privacy" className="text-muted-foreground text-sm">
          {labels?.privacy ?? 'Only you see this.'}
        </p>
        <span
          id={countId}
          className={cn('text-xs tabular-nums', remaining < 0 ? 'text-destructive' : 'text-muted-foreground')}
        >
          {(labels?.left ?? ((n: number) => `${n} characters left`))(remaining)}
        </span>
      </div>
      {shareable ? (
        <label data-slot="reflection-card-share" className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={share}
            onCheckedChange={(v) => {
              setShare(v === true);
              if (status.kind !== 'writing') setStatus({ kind: 'writing' });
            }}
            className="mt-0.5"
          />
          <span>{labels?.share ?? 'Share it with the room, without my name'}</span>
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button data-slot="reflection-card-save" type="submit">
          {labels?.save ?? 'Save'}
        </Button>
        <p
          data-slot="reflection-card-message"
          aria-live="polite"
          className={cn('text-sm', status.kind === 'refused' ? 'text-destructive' : 'text-muted-foreground')}
        >
          {message}
        </p>
      </div>
    </form>
  );
}
ReflectionCard.displayName = 'ReflectionCard';

export { ReflectionCard };
export type { ReflectionCardProps, ReflectionCardLabels };
