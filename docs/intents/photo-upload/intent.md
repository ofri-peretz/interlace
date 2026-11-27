# Intent — a person can add photos to any form, from any device, without the component knowing where they go

**Status:** draft · **Opened:** `2026-11-26` · written from Ofri's list of remaining design-system gaps. Not accepted:
a human accepts at Design→Build. Lives at `docs/intents/photo-upload/intent.md` with `spec.md`
beside it (the intent lock refuses an approved intent with no spec).

## What is wanted

One component, `PhotoUpload`, that takes photos from the five places people actually get them
and hands the app small, clean, ready-to-send files:

1. **Pick** (file dialog), **drag** (onto the area), **paste** (a screenshot or a copied image),
   **camera** (the phone's own camera, through the file input's `capture` attribute).
2. **Make them fit, on the device**: resize and compress in the browser, so a 12 MP phone photo
   does not cross the network as 6 MB.
3. **Crop** when the app asks for it (a square avatar, a 16:9 banner), by pointer and by keyboard.
4. **Show the truth about each photo**: reading, processing, uploading with a real progress
   number, done, failed with a reason and a way to try again, cancelled.
5. **Strip what the photo says about its owner** (location, camera, time, thumbnails inside the
   file) before any byte leaves the page.
6. **Assume no backend.** The component never calls `fetch`. The app passes one function,
   `onUpload`, and that function is the only place bytes go.

Neutral, per the registry's rules: no product's name, copy or colours; a brand arrives through
CSS variables; every string is a `labels` entry with a plain default.

## Why now

- Ofri listed it as a remaining gap on 2026-11-26. A search of `origin/main` for `upload`,
  `dropzone`, `camera`, `image` the same day finds no file picker, no dropzone and no image
  pipeline in `packages/ui`; the forms we have (`MultiStepForm`) take text and native inputs.
- A form that takes a photo is the most common thing a bare `<input type="file">` does badly:
  no progress, no preview, no size limit until the server says no, and on a phone the file
  carries the owner's GPS position. Every product that builds this alone rebuilds the same
  EXIF-stripping and resize code, usually by adding an npm package for each.
- The live-room and games kit already reach phones; people there will want to send a picture
  (a team photo, an answer drawn on paper). The component must stand alone and also fit that
  use, with no coupling to it.

## Constraints

- **Privacy is the default and cannot be switched off by accident.** A file that reaches
  `onUpload` has no EXIF, GPS, XMP, IPTC or embedded thumbnail. That is proven by a fixture
  that carries each of them and a second, independent scan of the output (see spec).
- **Zero new dependencies.** Browser APIs only (`createImageBitmap`, `OffscreenCanvas` with a
  `<canvas>` fallback, `Blob`, `DataTransfer`, `XMLHttpRequest` for the optional helper).
  `lucide-react` icons and registry primitives already in the kit are reused.
- **Every caller is first-class.** Keyboard alone completes add, crop, retry, remove. A screen
  reader hears each photo's state change once. A reduced-motion reader sees no animation.
  A form with JavaScript off still posts the file (native input, `name`).
- **Honest when it cannot do something.** HEIC that this browser cannot decode is an error
  with a plain reason, not a silent skip. An SVG is refused, not sanitised.
- **Every number is measured or absent.** Sizes, processing time and the "bytes saved" line
  come from a command and a date, or the cell says "recorded when measured".

## Decisions already taken (the spec carries the reasoning)

| Decision | Why |
| --- | --- |
| Adapter `onUpload(photo, ctx)`; progress via `ctx.onProgress`, cancel via `ctx.signal` | `fetch` has no upload progress; the app picks XHR, a signed-URL PUT, or a mock. One function is the whole backend surface. |
| Native `<input type="file" capture>` for the camera, no in-page `getUserMedia` viewfinder in v1 | No permission-prompt states, no stream cleanup, works in every mobile browser. A live viewfinder is a separate component later. |
| Re-encode when the file needs resizing or its orientation is not 1; byte-level metadata strip otherwise | Re-encoding drops metadata by construction; a pure byte-stripper keeps small, already-fine JPEGs lossless. |
| Pure model (`photo-upload-model.ts`) holds parsing, planning and the item reducer; the browser pipeline sits behind an `ImageRuntime` | The model is testable without a browser and enters the mutation scope on day one. A test, an agent or another runtime substitutes the runtime. |
| No `stripMetadata={false}` in v1 | A privacy default with an off-switch is a footgun a form author flips to "fix" a colour shift. If a use ever needs it, it becomes its own decision. |

## Left out

- A live camera viewfinder and any `getUserMedia` code.
- Server code, signed-URL helpers beyond one optional XHR adapter, image CDNs.
- Video, documents, HEIC conversion in JavaScript (the `ImageRuntime` can take a decoder from the
  app), animated-GIF editing, filters, drawing, face detection.
- Reordering photos, albums, galleries (a gallery is a different component that can read the same
  `PhotoItem[]`).

## Success criteria

- Registry install: the item installs into a scratch Next.js app in the existing registry e2e job.
- Zero axe violations and zero suppressions on every story, in light, dark and `contrast-more`.
- Privacy fixtures: 0 metadata bytes in output on every fixture, on every run (a lock, not a goal).
- Bundle: gzip size of model plus component is recorded at first build and then ratchets down.
- A breach writes a new intent; none of these is a public claim until it has a command and a date.

## Open questions

Listed with a default in `spec.md` §12.
