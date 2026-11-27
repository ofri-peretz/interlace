# Spec: PhotoUpload

Status: draft for acceptance at Design→Build. Intent: [intent.md](./intent.md).
Floor: the 26 rules of `interlace-component`; rule ids are cited where a decision is theirs.
Read against `origin/main` of `interlace-ds-viz` on 2026-11-26.

## 1. Files

| File (in `packages/ui/src/patterns/`) | What | Environment |
| --- | --- | --- |
| `photo-upload-model.ts` | Pure: magic-byte sniff, header dimensions, JPEG/PNG/WebP metadata scan and strip, processing plan, crop math, item reducer, retry delay, announcements. No DOM, no `Date`, no `Math.random` (both injected). | any |
| `photo-upload-runtime.ts` | `ImageRuntime` type and `browserRuntime` (`createImageBitmap`, `OffscreenCanvas` or `<canvas>`, `URL.createObjectURL`). The only file that touches browser image APIs. | browser |
| `photo-upload.tsx` | `PhotoUpload` and its flat parts. `'use client'`. | browser |
| `photo-upload-crop.tsx` | `PhotoCropper` (inside the `Dialog` primitive). Lazy-imported by `PhotoUpload` so a form with `crop={false}` never loads it (R25). | browser |
| `photo-upload-xhr.ts` | Optional `xhrUploader(url, init)`: an `onUpload` built on `XMLHttpRequest` for progress. Subpath export; not imported by the component. | browser |

Registry item `photo-upload`: `registryDependencies` are `button`, `dialog`, `progress` and
`visually-hidden` (all in the kit). npm dependencies: none new (`lucide-react` already present).
A changeset (minor) and `versions:derive` entry are part of the build.

## 2. API

```ts
export type PhotoMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';

export type PhotoStatus =
  | 'queued'      // accepted, waiting for a free slot
  | 'reading'     // header sniffed, bytes being read
  | 'processing'  // resize, orient, strip, encode
  | 'ready'       // processed; waiting for the person to press Upload (`manual`) or for a slot
  | 'uploading'
  | 'done'
  | 'error'
  | 'canceled';

export interface CropRect { x: number; y: number; width: number; height: number } // 0..1 of the oriented source
export type Quarter = 0 | 90 | 180 | 270;
export type MetadataKind = 'exif' | 'gps' | 'xmp' | 'iptc' | 'text' | 'thumbnail';

export interface PhotoItem {
  id: string;                      // from `makeId`, never the file name
  name: string;                    // display only; shown, never sent unless the adapter reads it
  status: PhotoStatus;
  /** 0..1 within the current stage (processing or uploading). */
  progress: number;
  /** 0 on the first try; counts automatic and manual retries of the failed stage. */
  attempt: number;
  source: { bytes: number; type: string; width: number | null; height: number | null };
  /** Set once processing finishes. This is what `onUpload` receives. */
  output: ProcessedPhoto | null;
  /** A thumbnail (longest edge <= 320 px) as an object URL; revoked on remove and unmount. */
  previewUrl: string | null;
  alt: string;
  crop: { rect: CropRect | null; quarter: Quarter };
  error: PhotoError | null;
  /** Whatever `onUpload` resolved with. Opaque to the component. */
  result: unknown;
}

export interface ProcessedPhoto {
  blob: Blob;
  type: PhotoMime;
  width: number;
  height: number;
  bytes: number;
  /** What was found and removed. Empty when the file had none. Never claims what it did not find. */
  metadataRemoved: readonly MetadataKind[];
  alt: string;
}

export type PhotoErrorCode =
  | 'type-not-allowed' | 'too-many' | 'file-too-large' | 'too-many-pixels'
  | 'duplicate' | 'decode-failed' | 'unsupported-format' | 'encode-failed'
  | 'upload-failed' | 'canceled';

export interface PhotoError { code: PhotoErrorCode; retryable: boolean; detail?: string }

export interface UploadContext {
  id: string;
  /** Aborted on cancel, remove and unmount. The adapter must stop work when it fires. */
  signal: AbortSignal;
  /** 0..1. Ignored after the signal aborts. */
  onProgress: (fraction: number) => void;
  /** 0 on the first try. */
  attempt: number;
}
export type PhotoUploader = (photo: ProcessedPhoto, ctx: UploadContext) => Promise<unknown>;

/** Throw this from `onUpload` to say what happened. Any other error is shown as `upload-failed`, not auto-retried. */
export class PhotoUploadError extends Error {
  constructor(message: string, readonly options: { retryable: boolean; code?: 'network' | 'server' | 'rejected' | 'auth' });
}

export interface PhotoProcessing {
  /** Longest edge in px after resize. @default 2048 */
  maxEdge?: number;
  /** 0..1 for lossy encoders. @default 0.82 */
  quality?: number;
  /** `auto`: JPEG stays JPEG, PNG stays PNG, WebP stays WebP. @default 'auto' */
  type?: 'auto' | 'image/jpeg' | 'image/webp';
  /** Try to land under this many bytes with at most 3 encode passes; never below `minQuality`. */
  targetBytes?: number;
  /** @default 0.5 */
  minQuality?: number;
}

export interface PhotoCrop {
  /** width / height; null for free. @default null */
  aspect?: number | null;
  /** `round` masks the preview only; the output is the full rectangle. @default 'rect' */
  shape?: 'rect' | 'round';
  /** Open the cropper for every added photo before processing. @default false */
  required?: boolean;
}

export interface PhotoUploadLabels { /* every string; see §7; each is `string | (n, ctx) => string` */ }

export interface PhotoUploadProps
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'onChange' | 'defaultValue'> {
  'data-testid': string;                           // R5: required, no default
  /** The whole backend surface. Required: the component has no default destination. */
  onUpload: PhotoUploader;

  value?: readonly PhotoItem[];                    // R14 controlled
  defaultValue?: readonly PhotoItem[];             //     uncontrolled
  onValueChange?: (items: readonly PhotoItem[], details: PhotoChangeDetails) => void;

  /** @default ['image/jpeg', 'image/png', 'image/webp'] */
  accept?: readonly PhotoMime[];
  /** @default 10 */
  maxFiles?: number;
  /** Largest input file, in bytes, before any processing. @default 26_214_400 (25 MiB) */
  maxFileBytes?: number;
  /** Largest input in pixels (w x h), read from the header before decoding. @default 40_000_000 */
  maxPixels?: number;
  /** `false` skips resize and re-encode but never skips the metadata strip. */
  processing?: PhotoProcessing | false;
  /** `false` hides the Crop action. */
  crop?: PhotoCrop | false;
  /** Adds a "Take photo" button that opens the camera on a touch device. Absent: no button. */
  capture?: 'environment' | 'user';
  /** Wait for an Upload button instead of uploading as soon as a photo is processed. @default false */
  manual?: boolean;
  /** Uploads at once. @default 3 */
  concurrency?: number;
  /** Automatic tries after a `retryable` failure, with backoff. @default 2 */
  retries?: number;
  /** Show a "Describe this photo" field per photo; its text is `ProcessedPhoto.alt`. @default false */
  altText?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Makes it a real form field: the native input posts the chosen files with JavaScript off. */
  name?: string;
  labels?: PhotoUploadLabels;
  /** Substitute the browser: tests, an agent, a worker, a HEIC decoder. @default browserRuntime */
  runtime?: ImageRuntime;
  /** Injected for tests. @default Date.now / Math.random */
  clock?: () => number;
  random?: () => number;
  makeId?: () => string;
  /** R10: tweak or inject parts. */
  dropzoneProps?: React.ComponentPropsWithoutRef<'div'>;
  itemComponent?: React.ComponentType<PhotoItemProps>;
}

export interface PhotoChangeDetails {
  reason: 'added' | 'removed' | 'status' | 'alt' | 'crop' | 'retry' | 'cancel' | 'rejected';
  id: string | null;
  /** Files refused before they became items, with why. */
  rejected: readonly { name: string; error: PhotoError }[];
}

export interface ImageRuntime {
  /** Reads width/height and orientation without a full decode when it can. Resolves null if the browser cannot decode this type. */
  decode(blob: Blob, opts: { maxEdge: number; signal: AbortSignal }): Promise<DecodedImage | null>;
  /** Draws the oriented, cropped, resized image and encodes it. */
  encode(img: DecodedImage, plan: EncodePlan, signal: AbortSignal): Promise<Blob>;
  thumbnail(img: DecodedImage, edge: number): Promise<Blob>;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}
```

Notes on shape:

- **R8** booleans default false, so the upload-at-once default is `manual`, not `autoUpload`.
- **R9** `onValueChange(items, details)`; the upload callback is `onUpload`, a function the app
  provides, not an event.
- **R11/R12** `PhotoCropper` slots the existing `Dialog`, `Button`, `Progress`; no
  `PhotoUploadButton` wrapper.
- **R15** one context (`PhotoUploadContext`, memoized value) shared by the root, list and item.
- **R16** the component renders `Dialog` and `Progress` it needs structurally; it does not bundle
  a tooltip or toast. Item messages are text in the item.
- **R17** API parity: nearest incumbents are react-dropzone (props `accept`, `maxFiles`,
  `maxSize`, `onDrop`) and Uppy/FilePond (queue, progress, retry). We take their names where the
  meaning matches (`accept`, `maxFiles`) and diverge on purpose for `maxFileBytes` (units in the
  name), `onUpload` (an adapter, not a destination), and no plugin system (the adapter and the
  `runtime` are the extension points). The source header carries this block with the upstream links.

## 3. Anatomy

```
PhotoUpload                    (div role=group aria-labelledby=label; data-slot="photo-upload"; data-state, data-count)
  ├─ label                     (data-slot="photo-upload-label": the visible name; see §7)
  ├─ div                       (data-slot="photo-upload-dropzone"; data-drag=idle|over; data-full)
  │   ├─ label                 (data-slot="photo-upload-pick": a real <label> wrapping the native input)
  │   │   └─ input type=file   (sr-only but focusable; multiple when maxFiles>1; name; accept)
  │   ├─ label                 (data-slot="photo-upload-camera": same, with capture; shown on touch devices only, after mount)
  │   └─ p                     (data-slot="photo-upload-hint": "or drag photos here, or paste")
  ├─ p role=status            (data-slot="photo-upload-rejections": "2 added. 1 skipped: not a photo")
  ├─ ul                        (data-slot="photo-upload-list", labelled)
  │   └─ li × n                (data-slot="photo-upload-item"; data-status; data-id)
  │       ├─ img | span        (data-slot="photo-upload-thumb": alt="" when the name is next to it)
  │       ├─ div               (data-slot="photo-upload-meta": name, size "812 KB, was 5.4 MB", "Location removed")
  │       ├─ Progress          (data-slot="photo-upload-progress": only while processing or uploading)
  │       ├─ p                 (data-slot="photo-upload-message": the state in words; role=alert only for `error`)
  │       ├─ input type=text   (data-slot="photo-upload-alt": only with altText)
  │       └─ div               (data-slot="photo-upload-actions": Crop, Try again, Cancel, Remove)
  ├─ Button                    (data-slot="photo-upload-submit": only with `manual` and ready items)
  └─ p aria-live=polite        (data-slot="photo-upload-announce", sr-only, atomic)
```

`PhotoCropper` (`data-slot="photo-cropper"`) renders inside `Dialog`: a stage with the image,
a frame, a zoom range, rotate-left and rotate-right buttons, Apply and Cancel.

## 4. Pipeline and policy (the model decides; the runtime executes)

1. **Intake** (`planIntake(files, state, options)` pure): for each `File` in order, refuse with a
   code when: `type-not-allowed` (sniffed from magic bytes, never from the extension or the
   `File.type` alone), `too-many` (beyond `maxFiles`, counting items not `canceled`/`error`),
   `file-too-large`, `too-many-pixels` (from the header), `duplicate` (same bytes length + name +
   `lastModified`). Accepted files become `queued` items; refusals go to `details.rejected` and
   the `rejections` line. One bad file never rejects the batch.
2. **Sniff** (`sniffImage(bytes)` pure): JPEG (`FF D8 FF`), PNG (8-byte signature), WebP
   (`RIFF....WEBP`), AVIF (`ftyp` brand `avif`). SVG, GIF and anything else are `type-not-allowed`
   by default; SVG can carry script, and we refuse rather than sanitise.
3. **Header facts** (`readHeader(bytes)` pure): width, height, JPEG orientation (EXIF tag 0x0112),
   PNG colour type and `tRNS` (has alpha), whether metadata segments are present and which kinds,
   including GPS (EXIF IFD pointer 0x8825) so the item can say "Location removed" only when it
   was there. Reads at most the first 256 KiB plus the PNG chunk list.
4. **Plan** (`planProcessing(header, options)` pure) returns one of:
   - `strip-only`: the file already fits (`max(w,h) <= maxEdge`, orientation 1 or absent, not
     asked to convert) so the bytes are kept and the metadata segments are removed
     byte-for-byte (JPEG APP1 Exif/XMP, APP13 IPTC, COM; PNG `eXIf`, `tEXt`, `zTXt`, `iTXt`,
     `tIME`; WebP `EXIF`, `XMP `). ICC colour profiles are kept so colour does not shift.
   - `reencode`: resize to `maxEdge` (never upscale), apply orientation and any crop and
     rotation, encode. Output type is `auto` (same family) unless `processing.type` says
     otherwise; a PNG with alpha is never converted to JPEG. Canvas output carries no metadata.
   - If the re-encoded output is larger than the stripped original, the stripped original wins
     (a resize never makes a file bigger).
5. **Decode limits**: the runtime decodes with `createImageBitmap(blob, { resizeWidth, resizeHeight,
   resizeQuality: 'high' })` so a 40 MP photo is never held at full size. `maxPixels` guards the
   rest. The thumbnail is produced from the same bitmap.
6. **Upload** (`reduce` drives it): `ready` items start when fewer than `concurrency` are
   `uploading`. `onUpload(output, ctx)` resolves → `done`, `result` stored. It rejects with
   `PhotoUploadError{retryable:true}` → wait `retryDelay(attempt, random)` (1 s, 2 s, 4 s with
   up to 25% jitter) and retry up to `retries`; anything else → `error`, with a **Try again**
   button that re-enters the failed stage and reuses `output` (no second resize).
7. **Offline**: while `navigator.onLine === false` no new upload starts, `uploading` items keep
   their state, and the polite region says "Waiting for a connection". The `online` event resumes.
8. **Cancel and remove**: abort the item's signal, mark it `canceled` at once, ignore any later
   resolve or progress for that id, revoke its object URL. Unmount does the same to every item.
9. **Network egress**: nothing in `photo-upload*.ts(x)` calls `fetch`, `XMLHttpRequest`,
   `sendBeacon`, `WebSocket` or `import()` of a remote URL. Only `photo-upload-xhr.ts`, which the
   component does not import, uses XHR.

## 5. States

Component: `empty`, `drag-over`, `has-items`, `full` (dropzone disabled with the reason as text),
`partial-failure`, `all-done`, `disabled`, `read-only` (items shown, no add or remove),
`offline-waiting`. Item: the eight `PhotoStatus` values. Each state has a story (§9) and a
`data-state`/`data-status` hook; no state is colour alone (icon + words).

Every state also has a **static projection** (principle 6): with no JavaScript the dropzone is a
labelled native file input; with JavaScript and nothing moving, each item is a row of text
("holiday.jpg, 812 KB, uploaded").

## 6. Interaction

| Input | Result |
| --- | --- |
| Tab | to the Choose button (the native input), then Take photo, then each item's actions in order, then Upload |
| Enter / Space on Choose | opens the file dialog (native label behaviour; no script) |
| Drop files on the area | adds them; non-file drags (text, links) are ignored and the drop highlight does not appear |
| Paste (Ctrl/Cmd+V) with focus inside the component | adds `clipboardData.files` that are images |
| Crop (button) | opens `PhotoCropper`; focus moves to the frame |
| In cropper: arrows | pan 1% (Shift: 10%) |
| In cropper: `+` / `-` or the zoom range | zoom |
| In cropper: `[` / `]` | rotate a quarter turn |
| In cropper: Enter / Esc | apply / cancel; focus returns to the Crop button |

Pointer: drag the image under the frame; pinch is not implemented (zoom range and `+`/`-` cover it).

## 7. Accessibility contract

- The group has a visible label (`labels.label`, default "Photos") bound with `aria-labelledby`;
  the native input is named by its wrapping `<label>` ("Choose photos"). No `aria-label` stands
  in for visible text.
- The native input is `sr-only` but focusable, **not** `display:none` and **not**
  `aria-hidden`, so keyboard and screen reader operate the real control. The focus ring is drawn
  on the label via `has-[:focus-visible]`. Target size is at least 44 px (2.5.8 AAA is met, 2.5.8
  AA is the floor).
- `Take photo` is also a label wrapping an input with `capture`. It renders after mount and
  only when `navigator.maxTouchPoints > 0`, so the server and first client render agree (no
  hydration mismatch) and desktop users see no button that does nothing.
- **Announcements** come from `announcements(prev, next)`, a pure function returning at most one
  string per change, and only for transitions, never on first render: "3 photos added",
  "Photo 2 of 3 uploaded", "Photo 2 failed: the connection dropped. Try again is available",
  "Waiting for a connection". A burst of changes is coalesced into one message per 400 ms.
  Per-item progress is **not** announced; the `Progress` has `aria-valuenow`/`aria-valuetext`
  ("62 percent, uploading") and is read on demand.
- An item in `error` shows its message with `role="alert"` once; every other message is plain
  text inside the item (no live region spam).
- Focus: after Remove, focus goes to the next item's Remove, else the previous one's, else the
  Choose button. After Try again, focus stays on the item's primary action. Opening the cropper
  moves focus into it; closing returns it. Adding photos never moves focus.
- Preview images have `alt=""` when the file name sits beside them; with `altText` the text field
  is the description and the image takes it as `alt`.
- Drag-over is not the only way in: every pointer-only affordance (drag, paste) has the Choose
  button as a keyboard equivalent. Pointer-drag in the cropper has arrows and a range.
- Colour: states use icon plus text; contrast AA in light, dark and `contrast-more` (the existing
  baselines); forced-colors uses `CanvasText`/`Highlight` system colours for the frame.
- Motion: the only motion is the progress fill and the item's enter (200 ms, transform and
  opacity, `motion-safe:` only). Under reduced motion both are instant. No animation is
  required to understand any state.
- Reading order matches visual order at 320 px; the layout stacks (`@container`, MIN_VIEWPORT 320).
- RTL: logical properties only (`ps-`, `ms-`, `start`); the crop frame arrow keys are physical
  (Left pans left) and documented as such.

## 8. Test plan

Rule from `AGENTS` and the repo: a fix or feature is not done until a check would have caught
it, **and the check was shown failing on the broken state.** Each proof below names the break
to make, the test that must go red, and is listed in the PR as the break table.

### 8.1 Pure model (`__tests__/photo-upload-model.test.ts`, added to the coverage glob at 100)

- `sniffImage`: each type by magic bytes; a `.jpg` that is a PNG is PNG; an SVG, GIF, empty and
  truncated file are refused with the right code.
- `readHeader`: dimensions for JPEG (SOF0/SOF2), PNG (IHDR), WebP (VP8, VP8L, VP8X) from fixtures;
  JPEG orientation values 1-8; PNG alpha by colour type and by `tRNS`; a corrupt header returns
  `null`, never throws.
- `stripMetadata` JPEG/PNG/WebP: output parses as a valid image of the same dimensions; every
  listed segment is gone; ICC is kept; a file with no metadata comes back byte-identical.
- `planProcessing` table test: fits and orientation 1 → strip-only; larger than `maxEdge` →
  reencode with the right dimensions, never upscales; orientation 6 → reencode; alpha PNG stays
  PNG; `targetBytes` stops after 3 passes and at `minQuality`.
- Crop math: rect clamped inside 0..1; aspect locked while zooming; rotate by quarter swaps
  width/height; round-trip pan then reverse is identity.
- `reduce` (the item reducer): every status transition in §4, illegal transitions ignored,
  late `progress`/`resolve` for a `canceled` id ignored, concurrency respected, retry counts,
  `retryable:false` never retries.
- `retryDelay(attempt, random)`: 1 s, 2 s, 4 s, jitter within 25%, deterministic with a seeded
  `random`.
- `announcements`: transition table; nothing on first render; coalescing; no per-percent text.

### 8.2 Privacy proofs (`__tests__/photo-upload-privacy.test.ts`)

Fixtures are generated by `scripts/make-photo-fixtures.mjs` (hand-built bytes, committed, each
under 2 KB, no real person's photo): JPEG with Exif (GPS 51.5007 N / 0.1246 W as a known byte
pattern, make, model, a 160 px embedded thumbnail), XMP, IPTC and a COM segment; PNG with `eXIf`,
`tEXt`, `iTXt`, `tIME`; WebP with `EXIF` and `XMP `.

- For every fixture and every plan (strip-only, reencode, reencode with crop): the output has
  **zero** of the markers, checked by an **independent scanner written in the test** (searches
  for `Exif\0\0`, `http://ns.adobe.com/xap`, `GPS`, the GPS byte pattern, `eXIf`, `tEXt`, `iTXt`,
  `EXIF`, `XMP `, `\xFF\xE1`, `\xFF\xED`, `\xFF\xFE`), not by the production parser, so the check
  cannot share a bug with the code it checks.
- `metadataRemoved` lists exactly the kinds that were present, and `gps` only when GPS was present.
- Egress: with `fetch`, `XMLHttpRequest`, `navigator.sendBeacon` and `WebSocket` replaced by
  spies, render, add, crop, process and remove: **0 calls**. Only `onUpload` is called.

### 8.3 Component (`__tests__/photo-upload.test.tsx`, fake `ImageRuntime`)

Pick, drop (including a drag of text, ignored), paste (images only), capture button on touch
and absent otherwise; rejections with the right message per code and the rest of the batch
accepted; `maxFiles` reached disables the area and says why; progress forwards `ctx.onProgress`
as `aria-valuenow`; retry reuses `output` (the fake runtime's `encode` is called once); cancel
aborts the signal and ignores a late resolve; unmount aborts every item and
`createObjectURL`/`revokeObjectURL` counts match; offline pauses and `online` resumes; `manual`
shows Upload only with ready items; `disabled` and `readOnly`; controlled and uncontrolled
parity; `name` posts the files through `FormData` in a plain `<form>`; announcements fire once per
change (a spy on the region's text history); focus placement after Remove and after the cropper
closes.

### 8.4 Browser stories as tests (Storybook play functions, run by the existing storybook test job)

Synthetic `DataTransfer` drop and `ClipboardEvent` paste; keyboard-only path: Tab to Choose,
(file set by `userEvent.upload`), Tab to Crop, arrows, Enter, Tab to Remove; axe on every state
story with zero suppressions; a 320 px viewport story; dark, RTL, `contrast-more` baselines in
`apps/storybook/visual/baselines`.

### 8.5 Not measurable in CI, and said so

A real phone camera, real HEIC decode, and a real 12 MP decode in Safari are manual checks on a
named device list, recorded in the PR with date and device. The page that documents the
component says which claims are CI-measured and which are manual.

### 8.6 Deliberate-break proofs (each shown red before the fix is kept)

| Break (done by hand, then reverted) | Test that must fail |
| --- | --- |
| `stripMetadata` skips the JPEG APP1 branch | privacy: GPS marker found in strip-only output |
| `planProcessing` returns strip-only when orientation is 6 | plan table; and the orientation fixture renders sideways in the fake runtime |
| `reencode` result not compared with the stripped original | "never grows" case |
| `sniffImage` trusts `File.type` | the `.jpg`-that-is-PNG and SVG-labelled-PNG cases |
| `reduce` applies a resolve for a `canceled` item | cancel-then-late-resolve case |
| Remove forgets `revokeObjectURL` | object-URL balance test |
| Retry re-runs `encode` | "encoded once" assertion |
| `announcements` fires on first render | no-announce-on-load case |
| `onProgress` announced per percent | coalescing case |
| `Take photo` rendered during SSR | hydration test (server markup equals first client render) |
| Input `display:none` instead of `sr-only` | keyboard story (Tab never reaches Choose) and axe |
| Component calls `fetch` when `onUpload` is missing | egress spy |
| Dropzone enters drag-over for a text drag | drag-type case |

Plus the mutation lane (see `mutation-testing-room-logic`): `photo-upload-model.ts` joins its
scope the day it merges.

## 9. Storybook stories (`apps/storybook/src/stories/patterns/PhotoUpload.stories.tsx`, `Meta<typeof PhotoUpload>`)

`Default`, `Multiple`, `WithCamera`, `CropRequiredSquareRound`, `CropBanner16x9`, `Uploading`
(deterministic fake adapter with a fake clock), `PartialFailureRetry`, `RetryableThenSuccess`,
`Offline`, `Rejections` (wrong type, too big, too many pixels, duplicate), `Full`, `Manual`,
`AltText`, `Disabled`, `ReadOnly`, `InsideForm` (no-JS fallback via `name`), `Mobile320`, `Rtl`,
`ReducedMotion`, `FileDropOnly` (play function). The docs page carries a short "Where do the
photos go?" block with an `xhrUploader` example and a signed-URL PUT example, both ten lines,
both marked as the app's code.

## 10. Performance and size

- Server component by default is not possible (it is interactive); `'use client'` on
  `photo-upload.tsx`; the cropper is lazy; the model has no import of React.
- CLS = 0: the dropzone has a fixed `min-h`; each item row reserves its height; thumbnails carry
  `aspect-square` and fixed size.
- Budgets, to be **recorded at first build, then ratcheted**: gzip size of model + component
  (cropper separate); time from drop to first thumbnail and to output for the fixture corpus in
  a named headless Chromium; peak decoded pixel count (must stay below `maxPixels`). No number
  appears in docs before it is measured, with command and date.

## Out of scope

Live `getUserMedia` viewfinder; HEIC conversion in JS; animated GIF/APNG handling; video; EXIF
editing or showing metadata; face or object detection; filters; reordering; chunked or resumable
uploads (the adapter can do them); server code; analytics events (an app wraps `onValueChange`);
a drop target for the whole window.

## 12. Open questions, each with the default the build agent takes

| Question | Default |
| --- | --- |
| Offer `stripMetadata={false}`? | No. Revisit only with a written use and a second person's accept. |
| Keep the ICC profile on strip-only? | Yes; re-encode paths output sRGB. |
| Convert opaque PNGs to WebP by default? | No; `type: 'auto'` keeps the family. The app opts in. |
| Paste scope: element or document? | Element (focus inside). A document-level paste is a footgun in forms with text inputs. |
| Guard against a file dropped outside the zone (browser navigates to it)? | No; page-level behaviour belongs to the app. |
| A live viewfinder? | Not in v1; the `capture` input covers phones. Separate component if asked for twice. |
| Dedupe key | name + size + `lastModified`; a hash needs a full read and gives little. |
| Auto-retry unknown errors? | No; only `PhotoUploadError{retryable:true}`. Unknown errors get a manual Try again. |
| `Take photo` on desktop with a webcam? | Hidden; desktop browsers ignore `capture` and open the file dialog anyway. |
| Worker for encode? | Not in v1 (registry copies one file per item; a worker file breaks that). Revisit when a measured long task exceeds 50 ms on the corpus. |
| Default `maxEdge` 2048 and quality 0.82? | Yes, until measured against the fixture corpus; the number that stays is the one the measurement picks. |
