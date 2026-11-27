'use client';

/**
 * @interlace/ui — FileDrop
 *
 * A place to hand over files: drop them on it or press it to pick, see what
 * was chosen, take one back out. For a document with a request, photos for a
 * gallery, a sheet to import.
 *
 * ## Content first
 *
 * Underneath is a real `<input type="file">` inside a `<label>`, so the
 * picker opens on a press or on Enter and Space, a screen reader announces a
 * file field with its label, and the chosen files post with the form under
 * `name`. The drop area is that label, drawn larger: dropping files there is
 * a shortcut to the same field, never the only way in.
 *
 * ## Rules
 *
 * `accept`, `maxSize` and `maxFiles` are checked again on every pick and
 * drop by `file-model` (the picker's own filter only suggests, and a drop
 * skips it). A file that breaks a rule is not added; the reason is said in a
 * polite live region under the field ("photo.heic isn't a type this field
 * takes"), in words `messages` can replace. The same model can check the
 * files again on the server.
 *
 * ## The list
 *
 * Each chosen file is a row with its name, its size (`formatBytes`, in the
 * reader's locale) and a Remove button named for the file. Removing a file
 * moves focus to the next Remove button, or back to the field when the list
 * empties, so focus never falls to the page.
 *
 * ## Motion
 *
 * The drop area's border and tint answer a drag over it, timed by
 * `--duration-fast` on `--ease-enter`. Nothing else moves.
 *
 * ## MIN_VIEWPORT — 320
 *
 * ## Anatomy
 *
 *   FileDrop                      (div — data-slot="file-drop", data-min-viewport=320)
 *     ├─ label                    (data-slot="file-drop-area", data-dragging, data-disabled)
 *     │   ├─ input[type=file]     (unseen, laid over the area, which draws its focus ring)
 *     │   ├─ icon                 (aria-hidden)
 *     │   ├─ label text           (data-slot="file-drop-label")
 *     │   └─ hint?                (data-slot="file-drop-hint": what it takes, linked as the description)
 *     ├─ status                   (p aria-live=polite — data-slot="file-drop-status": why a file was turned away)
 *     └─ ul?                      (data-slot="file-drop-list")
 *         └─ li × n               (data-slot="file-drop-item": name, size, Remove)
 *
 * | Rule | Concept                          | Where in this file                                     |
 * | ---- | -------------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el                | `div` props; the input is a native file input           |
 * | R6   | data-slot per part               | file-drop / -area / -label / -hint / -status / -list / -item |
 * | R7   | cn + ...rest                     | `cn(BASE, className)` + `{...props}`                    |
 * | R14  | Declares min viewport            | `data-min-viewport` + exported const                    |
 * | R19  | Tokens only                      | `--border` / `--input` / `--primary` / `--duration-*`   |
 * | R25  | Client component                 | drag state and the chosen files live in the browser     |
 * | R26  | A11y from native el              | label + file input; live status; named Remove buttons   |
 */

import * as React from 'react';
import { FileIcon, UploadIcon, XIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Button } from './button.js';
import { checkFiles, formatBytes, type FileRejection, type FileRules } from './file-model.js';

export { acceptsFile, checkFiles, formatBytes } from './file-model.js';
export type { FileLike, FileRejection, FileRejectionReason, FileRules } from './file-model.js';

/** Smallest viable viewport (CSS px) for this primitive. */
export const MIN_VIEWPORT = 320 as const;

export interface FileDropMessages {
  /** A file of a type the field doesn't take. */
  type?: (file: File) => string;
  /** A file over `maxSize`. */
  size?: (file: File, maxSize: number) => string;
  /** A file past `maxFiles`. */
  count?: (file: File, maxFiles: number) => string;
  /** The Remove button's name for one file. */
  remove?: (file: File) => string;
}

const DEFAULT_MESSAGES: Required<FileDropMessages> = {
  type: (file) => `${file.name} isn't a type this field takes.`,
  size: (file, max) => `${file.name} is larger than ${formatBytes(max)}.`,
  count: (file, max) => `${file.name} wasn't added: this field takes ${max} ${max === 1 ? 'file' : 'files'}.`,
  remove: (file) => `Remove ${file.name}`,
};

export interface FileDropProps
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'defaultValue' | 'onChange'>, FileRules {
  /** What the area says, e.g. "Drop a photo here, or choose one". */
  label: React.ReactNode;
  /** One line under it on what the field takes, e.g. "PNG or JPG, up to 5 MB". */
  hint?: React.ReactNode;
  /** The field name the files post under with a form. */
  name?: string;
  /** Take more than one file. */
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** The chosen files (controlled). */
  value?: File[];
  /** The files chosen at first (uncontrolled). */
  defaultValue?: File[];
  /** Called with every chosen file after a pick, a drop or a removal. */
  onValueChange?: (files: File[]) => void;
  /** Called with the files a pick or drop turned away, and why. */
  onReject?: (rejections: FileRejection<File>[]) => void;
  /** The sentences said when a file is turned away, and the Remove button's name. */
  messages?: FileDropMessages;
  /** Locale for file sizes. Defaults to the reader's. */
  locale?: string;
}

/** Put `files` on the input, so a form posts what the list shows. Skipped where DataTransfer can't be built. */
function syncInput(input: HTMLInputElement | null, files: File[]) {
  if (!input || typeof DataTransfer === 'undefined') return;
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  input.files = transfer.files;
}

export function FileDrop({
  label,
  hint,
  name,
  multiple = false,
  disabled = false,
  required,
  accept,
  maxSize,
  maxFiles,
  value,
  defaultValue,
  onValueChange,
  onReject,
  messages,
  locale,
  className,
  ...props
}: FileDropProps) {
  const id = React.useId();
  const input = React.useRef<HTMLInputElement>(null);
  const list = React.useRef<HTMLUListElement>(null);
  const [own, setOwn] = React.useState<File[]>(defaultValue ?? []);
  const files = value ?? own;
  const [dragging, setDragging] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const say = { ...DEFAULT_MESSAGES, ...messages };
  const limit = multiple ? maxFiles : 1;

  const commit = (next: File[]) => {
    if (value === undefined) setOwn(next);
    syncInput(input.current, next);
    onValueChange?.(next);
  };

  const add = (incoming: File[]) => {
    // One file at a time replaces the last; several add to the list.
    const held = multiple ? files : [];
    const { accepted, rejected } = checkFiles(incoming, { accept, maxSize, maxFiles: limit }, held.length);
    commit([...held, ...accepted]);
    setStatus(
      rejected
        .map(({ file, reason }) =>
          reason === 'type' ? say.type(file) : reason === 'size' ? say.size(file, maxSize!) : say.count(file, limit!),
        )
        .join(' '),
    );
    if (rejected.length > 0) onReject?.(rejected);
  };

  const remove = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    commit(next);
    setStatus('');
    // Focus the Remove button that takes this row's place, or the field when the list is empty.
    requestFocus(index, next.length);
  };

  const [focusTarget, setFocusTarget] = React.useState<number | null>(null);
  const requestFocus = (index: number, length: number) =>
    setFocusTarget(length === 0 ? -1 : Math.min(index, length - 1));
  React.useEffect(() => {
    if (focusTarget === null) return;
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>('[data-slot="file-drop-remove"]');
    (focusTarget === -1 ? input.current : buttons?.[focusTarget])?.focus();
    setFocusTarget(null);
  }, [focusTarget]);

  const hintId = hint ? `${id}-hint` : undefined;
  const statusId = `${id}-status`;

  return (
    <div
      data-slot="file-drop"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex flex-col gap-2', className)}
      {...props}
    >
      <label
        data-slot="file-drop-area"
        data-dragging={dragging ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        onDragEnter={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (disabled) return;
          // Without this the browser opens the file instead of dropping it here.
          event.preventDefault();
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDragging(false);
        }}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(false);
          add(Array.from(event.dataTransfer.files));
        }}
        className={cn(
          'border-input bg-background text-foreground relative flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-8 text-center',
          'transition-[border-color,background-color] duration-(--duration-fast) ease-enter hover:border-ring/60 hover:bg-muted/40',
          'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-background',
          'data-[dragging]:border-primary data-[dragging]:bg-primary/6',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        )}
      >
        <input
          ref={input}
          type="file"
          name={name}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          required={required && files.length === 0}
          aria-describedby={cn(hintId, status ? statusId : undefined) || undefined}
          // Laid over the whole area, unseen, so the area's ring is the field's own focus ring and a
          // check that looks around the focused element finds it.
          className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          onChange={(event) => {
            const picked = Array.from(event.currentTarget.files ?? []);
            if (picked.length > 0) add(picked);
            else syncInput(event.currentTarget, files);
          }}
        />
        <UploadIcon aria-hidden="true" className="text-muted-foreground mb-1 size-6" />
        <span data-slot="file-drop-label" className="font-medium">
          {label}
        </span>
        {hint ? (
          <span id={hintId} data-slot="file-drop-hint" className="text-muted-foreground text-sm">
            {hint}
          </span>
        ) : null}
      </label>

      <p
        id={statusId}
        data-slot="file-drop-status"
        aria-live="polite"
        className={cn('text-destructive text-sm', !status && 'sr-only')}
      >
        {status}
      </p>

      {files.length > 0 ? (
        <ul ref={list} data-slot="file-drop-list" className="flex flex-col gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              data-slot="file-drop-item"
              className="border-border bg-card text-card-foreground flex min-w-0 items-center gap-3 rounded-lg border py-2 ps-3 pe-2"
            >
              <FileIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
              <span className="min-w-0 flex-1 break-words text-sm">{file.name}</span>
              <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                {formatBytes(file.size, locale)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-slot="file-drop-remove"
                aria-label={say.remove(file)}
                disabled={disabled}
                onClick={() => remove(index)}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
