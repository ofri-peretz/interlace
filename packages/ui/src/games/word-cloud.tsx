'use client';

/**
 * @interlace/ui — WordCloud and WordEntry
 *
 * The room's words, live. Phones send a word or two with `WordEntry`; the
 * shared screen shows them as a `WordCloud` in which the words the room
 * repeats grow, the biggest sit in the middle, and every change moves into
 * place rather than jumping there. Anyone in the room sees their voice land
 * within a second, without their name on it.
 *
 * ## Anatomy
 *
 *   WordCloud                       (div — data-slot="word-cloud", @container)
 *     ├─ ul (FlipGroup)             (data-slot="word-cloud-list", rank order in the DOM)
 *     │    ├─ li × n                (data-slot="word-cloud-word", data-step=1…5, data-band, data-mine, data-top)
 *     │    └─ li × 2                (data-slot="word-cloud-break": hidden line breaks between the bands)
 *     └─ p aria-live               (data-slot="word-cloud-status": "12 words from the room", or the empty text)
 *
 *   WordEntry                       (form — data-slot="word-entry")
 *     ├─ label + Input + Button     (data-slot="word-entry-field")
 *     ├─ p aria-live               (data-slot="word-entry-message": why a word was refused, or how many are left)
 *     └─ ul                         (data-slot="word-entry-sent": the viewer's own words, as chips)
 *
 * ## Data
 *
 * `WordCloud` takes `entries` (what was typed, and by whom) and builds the
 * cloud with `buildCloud` from `word-cloud-model`, or a prebuilt `words`
 * list from a server. `WordEntry` checks each word with `checkText` from
 * `text-safety-model` before `onWord` fires, so a refused word never leaves
 * the phone; run the same check on the server, which is the one that counts.
 * Pass your room's `blocklist` to both.
 *
 * ## Motion
 *
 * The list is a FlipGroup: when a word climbs, it and its neighbours glide
 * to their new places (400ms, `--ease-move`), and a new word scales up from
 * where it lands. A word whose count went up gives one small pulse
 * (`transform` only, 250ms), so the eye finds what just changed. Under
 * reduced motion every word simply takes its place.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                     |
 * | ---- | ------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el         | `div` / `form` props                                   |
 * | R6   | data-slot per part        | word-cloud / -list / -word / -status, word-entry / …   |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                      |
 * | R9   | Controlled + uncontrolled | WordEntry `sent` / `defaultSent` / `onWord`            |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                   |
 * | R26  | A11y                      | list in rank order, each word with its count; refusals announced |
 */

import * as React from 'react';

import { FlipGroup } from '../effects/flip-group.js';
import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { Input } from '../primitives/input.js';
import { checkText, type TextRefusal, type TextRules } from './text-safety-model.js';
import {
  buildCloud,
  CLOUD_BREAKS,
  cloudOrder,
  type CloudEntry,
  type CloudOptions,
  type CloudWord,
} from './word-cloud-model.js';

export const MIN_VIEWPORT = 320 as const;

// --- WordCloud ------------------------------------------------------------------

interface WordCloudLabels {
  /** Read with each word. @default (word, count) => `${word}, ${count}` */
  word?: (text: string, count: number, formatted: string) => string;
  /** Under the cloud. @default (total, formatted) => `${formatted} ${total === 1 ? 'word' : 'words'} from the room` */
  status?: (total: number, formatted: string) => string;
  /** While nothing has been sent. @default 'Words appear here as people send them.' */
  empty?: string;
  /** Marks the viewer's own words for screen readers. @default 'yours' */
  mine?: string;
}

type WordCloudProps = Omit<React.ComponentProps<'div'>, 'children'> &
  Pick<CloudOptions, 'max' | 'stopwords' | 'viewer'> & {
    /** What the room sent. Ignored when `words` is given. */
    entries?: readonly (CloudEntry | string)[];
    /** A cloud already built (for example by a server with `buildCloud`). */
    words?: readonly CloudWord[];
    /** `stage` for a shared screen across a room, `default` for a page or a phone. @default 'default' */
    size?: 'default' | 'stage';
    locale?: string;
    labels?: WordCloudLabels;
  };

const STEP_CLASS: Record<'default' | 'stage', readonly string[]> = {
  default: ['text-sm', 'text-base', 'text-xl', 'text-3xl', 'text-5xl'],
  stage: ['text-lg', 'text-2xl', 'text-4xl', 'text-6xl', 'text-8xl'],
};
const WEIGHT = ['font-normal', 'font-normal', 'font-medium', 'font-semibold', 'font-bold'] as const;

function WordCloud({
  entries,
  words: wordsProp,
  max,
  stopwords,
  viewer,
  size = 'default',
  locale,
  labels,
  className,
  ...props
}: WordCloudProps) {
  const reduced = useReducedMotion();
  const listRef = React.useRef<HTMLDivElement>(null);
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const cloud = React.useMemo(() => {
    if (wordsProp) {
      return { words: [...wordsProp], total: wordsProp.reduce((a, w) => a + w.count, 0) };
    }
    return buildCloud(entries ?? [], { max, stopwords, viewer });
  }, [wordsProp, entries, max, stopwords, viewer]);

  const places = React.useMemo(() => cloudOrder(cloud.words.length), [cloud.words.length]);

  // One pulse on each word whose count went up since the last render.
  const counts = React.useRef(new Map<string, number>());
  React.useEffect(() => {
    const prev = counts.current;
    const next = new Map(cloud.words.map((w) => [w.key, w.count]));
    counts.current = next;
    if (reduced || prev.size === 0) return;
    const root = listRef.current;
    if (!root) return;
    for (const w of cloud.words) {
      const before = prev.get(w.key);
      if (before === undefined || before >= w.count) continue;
      const el = root.querySelector<HTMLElement>(
        `[data-word-key="${CSS.escape(w.key)}"] [data-slot="word-cloud-text"]`,
      );
      if (!el || typeof el.animate !== 'function') continue;
      el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], {
        duration: 250,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      });
    }
  }, [cloud.words, reduced]);

  const sizes = STEP_CLASS[size];

  return (
    <div
      data-slot="word-cloud"
      data-size={size}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container grid gap-4', className)}
      {...props}
    >
      <div ref={listRef}>
        <FlipGroup
          render={<ul />}
          data-slot="word-cloud-list"
          className={cn(
            'flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center',
            size === 'stage' ? 'min-h-48 gap-x-8 gap-y-2' : 'min-h-32',
          )}
        >
          {cloud.words.map((w, i) => {
            const step = Math.min(sizes.length, Math.max(1, w.step)) - 1;
            const formatted = nf.format(w.count);
            const top = w.rank === 0 && cloud.words.length > 1;
            return (
              <li
                key={w.key}
                data-flip-id={w.key}
                data-word-key={w.key}
                data-slot="word-cloud-word"
                data-step={step + 1}
                data-top={top ? '' : undefined}
                data-mine={w.mine ? '' : undefined}
                data-band={places[i]?.band}
                style={{ order: places[i]?.order }}
                className="max-w-full leading-tight"
              >
                <span
                  data-slot="word-cloud-text"
                  aria-hidden
                  className={cn(
                    'inline-block break-words font-heading tracking-tight',
                    sizes[step],
                    WEIGHT[step],
                    top ? 'text-primary' : step <= 1 ? 'text-muted-foreground' : 'text-foreground',
                    w.mine && 'decoration-primary underline decoration-2 underline-offset-4',
                  )}
                >
                  {w.text}
                </span>
                <span className="sr-only">
                  {(labels?.word ?? ((t: string, _c: number, f: string) => `${t}, ${f}`))(w.text, w.count, formatted)}
                  {w.mine ? `, ${labels?.mine ?? 'yours'}` : ''}
                </span>
              </li>
            );
          })}
          {cloud.words.length > 1
            ? CLOUD_BREAKS.map((order) => (
                <li
                  key={`break-${order}`}
                  role="presentation"
                  aria-hidden
                  data-slot="word-cloud-break"
                  className="h-0 basis-full"
                  style={{ order }}
                />
              ))
            : null}
        </FlipGroup>
      </div>
      <p
        data-slot="word-cloud-status"
        aria-live="polite"
        className="text-muted-foreground text-center text-sm tabular-nums"
      >
        {cloud.total === 0
          ? (labels?.empty ?? 'Words appear here as people send them.')
          : (labels?.status ?? ((n: number, f: string) => `${f} ${n === 1 ? 'word' : 'words'} from the room`))(
              cloud.total,
              nf.format(cloud.total),
            )}
      </p>
    </div>
  );
}
WordCloud.displayName = 'WordCloud';

// --- WordEntry ------------------------------------------------------------------

interface WordEntryLabels {
  /** The field's label. @default 'Your word' */
  field?: string;
  /** The button. @default 'Send' */
  send?: string;
  /** How many are left. @default (n) => `You can send ${n} more.` */
  left?: (remaining: number) => string;
  /** When every word is sent. @default 'Thanks. Your words are on the screen.' */
  done?: string;
  /** The list of sent words. @default 'Your words' */
  sent?: string;
  /** Why a word was refused. */
  refused?: Partial<Record<TextRefusal | 'repeat', string>>;
}

type WordEntryProps = Omit<React.ComponentProps<'form'>, 'onSubmit' | 'children'> &
  Pick<TextRules, 'blocklist'> & {
    /** Words each person may send. @default 3 */
    maxWords?: number;
    /** The longest word or phrase, in characters. @default 25 */
    maxLength?: number;
    /** Words in one entry ("good food" is two). @default 2 */
    wordsPerEntry?: number;
    /** The words sent so far, controlled. */
    sent?: readonly string[];
    /** The words sent so far, uncontrolled. */
    defaultSent?: readonly string[];
    /** Called once per accepted word. */
    onWord?: (word: string) => void;
    /** No more words (for example when the host closes the round). */
    disabled?: boolean;
    placeholder?: string;
    labels?: WordEntryLabels;
  };

const REFUSED: Record<TextRefusal | 'repeat', string> = {
  empty: 'Type a word first.',
  'too-long': 'That is too long. Try a shorter word.',
  'too-many-words': 'One or two words, please.',
  link: 'Links cannot be sent here.',
  contact: 'Email addresses and phone numbers cannot be sent here.',
  blocked: 'That word cannot be shown here. Try another.',
  repeat: 'You already sent that one.',
};

function WordEntry({
  maxWords = 3,
  maxLength = 25,
  wordsPerEntry = 2,
  blocklist,
  sent: sentProp,
  defaultSent = [],
  onWord,
  disabled = false,
  placeholder,
  labels,
  className,
  ...props
}: WordEntryProps) {
  const [own, setOwn] = React.useState<readonly string[]>(defaultSent);
  const sent = sentProp ?? own;
  const [value, setValue] = React.useState('');
  const [refusal, setRefusal] = React.useState<TextRefusal | 'repeat' | null>(null);
  const inputId = React.useId();
  const messageId = React.useId();
  const remaining = Math.max(0, maxWords - sent.length);
  const closed = disabled || remaining === 0;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (closed) return;
    const check = checkText(value, { maxLength, maxWords: wordsPerEntry, blocklist });
    if (!check.ok) {
      setRefusal(check.reason);
      return;
    }
    if (sent.some((s) => s.toLocaleLowerCase() === check.text.toLocaleLowerCase())) {
      setRefusal('repeat');
      return;
    }
    setRefusal(null);
    setValue('');
    if (sentProp === undefined) setOwn((prev) => [...prev, check.text]);
    onWord?.(check.text);
  };

  const message = refusal
    ? (labels?.refused?.[refusal] ?? REFUSED[refusal])
    : remaining === 0
      ? (labels?.done ?? 'Thanks. Your words are on the screen.')
      : sent.length > 0
        ? (labels?.left ?? ((n: number) => `You can send ${n} more.`))(remaining)
        : '';

  return (
    <form
      data-slot="word-entry"
      data-state={closed ? 'closed' : 'open'}
      data-min-viewport={String(MIN_VIEWPORT)}
      noValidate
      onSubmit={submit}
      className={cn('grid gap-3', className)}
      {...props}
    >
      <div data-slot="word-entry-field" className="grid gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium">
          {labels?.field ?? 'Your word'}
        </label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (refusal) setRefusal(null);
            }}
            placeholder={placeholder}
            disabled={closed}
            autoComplete="off"
            autoCapitalize="none"
            enterKeyHint="send"
            maxLength={maxLength * 2}
            aria-invalid={refusal ? true : undefined}
            aria-describedby={messageId}
            className="min-w-0 flex-1"
          />
          <Button type="submit" size="lg" disabled={closed}>
            {labels?.send ?? 'Send'}
          </Button>
        </div>
      </div>
      <p
        id={messageId}
        data-slot="word-entry-message"
        data-refused={refusal ?? undefined}
        aria-live="polite"
        className={cn('min-h-5 text-sm', refusal ? 'text-destructive' : 'text-muted-foreground')}
      >
        {message}
      </p>
      {sent.length > 0 ? (
        <ul data-slot="word-entry-sent" aria-label={labels?.sent ?? 'Your words'} className="flex flex-wrap gap-2">
          {sent.map((w) => (
            <li
              key={w}
              className="bg-primary/10 text-foreground motion-safe:animate-in motion-safe:zoom-in-90 motion-safe:duration-(--duration-base) motion-safe:ease-enter rounded-full px-3 py-1 text-sm font-medium"
            >
              {w}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
WordEntry.displayName = 'WordEntry';

export { WordCloud, WordEntry };
export type { WordCloudProps, WordCloudLabels, WordEntryProps, WordEntryLabels };
