'use client';

/**
 * @interlace/ui — AvatarUpload
 *
 * A profile photo the reader can set, change or take away: the round photo
 * as it will appear, a Choose photo button, and Remove once there is a photo.
 * Dropping an image on the photo works too.
 *
 * ## Content first
 *
 * Choose photo is a `<label>` around a real `<input type="file">`, so the
 * picker opens on a press, on Enter and on Space, a screen reader hears a
 * file field named "Choose photo", and the file posts with a form under
 * `name`. Dropping a file on the photo is a shortcut to the same field.
 *
 * ## Value
 *
 * `src` is the photo the reader already has. `value` is what they did here:
 * `undefined` while they changed nothing (the `src` photo shows), a `File`
 * once they chose one (a preview of it shows), and `null` once they removed
 * the photo (the fallback shows, usually initials). `onValueChange` hears
 * each change, so a save can tell "new photo", "no photo" and "as it was"
 * apart. The preview is an object URL, revoked when it is replaced or the
 * component goes.
 *
 * ## Rules
 *
 * The file is checked with `checkFiles` from `file-drop` (`accept`, default
 * `image/*`, and `maxSize`). A file that breaks a rule is not taken; the
 * reason is said in a polite live region under the buttons, in words
 * `messages` can replace, and `onReject` hears it.
 *
 * ## Motion
 *
 * The photo's ring answers a drag over it, timed by `--duration-fast` on
 * `--ease-enter`. The buttons press in. Nothing else moves.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The photo sits beside its buttons; at 320px both still fit on one line
 * at the default size.
 *
 * ## Anatomy
 *
 *   AvatarUpload                  (div — data-slot="avatar-upload", data-min-viewport=320)
 *     ├─ photo                    (div — data-slot="avatar-upload-photo", data-dragging; drop target)
 *     │   └─ Avatar               (AvatarImage of the preview or `src`, AvatarFallback)
 *     └─ div
 *         ├─ actions              (data-slot="avatar-upload-actions")
 *         │   ├─ label            (data-slot="avatar-upload-choose": input[type=file] laid unseen over it + text)
 *         │   └─ Button?          (data-slot="avatar-upload-remove")
 *         ├─ hint?                (data-slot="avatar-upload-hint", the input's description)
 *         └─ status               (p aria-live=polite — data-slot="avatar-upload-status")
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `div` props; the input is a native file input         |
 * | R6   | data-slot per part      | avatar-upload / -photo / -actions / -choose / -remove |
 * | R7   | cn + ...rest            | `cn(BASE, className)` + `{...props}`                  |
 * | R14  | Declares min viewport   | `data-min-viewport` + exported const                  |
 * | R19  | Tokens only             | `--avatar-upload-size`, `--ring`, `--primary`         |
 * | R25  | Client component        | the chosen file and its preview live in the browser   |
 * | R26  | A11y from native el     | label + file input; live status; a named Remove       |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Avatar, AvatarFallback, AvatarImage } from '../primitives/avatar.js';
import { Button } from '../primitives/button.js';
import { buttonVariants } from '../primitives/button-variants.js';
import { checkFiles, formatBytes, type FileRejection } from '../primitives/file-drop.js';

/** Smallest viable viewport (CSS px) for this pattern. */
export const MIN_VIEWPORT = 320 as const;

export interface AvatarUploadMessages {
  /** A file that isn't an image this field takes. */
  type?: (file: File) => string;
  /** A file over `maxSize`. */
  size?: (file: File, maxSize: number) => string;
}

const DEFAULT_MESSAGES: Required<AvatarUploadMessages> = {
  type: (file) => `${file.name} isn't an image this field takes.`,
  size: (file, max) => `${file.name} is larger than ${formatBytes(max)}.`,
};

export interface AvatarUploadProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'defaultValue' | 'onChange'> {
  /** The photo the reader already has. */
  src?: string;
  /** What shows with no photo, usually initials. */
  fallback?: React.ReactNode;
  /** The photo's text alternative, e.g. the person's name. */
  alt?: string;
  /** What the reader did here: `undefined` unchanged, a `File` chosen, `null` removed (controlled). */
  value?: File | null;
  /** The same at first (uncontrolled). */
  defaultValue?: File | null;
  /** Called with the chosen file, or `null` when the photo is removed. */
  onValueChange?: (file: File | null) => void;
  /** Called with a file turned away, and why. */
  onReject?: (rejection: FileRejection<File>) => void;
  /** The `accept` attribute, checked again on every pick and drop. @default 'image/*' */
  accept?: string;
  /** The largest file, in bytes. */
  maxSize?: number;
  /** The field name the file posts under with a form. */
  name?: string;
  disabled?: boolean;
  /** One line on what it takes, e.g. "JPG or PNG, up to 2 MB". */
  hint?: React.ReactNode;
  /** The choose button's words. @default 'Choose photo' */
  chooseLabel?: React.ReactNode;
  /** The remove button's words. @default 'Remove' */
  removeLabel?: React.ReactNode;
  /** The sentences said when a file is turned away. */
  messages?: AvatarUploadMessages;
}

/** Put `file` on the input, so a form posts what the photo shows. Skipped where DataTransfer can't be built. */
function syncInput(input: HTMLInputElement | null, file: File | null | undefined) {
  if (!input || typeof DataTransfer === 'undefined') return;
  const transfer = new DataTransfer();
  if (file) transfer.items.add(file);
  input.files = transfer.files;
}

/** An object URL for `file`, revoked when the file changes or the component goes. */
function usePreview(file: File | null | undefined): string | undefined {
  const [url, setUrl] = React.useState<string>();
  React.useEffect(() => {
    if (!file || typeof URL.createObjectURL !== 'function') {
      setUrl(undefined);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

export function AvatarUpload(allProps: AvatarUploadProps) {
  const {
    src,
    fallback,
    alt = '',
    value,
    defaultValue,
    onValueChange,
    onReject,
    accept = 'image/*',
    maxSize,
    name,
    disabled = false,
    hint,
    chooseLabel = 'Choose photo',
    removeLabel = 'Remove',
    messages,
    className,
    ...props
  } = allProps;
  const id = React.useId();
  const input = React.useRef<HTMLInputElement>(null);
  const [own, setOwn] = React.useState<File | null | undefined>(defaultValue);
  // `value={undefined}` still means "unchanged", so the prop being passed is what makes it controlled.
  const controlled = Object.hasOwn(allProps, 'value');
  const current = controlled ? value : own;
  const [dragging, setDragging] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const say = { ...DEFAULT_MESSAGES, ...messages };
  const preview = usePreview(current);
  const shown = current === null ? undefined : (preview ?? (current ? undefined : src));
  const hasPhoto = current === null ? false : Boolean(current) || Boolean(src);

  const commit = (next: File | null) => {
    if (!controlled) setOwn(next);
    syncInput(input.current, next);
    onValueChange?.(next);
  };

  const take = (file: File | undefined) => {
    if (!file) return;
    const { accepted, rejected } = checkFiles([file], { accept, maxSize });
    if (accepted[0]) {
      commit(accepted[0]);
      setStatus('');
      return;
    }
    const rejection = rejected[0]!;
    setStatus(rejection.reason === 'type' ? say.type(file) : say.size(file, maxSize!));
    syncInput(input.current, current);
    onReject?.(rejection);
  };

  const hintId = hint ? `${id}-hint` : undefined;
  const statusId = `${id}-status`;

  return (
    <div
      data-slot="avatar-upload"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex items-center gap-4 [--avatar-upload-size:4.5rem]', className)}
      {...props}
    >
      <div
        data-slot="avatar-upload-photo"
        data-dragging={dragging ? '' : undefined}
        onDragEnter={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (disabled) return;
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
          take(event.dataTransfer.files[0]);
        }}
        className={cn(
          'ring-border ring-offset-background shrink-0 rounded-full ring-1 ring-offset-2',
          'transition-[box-shadow] duration-(--duration-fast) ease-enter',
          'data-[dragging]:ring-primary data-[dragging]:ring-2',
        )}
      >
        <Avatar className="size-(--avatar-upload-size)">
          {shown ? <AvatarImage src={shown} alt={alt} className="object-cover" /> : null}
          <AvatarFallback className="text-lg">{fallback}</AvatarFallback>
        </Avatar>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <div data-slot="avatar-upload-actions" className="flex flex-wrap items-center gap-2">
          <label
            data-slot="avatar-upload-choose"
            data-disabled={disabled ? '' : undefined}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'relative cursor-pointer',
              'has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-background has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-offset-2',
              'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
            )}
          >
            <input
              ref={input}
              type="file"
              name={name}
              accept={accept}
              disabled={disabled}
              aria-describedby={cn(hintId, status ? statusId : undefined) || undefined}
              // Laid over the whole button, unseen, so the focus ring the button draws is the field's own.
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              onChange={(event) => take(event.currentTarget.files?.[0])}
            />
            {chooseLabel}
          </label>
          {hasPhoto ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-slot="avatar-upload-remove"
              disabled={disabled}
              onClick={() => {
                commit(null);
                setStatus('');
                input.current?.focus();
              }}
            >
              {removeLabel}
            </Button>
          ) : null}
        </div>
        {hint ? (
          <p id={hintId} data-slot="avatar-upload-hint" className="text-muted-foreground text-sm">
            {hint}
          </p>
        ) : null}
        <p
          id={statusId}
          data-slot="avatar-upload-status"
          aria-live="polite"
          className={cn('text-destructive text-sm', !status && 'sr-only')}
        >
          {status}
        </p>
      </div>
    </div>
  );
}
