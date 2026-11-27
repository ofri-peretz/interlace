'use client';

/**
 * @interlace/ui — PhotoUpload
 *
 * Photos from the five places people get them (pick, drag, paste, camera),
 * made small and clean on the device, then handed to ONE function the app
 * provides, `onUpload`. The component never opens a connection: it has no
 * `fetch`, no `XMLHttpRequest`, no destination. What reaches `onUpload` has
 * no location, camera, time or embedded thumbnail inside it.
 *
 * ## Anatomy
 *
 *   PhotoUpload                    (div role=group — data-slot="photo-upload", data-state, data-count)
 *     ├─ span                      (data-slot="photo-upload-label": the visible name)
 *     ├─ div                       (data-slot="photo-upload-dropzone", data-drag idle|over, data-full)
 *     │   ├─ label > input file    (data-slot="photo-upload-pick": the real control, laid over its label at opacity 0 so it stays focusable)
 *     │   ├─ label > input file    (data-slot="photo-upload-camera": touch devices only, after mount)
 *     │   └─ p                     (data-slot="photo-upload-hint")
 *     ├─ p role=status             (data-slot="photo-upload-rejections")
 *     ├─ ul                        (data-slot="photo-upload-list")
 *     │   └─ li                    (data-slot="photo-upload-item", data-status)
 *     │       ├─ img | span        (data-slot="photo-upload-thumb")
 *     │       ├─ div               (data-slot="photo-upload-meta": name, size, "Location removed")
 *     │       ├─ Progress          (data-slot="photo-upload-progress", only while working)
 *     │       ├─ p                 (data-slot="photo-upload-message": the state in words; role=alert on error)
 *     │       ├─ input text        (data-slot="photo-upload-alt", with `altText`)
 *     │       └─ div               (data-slot="photo-upload-actions": Crop, Try again, Cancel, Remove)
 *     ├─ Button                    (data-slot="photo-upload-submit": `manual` with ready photos)
 *     └─ p aria-live=polite        (data-slot="photo-upload-announce", sr-only)
 *
 * ## Where the photos go
 *
 * `onUpload(photo, ctx)` is the whole backend surface. `ctx.onProgress(0..1)`
 * reports progress, `ctx.signal` aborts on cancel, remove and unmount. Throw
 * `PhotoUploadError({ retryable: true })` for a failure worth retrying (up to
 * `retries`, 1 s, 2 s, 4 s with jitter); any other failure shows Try again.
 * `xhrUploader` (subpath `photo-upload-xhr`) is one ready-made adapter.
 *
 * ## States
 *
 * Component: empty, drag-over, has-items, full, partial-failure, all-done,
 * disabled, read-only, offline-waiting. Item: queued, reading, processing,
 * ready, uploading, done, error, canceled. Each is words and an icon, never
 * colour alone. With JavaScript off the dropzone is a labelled native file
 * input (give it a `name`).
 *
 * ## Source of the API
 *
 * react-dropzone (https://react-dropzone.js.org): `accept`, `maxFiles` keep
 * its names. Uppy (https://uppy.io) and FilePond (https://pqina.nl/filepond):
 * the queue, progress and retry model. Diverges on purpose: `maxFileBytes`
 * names its unit, `onUpload` is an adapter (no destination), no plugin system
 * (the adapter and `runtime` are the extension points).
 *
 * | Rule | Concept              | Where                                   |
 * | ---- | -------------------- | --------------------------------------- |
 * | R5   | data-testid required | `PhotoUploadProps['data-testid']`       |
 * | R6   | data-slot per part   | every part above                        |
 * | R8   | booleans default off | `manual`, `altText`                     |
 * | R14  | controlled + not     | `value` / `defaultValue`                |
 * | R25  | lazy client part     | the cropper loads on first use          |
 * | R26  | A11y                 | native input, one announcement per change |
 */
import * as React from 'react';
import {
  AlertCircleIcon,
  CameraIcon,
  CheckCircleIcon,
  CropIcon,
  ImagePlusIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  XIcon,
} from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { Progress, ProgressIndicator, ProgressTrack } from '../primitives/progress.js';
import {
  announcements,
  DEFAULT_ACCEPT,
  DEFAULT_ERROR_TEXT,
  fingerprintOf,
  formatBytes,
  HEAD_BYTES,
  isLive,
  nextToUpload,
  PhotoUploadError,
  planIntake,
  planProcessing,
  qualityLadder,
  readHeader,
  reduce,
  retryDelay,
  shouldAutoRetry,
  stripMetadata,
  type CropRect,
  type PhotoAction,
  type PhotoError,
  type PhotoErrorCode,
  type PhotoItem,
  type PhotoMime,
  type PhotoProcessing,
  type PhotoUploader,
  type ProcessedPhoto,
  type Quarter,
} from './photo-upload-model.js';
import { browserRuntime, type ImageRuntime } from './photo-upload-runtime.js';

export type { PhotoItem, PhotoMime, PhotoProcessing, PhotoUploader, ProcessedPhoto };
export { PhotoUploadError } from './photo-upload-model.js';

export const MIN_VIEWPORT = 320 as const;

const PhotoCropper = React.lazy(() => import('./photo-upload-crop.js'));

export interface PhotoCrop {
  /** width / height; null for free. @default null */
  aspect?: number | null;
  /** `round` masks the preview only; the output is the full rectangle. @default 'rect' */
  shape?: 'rect' | 'round';
  /** Open the cropper for every added photo before processing. @default false */
  required?: boolean;
}

type Text<A extends unknown[] = []> = string | ((...args: A) => string);
export interface PhotoUploadLabels {
  /** @default 'Photos' */
  label?: string;
  /** @default 'Choose photos' (singular with maxFiles 1) */
  choose?: string;
  /** @default 'Take photo' */
  camera?: string;
  /** @default 'or drag photos here, or paste' */
  hint?: string;
  /** @default 'Upload' */
  upload?: string;
  /** @default 'Crop' */
  crop?: string;
  /** @default 'Try again' */
  retry?: string;
  /** @default 'Cancel' */
  cancel?: string;
  /** @default 'Remove' */
  remove?: string;
  /** @default 'Describe this photo' */
  alt?: string;
  /** @default 'Location removed' */
  locationRemoved?: string;
  /** @default 'Details removed' */
  detailsRemoved?: string;
  /** @default 'You have added the most photos allowed.' */
  full?: string;
  /** @default 'Waiting for a connection' */
  offline?: string;
  /** Per-status words. */
  status?: Partial<Record<PhotoItem['status'], string>>;
  /** Per-error words. */
  errors?: Partial<Record<PhotoErrorCode, string>>;
  /** @default (added, skipped) => '2 added. 1 skipped: not a photo' */
  rejections?: Text<[number, string]>;
  cropper?: {
    title?: string;
    zoom?: string;
    rotateLeft?: string;
    rotateRight?: string;
    apply?: string;
    cancel?: string;
  };
}

export interface PhotoChangeDetails {
  reason: 'added' | 'removed' | 'status' | 'alt' | 'crop' | 'retry' | 'cancel' | 'rejected';
  id: string | null;
  rejected: readonly { name: string; error: PhotoError }[];
}

export interface PhotoItemProps {
  item: PhotoItem;
  index: number;
  total: number;
  labels: Required<Pick<PhotoUploadLabels, 'crop' | 'retry' | 'cancel' | 'remove' | 'alt' | 'locationRemoved' | 'detailsRemoved'>>;
  actions: {
    crop?: () => void;
    retry?: () => void;
    cancel?: () => void;
    remove?: () => void;
    setAlt?: (alt: string) => void;
  };
  message: string;
  altText: boolean;
}

export interface PhotoUploadProps
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'onChange' | 'defaultValue' | 'children'> {
  'data-testid': string;
  /** The whole backend surface. Required: the component has no default destination. */
  onUpload: PhotoUploader;
  value?: readonly PhotoItem[];
  defaultValue?: readonly PhotoItem[];
  onValueChange?: (items: readonly PhotoItem[], details: PhotoChangeDetails) => void;
  /** @default ['image/jpeg', 'image/png', 'image/webp'] */
  accept?: readonly PhotoMime[];
  /** @default 10 */
  maxFiles?: number;
  /** Largest input file, in bytes, before any processing. @default 26214400 */
  maxFileBytes?: number;
  /** Largest input in pixels, read from the header before decoding. @default 40000000 */
  maxPixels?: number;
  /** `false` skips resize and re-encode but never skips the metadata strip. */
  processing?: PhotoProcessing | false;
  /** `false` hides the Crop action. @default false */
  crop?: PhotoCrop | false;
  /** Adds a "Take photo" button that opens the camera on a touch device. */
  capture?: 'environment' | 'user';
  /** Wait for an Upload button instead of uploading once a photo is processed. @default false */
  manual?: boolean;
  /** @default 3 */
  concurrency?: number;
  /** Automatic tries after a retryable failure. @default 2 */
  retries?: number;
  /** Show a "Describe this photo" field per photo. @default false */
  altText?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Makes it a real form field: the native input posts the chosen files with JavaScript off. */
  name?: string;
  labels?: PhotoUploadLabels;
  /** Substitute the browser: tests, an agent, a worker, a HEIC decoder. @default browserRuntime */
  runtime?: ImageRuntime;
  random?: () => number;
  makeId?: () => string;
  dropzoneProps?: React.ComponentPropsWithoutRef<'div'>;
  itemComponent?: React.ComponentType<PhotoItemProps>;
}

const STATUS_WORDS: Record<PhotoItem['status'], string> = {
  queued: 'Waiting',
  reading: 'Reading',
  processing: 'Getting it ready',
  ready: 'Ready to upload',
  uploading: 'Uploading',
  done: 'Uploaded',
  error: 'Failed',
  canceled: 'Canceled',
};

const wordsOf = (t: Text<[number, string]> | undefined, added: number, skipped: string, fallback: string) =>
  typeof t === 'function' ? t(added, skipped) : (t ?? fallback);

const STATE_OF = (items: readonly PhotoItem[], max: number, disabled: boolean, readOnly: boolean, online: boolean) => {
  if (disabled) return 'disabled';
  if (readOnly) return 'read-only';
  if (!online) return 'offline-waiting';
  if (items.length === 0) return 'empty';
  if (items.some((i) => i.status === 'error')) return 'partial-failure';
  if (items.every((i) => i.status === 'done')) return 'all-done';
  if (items.filter((i) => isLive(i.status) || i.status === 'done').length >= max) return 'full';
  return 'has-items';
};

function DefaultItem({ item, index, total, labels, actions, message, altText }: PhotoItemProps) {
  const working = item.status === 'processing' || item.status === 'uploading';
  const removed = item.output?.metadataRemoved ?? [];
  const Icon = item.status === 'done' ? CheckCircleIcon : item.status === 'error' ? AlertCircleIcon : null;
  return (
    <li
      data-slot="photo-upload-item"
      data-status={item.status}
      data-id={item.id}
      className="border-border bg-background grid grid-cols-[3.5rem_1fr] gap-x-3 gap-y-2 rounded-lg border p-3 motion-safe:animate-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-(--duration-base)"
    >
      {item.previewUrl ? (
        <img
          data-slot="photo-upload-thumb"
          src={item.previewUrl}
          alt={altText ? item.alt : ''}
          width={56}
          height={56}
          className="bg-muted aspect-square size-14 rounded-md object-cover"
        />
      ) : (
        <span data-slot="photo-upload-thumb" className="bg-muted aspect-square size-14 rounded-md" aria-hidden="true" />
      )}
      <div className="grid min-w-0 gap-1">
        <div data-slot="photo-upload-meta" className="min-w-0 text-sm">
          <p className="truncate font-medium">{item.name}</p>
          <p className="text-muted-foreground">
            {item.output && item.output.bytes < item.source.bytes
              ? `${formatBytes(item.output.bytes)}, was ${formatBytes(item.source.bytes)}`
              : formatBytes(item.output?.bytes ?? item.source.bytes)}
            {removed.length > 0
              ? `. ${removed.includes('gps') ? labels.locationRemoved : labels.detailsRemoved}`
              : ''}
          </p>
        </div>
        {working ? (
          <Progress
            data-slot="photo-upload-progress"
            value={Math.round(item.progress * 100)}
            aria-label={`${item.name}: ${message}`}
            aria-valuetext={`${Math.round(item.progress * 100)} percent, ${message.toLowerCase()}`}
          >
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
        ) : null}
        <p
          data-slot="photo-upload-message"
          role={item.status === 'error' ? 'alert' : undefined}
          className={cn('flex items-center gap-1.5 text-sm', item.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}
        >
          {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
          {item.status === 'processing' || item.status === 'uploading' || item.status === 'reading' ? (
            <LoaderCircleIcon aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />
          ) : null}
          <span>{message}</span>
        </p>
        {altText && actions.setAlt ? (
          <input
            data-slot="photo-upload-alt"
            type="text"
            aria-label={`${labels.alt}: ${item.name}`}
            placeholder={labels.alt}
            value={item.alt}
            onChange={(e) => actions.setAlt?.(e.target.value)}
            className="border-input bg-background h-control-sm w-full rounded-md border px-2 text-sm"
          />
        ) : null}
        <div data-slot="photo-upload-actions" className="flex flex-wrap gap-2">
          {actions.crop ? (
            <Button type="button" variant="outline" size="sm" onClick={actions.crop} data-action="crop">
              <CropIcon aria-hidden="true" />
              {labels.crop}
              <span className="sr-only">{`: ${item.name}`}</span>
            </Button>
          ) : null}
          {actions.retry ? (
            <Button type="button" variant="outline" size="sm" onClick={actions.retry} data-action="retry">
              <RotateCcwIcon aria-hidden="true" />
              {labels.retry}
              <span className="sr-only">{`: ${item.name}`}</span>
            </Button>
          ) : null}
          {actions.cancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={actions.cancel} data-action="cancel">
              {labels.cancel}
              <span className="sr-only">{`: ${item.name}`}</span>
            </Button>
          ) : null}
          {actions.remove ? (
            <Button type="button" variant="ghost" size="sm" onClick={actions.remove} data-action="remove">
              <XIcon aria-hidden="true" />
              {labels.remove}
              <span className="sr-only">{`: ${item.name} (${index + 1} of ${total})`}</span>
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function PhotoUpload({
  onUpload,
  value,
  defaultValue,
  onValueChange,
  accept = DEFAULT_ACCEPT,
  maxFiles = 10,
  maxFileBytes = 26_214_400,
  maxPixels = 40_000_000,
  processing,
  crop = false,
  capture,
  manual = false,
  concurrency = 3,
  retries = 2,
  altText = false,
  disabled = false,
  readOnly = false,
  name,
  labels,
  runtime = browserRuntime,
  random = Math.random,
  makeId,
  dropzoneProps,
  itemComponent: Item = DefaultItem,
  className,
  ...rest
}: PhotoUploadProps) {
  const baseId = React.useId();
  const nextId = React.useRef(0);
  const newId = makeId ?? (() => `${baseId}-${++nextId.current}`);
  const [inner, setInner] = React.useState<readonly PhotoItem[]>(defaultValue ?? []);
  const items = value ?? inner;
  const itemsRef = React.useRef(items);
  itemsRef.current = items;
  const files = React.useRef(new Map<string, File>());
  const controllers = React.useRef(new Map<string, AbortController>());
  const timers = React.useRef(new Set<ReturnType<typeof setTimeout>>());
  const live = React.useRef(true);
  const [rejections, setRejections] = React.useState<{ added: number; skipped: string[] } | null>(null);
  const [drag, setDrag] = React.useState<'idle' | 'over'>('idle');
  const [online, setOnline] = React.useState(true);
  const wasOnline = React.useRef(true);
  const [released, setReleased] = React.useState(false);
  const [announce, setAnnounce] = React.useState('');
  const [touch, setTouch] = React.useState(false);
  const [cropping, setCropping] = React.useState<string | null>(null);
  const cropButton = React.useRef<HTMLElement | null>(null);
  const prev = React.useRef<readonly PhotoItem[] | null>(null);
  const buffer = React.useRef<string[]>([]);
  const flush = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const chooseRef = React.useRef<HTMLInputElement>(null);
  const t = labels ?? {};
  const words = {
    label: t.label ?? 'Photos',
    choose: t.choose ?? (maxFiles === 1 ? 'Choose a photo' : 'Choose photos'),
    camera: t.camera ?? 'Take photo',
    hint: t.hint ?? 'or drag photos here, or paste',
    upload: t.upload ?? 'Upload',
    crop: t.crop ?? 'Crop',
    retry: t.retry ?? 'Try again',
    cancel: t.cancel ?? 'Cancel',
    remove: t.remove ?? 'Remove',
    alt: t.alt ?? 'Describe this photo',
    full: t.full ?? 'You have added the most photos allowed.',
    offline: t.offline ?? 'Waiting for a connection',
    locationRemoved: t.locationRemoved ?? 'Location removed',
    detailsRemoved: t.detailsRemoved ?? 'Details removed',
  };
  const errorText = (code: PhotoErrorCode) => t.errors?.[code] ?? DEFAULT_ERROR_TEXT[code];
  const cropOpts = crop === false ? null : crop;

  const commit = React.useCallback(
    (action: PhotoAction, reason: PhotoChangeDetails['reason'], id: string | null, rejected: PhotoChangeDetails['rejected'] = []) => {
      const next = reduce(itemsRef.current, action);
      if (next === itemsRef.current && rejected.length === 0) return;
      itemsRef.current = next;
      if (value === undefined) setInner(next);
      onValueChange?.(next, { reason, id, rejected });
    },
    [onValueChange, value],
  );

  const release = React.useCallback(
    (id: string) => {
      const url = itemsRef.current.find((i) => i.id === id)?.previewUrl;
      if (url) runtime.revokeObjectURL(url);
    },
    [runtime],
  );

  // Processing: read, plan, strip or re-encode, thumbnail. The model decides; the runtime draws.
  const process = React.useCallback(
    async (id: string) => {
      const file = files.current.get(id);
      const item = itemsRef.current.find((i) => i.id === id);
      if (!file || !item) return;
      const controller = controllers.current.get(id) ?? new AbortController();
      controllers.current.set(id, controller);
      const { signal } = controller;
      const fail = (code: PhotoErrorCode, detail?: string) =>
        commit({ type: 'failed', id, error: { code, retryable: code !== 'unsupported-format', detail } }, 'status', id);
      commit({ type: 'reading', id }, 'status', id);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (signal.aborted) return;
        const type = (item.source.type as PhotoMime) ?? 'image/jpeg';
        const header = readHeader(bytes, type);
        if (!header) return fail('decode-failed');
        commit({ type: 'processing', id, progress: 0.2 }, 'status', id);
        const plan = planProcessing(header, processing, item.crop);
        const stripped = stripMetadata(bytes, type);
        const edge = processing === false ? Infinity : (processing?.maxEdge ?? 2048);
        const hint = header.width && header.height ? { width: header.width, height: header.height } : undefined;
        const decoded = await runtime.decode(new Blob([bytes as BlobPart], { type }), {
          maxEdge: plan.kind === 'strip-only' ? 320 : edge,
          signal,
          hint:
            hint && header.orientation >= 5
              ? { width: hint.height, height: hint.width }
              : hint,
        });
        if (signal.aborted) {
          if (decoded) runtime.dispose?.(decoded);
          return;
        }
        if (!decoded) return fail('unsupported-format');
        let blob: Blob;
        let outType: PhotoMime = type;
        // Both branches below assign these before they are read.
        let width: number;
        let height: number;
        let removed = stripped.removed;
        const strippedBlob = new Blob([stripped.bytes as BlobPart], { type });
        if (plan.kind === 'strip-only') {
          blob = strippedBlob;
          width = header.width ?? decoded.width;
          height = header.height ?? decoded.height;
        } else {
          let best: Blob | null = null;
          for (const quality of qualityLadder(processing)) {
            if (signal.aborted) return;
            best = await runtime.encode(decoded, { ...plan, quality }, signal);
            const target = processing === false ? undefined : processing?.targetBytes;
            if (!target || best.size <= target) break;
          }
          blob = best as Blob;
          outType = plan.type;
          width = plan.width || decoded.width;
          height = plan.height || decoded.height;
          removed = header.metadata.length ? [...header.metadata] : [];
          // A resize never makes a file bigger: keep the stripped original when it is smaller and unchanged in look.
          if (
            plan.crop === null &&
            plan.quarter === 0 &&
            header.orientation === 1 &&
            header.width !== null &&
            blob.size >= strippedBlob.size &&
            plan.type === type
          ) {
            blob = strippedBlob;
            outType = type;
            width = header.width;
            height = header.height ?? height;
            removed = stripped.removed;
          }
        }
        const thumb = await runtime.thumbnail(decoded, 320);
        runtime.dispose?.(decoded);
        if (signal.aborted) return;
        const previewUrl = runtime.createObjectURL(thumb);
        const output: ProcessedPhoto = {
          blob,
          type: outType,
          width,
          height,
          bytes: blob.size,
          metadataRemoved: removed,
          alt: item.alt,
        };
        if (!live.current) return runtime.revokeObjectURL(previewUrl);
        const old = itemsRef.current.find((i) => i.id === id)?.previewUrl;
        if (old) runtime.revokeObjectURL(old);
        commit({ type: 'processed', id, output, previewUrl }, 'status', id);
      } catch (e) {
        if (signal.aborted) return;
        fail('encode-failed', e instanceof Error ? e.message : undefined);
      }
    },
    [commit, processing, runtime],
  );

  const startUpload = React.useCallback(
    (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item?.output) return;
      const controller = new AbortController();
      controllers.current.set(id, controller);
      commit({ type: 'upload', id }, 'status', id);
      onUpload(item.output, {
        id,
        signal: controller.signal,
        attempt: item.attempt,
        onProgress: (value) => {
          if (!controller.signal.aborted) commit({ type: 'progress', id, value }, 'status', id);
        },
      }).then(
        (result) => {
          if (!controller.signal.aborted) commit({ type: 'resolved', id, result }, 'status', id);
        },
        (e: unknown) => {
          if (controller.signal.aborted) return;
          // `retryable` on the error means "Try again is offered": always, for a failed upload.
          // Trying again by itself is for the adapter to ask for, with `PhotoUploadError({ retryable: true })`.
          const byItself = e instanceof PhotoUploadError && e.options.retryable;
          const error: PhotoError = {
            code: 'upload-failed',
            retryable: true,
            detail: e instanceof Error ? e.message : undefined,
          };
          commit({ type: 'failed', id, error }, 'status', id);
          if (shouldAutoRetry({ ...error, retryable: byItself }, item.attempt, retries)) {
            const timer = setTimeout(() => {
              timers.current.delete(timer);
              if (live.current) commit({ type: 'retry', id }, 'retry', id);
            }, retryDelay(item.attempt, random));
            timers.current.add(timer);
          }
        },
      );
    },
    [commit, onUpload, random, retries],
  );

  // Uploads start when a slot is free, the network is up, and (manual) the person said go.
  React.useEffect(() => {
    for (const id of nextToUpload(items, { concurrency, online, manual, released })) startUpload(id);
    if (manual && released && !items.some((i) => i.status === 'ready' || i.status === 'uploading')) setReleased(false);
  }, [items, concurrency, online, manual, released, startUpload]);

  // Online and touch are read after mount, so the server and first client render agree.
  React.useEffect(() => {
    setTouch(typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // One announcement per change, coalesced over 400 ms. Nothing on the first render.
  React.useEffect(() => {
    const said = announcements(prev.current, items, { online, wasOnline: wasOnline.current, text: t.errors });
    prev.current = items;
    wasOnline.current = online;
    if (said.length === 0) return;
    buffer.current.push(...said);
    if (flush.current) clearTimeout(flush.current);
    flush.current = setTimeout(() => {
      setAnnounce(buffer.current.join('. '));
      buffer.current = [];
      flush.current = null;
    }, 400);
  });

  // Unmount aborts every item, clears timers and revokes every preview.
  React.useEffect(() => {
    live.current = true;
    const ctrl = controllers.current;
    const tm = timers.current;
    return () => {
      live.current = false;
      for (const c of ctrl.values()) c.abort();
      for (const timer of tm) clearTimeout(timer);
      if (flush.current) clearTimeout(flush.current);
      for (const i of itemsRef.current) if (i.previewUrl) runtime.revokeObjectURL(i.previewUrl);
    };
  }, [runtime]);

  const addFiles = React.useCallback(
    async (list: File[]) => {
      if (disabled || readOnly || list.length === 0) return;
      const heads = await Promise.all(
        list.map(async (f) => ({
          name: f.name,
          size: f.size,
          lastModified: f.lastModified,
          head: new Uint8Array(await f.slice(0, HEAD_BYTES).arrayBuffer()),
        })),
      );
      const intake = planIntake(heads, itemsRef.current, { accept, maxFiles, maxFileBytes, maxPixels });
      const made: PhotoItem[] = intake.accepted.map((a) => {
        const f = list[a.index] as File;
        const id = newId();
        files.current.set(id, f);
        return {
          id,
          name: f.name,
          status: 'queued',
          progress: 0,
          attempt: 0,
          source: { bytes: f.size, type: a.type, width: a.header.width, height: a.header.height },
          output: null,
          previewUrl: null,
          alt: '',
          crop: { rect: null, quarter: 0 },
          error: null,
          result: null,
          fingerprint: fingerprintOf({ name: f.name, size: f.size, lastModified: f.lastModified }),
        };
      });
      const rejected = intake.rejected.map((r) => ({ name: r.name, error: r.error }));
      setRejections(
        rejected.length || made.length
          ? { added: made.length, skipped: [...new Set(rejected.map((r) => errorText(r.error.code)))] }
          : null,
      );
      if (made.length > 0) commit({ type: 'add', items: made }, 'added', made[0]?.id ?? null, rejected);
      else if (rejected.length > 0) {
        onValueChange?.(itemsRef.current, { reason: 'rejected', id: null, rejected });
      }
      for (const m of made) {
        if (cropOpts?.required) setCropping((c) => c ?? m.id);
        else void process(m.id);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accept, commit, cropOpts?.required, disabled, maxFileBytes, maxFiles, maxPixels, onValueChange, process, readOnly],
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (!name) e.target.value = '';
    void addFiles(picked);
  };
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const fullNow = items.filter((i) => i.status !== 'canceled' && i.status !== 'error').length >= maxFiles;
  const state = STATE_OF(items, maxFiles, disabled, readOnly, online);
  const interactive = !disabled && !readOnly;

  const remove = (id: string) => {
    const order = itemsRef.current.map((i) => i.id);
    const at = order.indexOf(id);
    controllers.current.get(id)?.abort();
    release(id);
    files.current.delete(id);
    commit({ type: 'remove', id }, 'removed', id);
    const target = order[at + 1] ?? order[at - 1];
    queueMicrotask(() => {
      const root = document.querySelector<HTMLElement>(`[data-photo-upload="${baseId}"]`);
      const btn = target
        ? root?.querySelector<HTMLElement>(`[data-id="${target}"] [data-action="remove"]`)
        : chooseRef.current;
      btn?.focus();
    });
  };
  const cancel = (id: string) => {
    controllers.current.get(id)?.abort();
    commit({ type: 'cancel', id }, 'cancel', id);
  };
  const messageOf = (item: PhotoItem) => {
    if (item.status === 'error' && item.error) {
      const why = errorText(item.error.code);
      return item.error.detail && item.error.code === 'upload-failed' ? `${why}: ${item.error.detail}` : why;
    }
    return t.status?.[item.status] ?? STATUS_WORDS[item.status];
  };

  const cropTarget = cropping ? items.find((i) => i.id === cropping) : undefined;
  const restart = (id: string, next: PhotoItem['crop']) => {
    commit({ type: 'crop', id, crop: next }, 'crop', id);
    const item = itemsRef.current.find((i) => i.id === id);
    if (item?.status === 'ready' || item?.status === 'error') {
      itemsRef.current = itemsRef.current.map((i) => (i.id === id ? { ...i, status: 'queued', output: null, error: null } : i));
    }
    void process(id);
  };
  const readyCount = items.filter((i) => i.status === 'ready').length;

  return (
    <div
      role="group"
      aria-labelledby={`${baseId}-label`}
      data-slot="photo-upload"
      data-photo-upload={baseId}
      data-state={state}
      data-count={items.length}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container grid gap-3', className)}
      onPaste={(e) => {
        const pasted = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (pasted.length > 0 && interactive) {
          e.preventDefault();
          void addFiles(pasted);
        }
      }}
      {...rest}
    >
      <span id={`${baseId}-label`} data-slot="photo-upload-label" className="text-sm font-medium">
        {words.label}
      </span>
      <div
        data-slot="photo-upload-dropzone"
        data-drag={drag}
        data-full={fullNow ? '' : undefined}
        {...dropzoneProps}
        onDragEnter={(e) => {
          dropzoneProps?.onDragEnter?.(e);
          if (interactive && !fullNow && hasFiles(e)) setDrag('over');
        }}
        onDragOver={(e) => {
          dropzoneProps?.onDragOver?.(e);
          if (interactive && hasFiles(e)) e.preventDefault();
        }}
        onDragLeave={(e) => {
          dropzoneProps?.onDragLeave?.(e);
          setDrag('idle');
        }}
        onDrop={(e) => {
          dropzoneProps?.onDrop?.(e);
          setDrag('idle');
          if (!interactive || !hasFiles(e)) return;
          e.preventDefault();
          void addFiles(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          'border-border bg-muted/40 grid min-h-32 place-items-center gap-2 rounded-lg border border-dashed p-4 text-center motion-safe:transition-colors',
          drag === 'over' && 'border-primary bg-primary/10',
          // Only the controls dim (has-[:disabled]:opacity-50 on them): dimming the whole zone took the hint below 4.5:1.
          dropzoneProps?.className,
        )}
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <label
            data-slot="photo-upload-pick"
            className="has-[:focus-visible]:ring-ring relative border-input bg-background hover:bg-accent inline-flex h-control cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-medium has-[:focus-visible]:ring-2 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50"
          >
            <ImagePlusIcon aria-hidden="true" className="size-4" />
            {words.choose}
            <input
              ref={chooseRef}
              type="file"
              name={name}
              accept={accept.join(',')}
              multiple={maxFiles > 1}
              disabled={disabled || readOnly || fullNow}
              onChange={onPick}
              className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
          </label>
          {capture && touch ? (
            <label
              data-slot="photo-upload-camera"
              className="has-[:focus-visible]:ring-ring relative border-input bg-background hover:bg-accent inline-flex h-control cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-medium has-[:focus-visible]:ring-2 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50"
            >
              <CameraIcon aria-hidden="true" className="size-4" />
              {words.camera}
              <input
                type="file"
                accept="image/*"
                capture={capture}
                disabled={disabled || readOnly || fullNow}
                onChange={onPick}
                className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              />
            </label>
          ) : null}
        </div>
        <p data-slot="photo-upload-hint" className="text-muted-foreground text-sm">
          {fullNow ? words.full : !online ? words.offline : words.hint}
        </p>
      </div>
      {rejections && (rejections.skipped.length > 0 || rejections.added > 0) ? (
        <p role="status" data-slot="photo-upload-rejections" className="text-muted-foreground text-sm">
          {rejections.skipped.length === 0
            ? null
            : wordsOf(
                t.rejections,
                rejections.added,
                rejections.skipped.join(', '),
                `${rejections.added} added. Skipped: ${rejections.skipped.join(', ')}`,
              )}
        </p>
      ) : null}
      {items.length > 0 ? (
        <ul data-slot="photo-upload-list" aria-label={words.label} className="grid gap-2">
          {items.map((item, index) => {
            const canCrop = cropOpts && interactive && (item.status === 'ready' || item.status === 'error' || item.status === 'queued');
            return (
              <Item
                key={item.id}
                item={item}
                index={index}
                total={items.length}
                altText={altText}
                message={messageOf(item)}
                labels={{
                  crop: words.crop,
                  retry: words.retry,
                  cancel: words.cancel,
                  remove: words.remove,
                  alt: words.alt,
                  locationRemoved: words.locationRemoved,
                  detailsRemoved: words.detailsRemoved,
                }}
                actions={{
                  crop: canCrop
                    ? () => {
                        cropButton.current = document.activeElement as HTMLElement;
                        setCropping(item.id);
                      }
                    : undefined,
                  retry:
                    item.status === 'error' && item.error?.retryable && interactive
                      ? () => {
                          commit({ type: 'retry', id: item.id }, 'retry', item.id);
                          if (!itemsRef.current.find((i) => i.id === item.id)?.output) void process(item.id);
                        }
                      : undefined,
                  cancel:
                    interactive && ['queued', 'reading', 'processing', 'uploading'].includes(item.status)
                      ? () => cancel(item.id)
                      : undefined,
                  remove: interactive ? () => remove(item.id) : undefined,
                  setAlt: interactive ? (alt) => commit({ type: 'alt', id: item.id, alt }, 'alt', item.id) : undefined,
                }}
              />
            );
          })}
        </ul>
      ) : null}
      {manual && readyCount > 0 && interactive ? (
        <Button type="button" data-slot="photo-upload-submit" onClick={() => setReleased(true)}>
          {words.upload}
        </Button>
      ) : null}
      <p data-slot="photo-upload-announce" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </p>
      {cropTarget && cropOpts !== null ? (
        <React.Suspense fallback={null}>
          <PhotoCropper
            item={cropTarget}
            aspect={cropOpts.aspect ?? null}
            shape={cropOpts.shape ?? 'rect'}
            labels={t.cropper}
            onApply={(next: { rect: CropRect | null; quarter: Quarter }) => {
              const id = cropTarget.id;
              setCropping(null);
              if (cropOpts.required && cropTarget.status === 'queued' && !cropTarget.output) {
                commit({ type: 'crop', id, crop: next }, 'crop', id);
                void process(id);
              } else restart(id, next);
              cropButton.current?.focus();
            }}
            onCancel={() => {
              const id = cropTarget.id;
              setCropping(null);
              if (cropOpts.required && cropTarget.status === 'queued' && !cropTarget.output) remove(id);
              cropButton.current?.focus();
            }}
          />
        </React.Suspense>
      ) : null}
    </div>
  );
}

export { PhotoUpload };
