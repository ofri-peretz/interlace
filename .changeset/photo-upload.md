---
'@interlace/ui': minor
---

Add photos to any form. `PhotoUpload` takes photos from a file dialog, a drop, a paste and the phone's camera (`capture`), makes them fit on the device (a long edge of 2048 px and a quality of 0.82 unless you say otherwise, never bigger than the original), and hands the app one small, clean file at a time. Everything a photo says about its owner (location, camera, time, an embedded preview) is cut out of the file before any byte leaves the page, and the item says "Location removed" only when a location was there. The component never opens a connection: you pass `onUpload(photo, ctx)`, which reports progress, stops on `ctx.signal`, and may throw `PhotoUploadError({ retryable: true })` to be tried again after 1 s, 2 s, 4 s. Each photo shows its state in words and an icon (reading, processing, uploading with a real progress number, done, failed with Try again, canceled), the real file input stays in the tab order, and a form with JavaScript off still posts the file. `crop` adds a keyboard-operable crop and turn dialog, loaded only when used. `patterns/photo-upload-model` holds the pure rules (file sniffing by bytes, the metadata strip, the plan, the item reducer); `patterns/photo-upload-xhr` is an optional `xhrUploader` for upload progress.

Components: photo-upload
