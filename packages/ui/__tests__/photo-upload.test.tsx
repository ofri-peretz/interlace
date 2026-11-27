/**
 * PhotoUpload locks, with a fake ImageRuntime: what the person can do (pick, drop, paste, take a
 * photo, crop, retry, cancel, remove), what the page says while it happens, and what leaves
 * through `onUpload` (never a byte of metadata, never a network call of its own).
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PhotoUpload, PhotoUploadError, type PhotoItem, type PhotoUploadProps } from '../src/patterns/photo-upload.js';
import type { ImageRuntime } from '../src/patterns/photo-upload-runtime.js';
import { fileOf, jpeg, leftovers, png, webp } from './fixtures/photo-fixtures.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const bytesOf = (blob: Blob) =>
  new Promise<Uint8Array>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
    r.readAsArrayBuffer(blob);
  });

/** A runtime that draws nothing and counts everything. Its encoder returns clean bytes, as a canvas does. */
function fakeRuntime(over: Partial<ImageRuntime> = {}) {
  let n = 0;
  const rt = {
    decode: vi.fn(async (blob: Blob) => ({ width: 800, height: 600, handle: blob })),
    encode: vi.fn(async (_img, plan) => new Blob([jpeg({ width: plan.width, height: plan.height })], { type: plan.type })),
    thumbnail: vi.fn(async () => new Blob(['t'], { type: 'image/jpeg' })),
    createObjectURL: vi.fn(() => `blob:fake/${++n}`),
    revokeObjectURL: vi.fn(),
    dispose: vi.fn(),
    ...over,
  } satisfies ImageRuntime;
  return rt;
}

type Props = Partial<PhotoUploadProps>;
function setup(props: Props = {}) {
  const runtime = props.runtime ?? fakeRuntime();
  const onUpload = props.onUpload ?? vi.fn(async (_p, ctx) => (ctx.onProgress(0.5), { ok: true }));
  let id = 0;
  const ui = (p: Props) => (
    <form data-testid="form">
      <PhotoUpload
        data-testid="pu"
        onUpload={onUpload}
        runtime={runtime}
        makeId={() => `p${++id}`}
        {...props}
        {...p}
      />
    </form>
  );
  const view = render(ui({}));
  return { runtime, onUpload, view, input: () => screen.getByLabelText(/choose (a )?photo/i) as HTMLInputElement, rerender: (p: Props) => view.rerender(ui(p)) };
}

const done = () => screen.findByText('Uploaded');

describe('adding photos', () => {
  it('picks a photo, takes the metadata out, and hands it to onUpload once', async () => {
    const { input, onUpload } = setup();
    const dirty = jpeg({ exif: true, gps: true, thumbnail: true, xmp: true, iptc: true, comment: true });
    expect(leftovers(dirty).length).toBeGreaterThan(0);
    await userEvent.upload(input(), fileOf(dirty, 'holiday.jpg', 'image/jpeg'));
    await done();
    expect(onUpload).toHaveBeenCalledTimes(1);
    const photo = onUpload.mock.calls[0]![0];
    expect(leftovers(await bytesOf(photo.blob))).toEqual([]);
    expect(photo.metadataRemoved).toEqual(['exif', 'gps', 'thumbnail', 'xmp', 'iptc', 'text']);
    expect(screen.getByText(/Location removed/)).toBeTruthy();
    expect(screen.getByText('holiday.jpg')).toBeTruthy();
  });

  it('re-encodes a large photo once, and hands over what the runtime drew', async () => {
    const { input, onUpload, runtime } = setup();
    await userEvent.upload(input(), fileOf(jpeg({ width: 4000, height: 3000, exif: true, gps: true, pad: 5000 }), 'big.jpg'));
    await done();
    expect(runtime.encode).toHaveBeenCalledTimes(1);
    expect(runtime.encode.mock.calls[0]![1]).toMatchObject({ width: 2048, height: 1536, type: 'image/jpeg' });
    const photo = onUpload.mock.calls[0]![0];
    expect(photo).toMatchObject({ width: 2048, height: 1536 });
    expect(leftovers(await bytesOf(photo.blob))).toEqual([]);
    expect(photo.metadataRemoved).toEqual(['exif', 'gps']);
  });

  it('keeps the family and strips PNG and WebP too', async () => {
    const { input, onUpload } = setup();
    await userEvent.upload(input(), [
      fileOf(png({ text: true, exif: true, gps: true, itxt: true, time: true }), 'a.png'),
      fileOf(webp({ exif: true, gps: true, xmp: true }), 'b.webp'),
    ]);
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(2));
    for (const call of onUpload.mock.calls) expect(leftovers(await bytesOf(call[0].blob))).toEqual([]);
  });

  it('takes the stripped original when a re-encode would be bigger', async () => {
    const runtime = fakeRuntime({ encode: vi.fn(async () => new Blob([new Uint8Array(50_000)], { type: 'image/jpeg' })) });
    const { input, onUpload } = setup({ runtime, processing: { maxEdge: 400 } });
    await userEvent.upload(input(), fileOf(jpeg({ exif: true }), 'small.jpg'));
    await done();
    expect(onUpload.mock.calls[0]![0].bytes).toBeLessThan(5_000);
    expect(runtime.encode).toHaveBeenCalledTimes(1);
  });

  it('lands under targetBytes in at most three passes', async () => {
    const sizes = [9000, 5000, 1000];
    let i = 0;
    const runtime = fakeRuntime({ encode: vi.fn(async () => new Blob([new Uint8Array(sizes[i++] ?? 1)], { type: 'image/jpeg' })) });
    const { input, onUpload } = setup({ runtime, processing: { maxEdge: 400, targetBytes: 2000 } });
    await userEvent.upload(input(), fileOf(jpeg({ width: 800, height: 600, pad: 20_000 }), 'p.jpg'));
    await done();
    expect(runtime.encode).toHaveBeenCalledTimes(3);
    expect(onUpload.mock.calls[0]![0].bytes).toBe(1000);
  });

  it('says why a file was skipped and still takes the rest of the batch', async () => {
    const { input, onUpload } = setup();
    await userEvent.upload(input(), [
      fileOf(new TextEncoder().encode('<svg/>'), 'logo.png', 'image/png'),
      fileOf(jpeg(), 'ok.jpg', 'image/jpeg'),
    ]);
    await done();
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toMatch(/1 added.*not a photo/);
  });

  it('reports a rejected batch through onValueChange when nothing was accepted', async () => {
    const onValueChange = vi.fn();
    const { input } = setup({ onValueChange });
    await userEvent.upload(input(), fileOf(new TextEncoder().encode('GIF89a'), 'x.gif', 'image/gif'), { applyAccept: false });
    await waitFor(() => expect(onValueChange).toHaveBeenCalled());
    expect(onValueChange.mock.calls[0]![1]).toMatchObject({ reason: 'rejected', rejected: [{ name: 'x.gif', error: { code: 'type-not-allowed' } }] });
  });

  it('closes the area at maxFiles and says so', async () => {
    const { input } = setup({ maxFiles: 1 });
    await userEvent.upload(input(), fileOf(jpeg(), 'one.jpg'));
    await done();
    expect(input().disabled).toBe(true);
    expect(screen.getByText('You have added the most photos allowed.')).toBeTruthy();
    expect(document.querySelector('[data-slot="photo-upload-dropzone"]')?.hasAttribute('data-full')).toBe(true);
  });

  it('takes dropped files, and ignores a drag of text', async () => {
    const { onUpload } = setup();
    const zone = document.querySelector('[data-slot="photo-upload-dropzone"]')!;
    fireEvent.dragEnter(zone, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(zone.getAttribute('data-drag')).toBe('idle');
    fireEvent.drop(zone, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(onUpload).not.toHaveBeenCalled();
    fireEvent.dragEnter(zone, { dataTransfer: { types: ['Files'], files: [] } });
    expect(zone.getAttribute('data-drag')).toBe('over');
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [fileOf(jpeg(), 'dropped.jpg')] } });
    await done();
    expect(zone.getAttribute('data-drag')).toBe('idle');
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('takes pasted images and nothing else', async () => {
    const { onUpload } = setup();
    const root = screen.getByRole('group');
    fireEvent.paste(root, { clipboardData: { files: [fileOf(new TextEncoder().encode('hi'), 'a.txt', 'text/plain')] } });
    expect(onUpload).not.toHaveBeenCalled();
    fireEvent.paste(root, { clipboardData: { files: [fileOf(jpeg(), 'shot.jpg', 'image/jpeg')] } });
    await done();
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('shows Take photo only on a touch device, after mount, and renders none on the server', async () => {
    const server = renderToString(<PhotoUpload data-testid="s" onUpload={vi.fn()} capture="environment" />);
    expect(server).not.toMatch(/Take photo/);
    setup({ capture: 'environment' });
    expect(screen.queryByText('Take photo')).toBeNull();
    cleanup();
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
    setup({ capture: 'environment' });
    await screen.findByText('Take photo');
    expect(document.querySelector('input[capture="environment"]')).toBeTruthy();
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
  });
});

describe('uploading', () => {
  it('forwards progress as the progress bar value', async () => {
    let report: (n: number) => void = () => {};
    let finish: (v: unknown) => void = () => {};
    const onUpload = vi.fn((_p, ctx) => new Promise((resolve) => ((report = ctx.onProgress), (finish = resolve))));
    const { input } = setup({ onUpload });
    await userEvent.upload(input(), fileOf(jpeg(), 'a.jpg'));
    await waitFor(() => expect(onUpload).toHaveBeenCalled());
    act(() => report(0.62));
    const bar = await screen.findByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('62');
    expect(bar.getAttribute('aria-valuetext')).toBe('62 percent, uploading');
    await act(async () => finish('x'));
    await done();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('retries without drawing the photo again', async () => {
    const onUpload = vi.fn().mockRejectedValueOnce(new PhotoUploadError('nope', { retryable: false })).mockResolvedValue('ok');
    const { input, runtime } = setup({ onUpload, processing: { maxEdge: 100 } });
    await userEvent.upload(input(), fileOf(jpeg(), 'a.jpg'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/the connection dropped: nope/);
    await userEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await done();
    expect(onUpload).toHaveBeenCalledTimes(2);
    expect(runtime.encode).toHaveBeenCalledTimes(1);
    expect(onUpload.mock.calls[1]![1].attempt).toBe(1);
  });

  it('retries a retryable failure by itself, 1 s then 2 s later, and stops after `retries`', async () => {
    const waits: number[] = [];
    const real = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number, ...rest: unknown[]) => {
      if ((ms ?? 0) >= 1000) {
        waits.push(ms as number);
        return real(fn, 10, ...rest);
      }
      return real(fn, ms, ...rest);
    }) as typeof setTimeout);
    const onUpload = vi.fn().mockRejectedValue(new PhotoUploadError('drop', { retryable: true }));
    const { input } = setup({ onUpload, random: () => 0 });
    await userEvent.upload(input(), fileOf(jpeg(), 'a.jpg'));
    // Not `waitFor`: the spy shortens its own 1 s limit. Not inside `act` either: that would hold the retries back.
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    await new Promise((r) => real(r, 700));
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    expect(onUpload).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([1000, 2000]);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('never retries a failure that is not marked retryable, and shows an unknown error as failed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onUpload = vi.fn().mockRejectedValue(new Error('boom'));
    const { input } = setup({ onUpload });
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).upload(input(), fileOf(jpeg(), 'a.jpg'));
    await screen.findByRole('alert');
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('cancels at once, aborts the signal, and ignores a late result', async () => {
    let signal!: AbortSignal;
    let finish: (v: unknown) => void = () => {};
    const onUpload = vi.fn((_p, ctx) => ((signal = ctx.signal), new Promise((resolve) => (finish = resolve))));
    const { input } = setup({ onUpload });
    await userEvent.upload(input(), fileOf(jpeg(), 'a.jpg'));
    await waitFor(() => expect(onUpload).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(signal.aborted).toBe(true);
    expect(screen.getByText('Canceled')).toBeTruthy();
    await act(async () => finish('late'));
    expect(screen.getByText('Canceled')).toBeTruthy();
    expect(screen.queryByText('Uploaded')).toBeNull();
  });

  it('aborts every item and gives back every preview when it unmounts', async () => {
    const signals: AbortSignal[] = [];
    const onUpload = vi.fn((_p, ctx) => (signals.push(ctx.signal), new Promise(() => {})));
    const { input, runtime, view } = setup({ onUpload });
    await userEvent.upload(input(), [fileOf(jpeg(), 'a.jpg'), fileOf(jpeg({ width: 10 }), 'b.jpg')]);
    await waitFor(() => expect(signals).toHaveLength(2));
    view.unmount();
    expect(signals.every((s) => s.aborted)).toBe(true);
    expect(runtime.revokeObjectURL).toHaveBeenCalledTimes(runtime.createObjectURL.mock.calls.length);
  });

  it('gives back the preview when a photo is removed, and moves focus to the next Remove', async () => {
    const { input, runtime } = setup();
    await userEvent.upload(input(), [fileOf(jpeg(), 'a.jpg'), fileOf(jpeg({ width: 10 }), 'b.jpg')]);
    await waitFor(() => expect(screen.getAllByText('Uploaded')).toHaveLength(2));
    await userEvent.click(screen.getAllByRole('button', { name: /^Remove/ })[0]!);
    expect(runtime.revokeObjectURL).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.activeElement?.closest('li')?.textContent).toMatch(/b\.jpg/));
    await userEvent.click(screen.getByRole('button', { name: /^Remove/ }));
    await waitFor(() => expect(document.activeElement).toBe(input()));
  });

  it('waits for Upload in manual mode', async () => {
    const { input, onUpload } = setup({ manual: true });
    await userEvent.upload(input(), fileOf(jpeg(), 'a.jpg'));
    const go = await screen.findByRole('button', { name: 'Upload' });
    expect(onUpload).not.toHaveBeenCalled();
    await userEvent.click(go);
    await done();
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Upload' })).toBeNull();
  });

  it('starts no upload while offline and resumes when the connection returns', async () => {
    const { input, onUpload } = setup();
    act(() => void window.dispatchEvent(new Event('offline')));
    await userEvent.upload(input(), fileOf(jpeg(), 'a.jpg'));
    await screen.findByText('Ready to upload');
    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByText('Waiting for a connection')).toBeTruthy();
    act(() => void window.dispatchEvent(new Event('online')));
    await done();
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('runs at most `concurrency` uploads at once', async () => {
    const finishers: ((v: unknown) => void)[] = [];
    const onUpload = vi.fn(() => new Promise((resolve) => finishers.push(resolve)));
    const { input } = setup({ onUpload, concurrency: 2 });
    await userEvent.upload(input(), [fileOf(jpeg(), 'a.jpg'), fileOf(jpeg({ width: 1 }), 'b.jpg'), fileOf(jpeg({ width: 2 }), 'c.jpg')]);
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(2));
    await act(async () => finishers[0]!('x'));
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(3));
  });
});

describe('states and parts', () => {
  it('has a visible label, a real input in the tab order, and a message for each state', async () => {
    const { input } = setup({ labels: { label: 'Gallery' } });
    expect(screen.getByRole('group', { name: 'Gallery' })).toBeTruthy();
    // The real input stays focusable and in the accessibility tree: laid over its label, not `display: none`.
    expect(input().className).toContain('opacity-0');
    expect(input().className).not.toMatch(/(^| )hidden( |$)/);
    expect(input().hasAttribute('aria-hidden')).toBe(false);
    expect(input().closest('label')).toBeTruthy();
    expect(screen.getByRole('group').getAttribute('data-state')).toBe('empty');
    await userEvent.upload(input(), fileOf(jpeg(), 'a.jpg'));
    await done();
    expect(screen.getByRole('group').getAttribute('data-state')).toBe('all-done');
  });

  it('keeps its hint at full strength when disabled or full: only the controls dim, so the hint stays readable', () => {
    const { input } = setup({ disabled: true });
    const hint = screen.getByText(/drag photos here/i);
    expect(hint.getAttribute('data-slot')).toBe('photo-upload-hint');
    for (let el: Element | null = hint; el && el !== document.body; el = el.parentElement) expect(el.className).not.toMatch(/(^|\s)opacity-/);
    expect(input().disabled).toBe(true);
    expect(input().closest('label')!.className).toContain('has-[:disabled]:opacity-50');
  });

  it('is disabled and read-only without add, remove or crop', async () => {
    const value: PhotoItem[] = [
      {
        id: 'x', name: 'x.jpg', status: 'done', progress: 1, attempt: 0, source: { bytes: 10, type: 'image/jpeg', width: 1, height: 1 },
        output: null, previewUrl: null, alt: '', crop: { rect: null, quarter: 0 }, error: null, result: null, fingerprint: 'x',
      },
    ];
    const { rerender, input } = setup({ value, disabled: true });
    expect(input().disabled).toBe(true);
    expect(screen.getByRole('group').getAttribute('data-state')).toBe('disabled');
    rerender({ value, disabled: false, readOnly: true });
    expect(screen.getByRole('group').getAttribute('data-state')).toBe('read-only');
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
    expect(screen.getByText('x.jpg')).toBeTruthy();
  });

  it('is a form field: the chosen file posts under its name', async () => {
    const { input } = setup({ name: 'photos' });
    const file = fileOf(jpeg(), 'a.jpg');
    await userEvent.upload(input(), file);
    await done();
    const form = new FormData(screen.getByTestId('form') as HTMLFormElement);
    expect(form.getAll('photos')).toHaveLength(1);
  });

  it('works both controlled and uncontrolled and reports every change', async () => {
    const onValueChange = vi.fn();
    const { input } = setup({ onValueChange });
    await userEvent.upload(input(), fileOf(jpeg(), 'a.jpg'));
    await done();
    const reasons = new Set(onValueChange.mock.calls.map((c) => c[1].reason));
    expect(reasons).toContain('added');
    expect(reasons).toContain('status');
    const last = onValueChange.mock.calls.at(-1)![0] as PhotoItem[];
    expect(last[0]).toMatchObject({ status: 'done', name: 'a.jpg' });
    cleanup();
    const seeded = setup({ defaultValue: last, onValueChange });
    expect(seeded.view.container.textContent).toContain('a.jpg');
  });

  it('takes a description per photo with altText, and it becomes the image alt', async () => {
    const { input } = setup({ altText: true, onValueChange: vi.fn() });
    await userEvent.upload(input(), fileOf(jpeg(), 'a.jpg'));
    await done();
    const box = screen.getByPlaceholderText('Describe this photo');
    await userEvent.type(box, 'a hill');
    expect(document.querySelector('img[data-slot="photo-upload-thumb"]')?.getAttribute('alt')).toBe('a hill');
  });

  it('lets an app substitute the item', async () => {
    const Item = ({ item }: { item: PhotoItem }) => <li data-custom>{item.name}!</li>;
    const { input } = setup({ itemComponent: Item as never });
    await userEvent.upload(input(), fileOf(jpeg(), 'a.jpg'));
    await screen.findByText('a.jpg!');
  });

  it('fails with a plain reason when the browser cannot open the picture, and when drawing fails', async () => {
    const runtime = fakeRuntime({ decode: vi.fn(async () => null) });
    const { input } = setup({ runtime });
    await userEvent.upload(input(), fileOf(jpeg(), 'a.jpg'));
    expect((await screen.findByRole('alert')).textContent).toBe('this browser cannot open that format');
    expect(screen.queryByRole('button', { name: /Try again/ })).toBeNull();
    cleanup();
    const broken = fakeRuntime({ encode: vi.fn(async () => Promise.reject(new Error('canvas'))) });
    const again = setup({ runtime: broken, processing: { maxEdge: 100 } });
    await userEvent.upload(again.input(), fileOf(jpeg(), 'b.jpg'));
    expect((await screen.findByRole('alert')).textContent).toBe('the photo could not be prepared');
    expect(screen.getByRole('button', { name: /Try again/ })).toBeTruthy();
  });
});

describe('what a screen reader hears', () => {
  it('says nothing at first, then one coalesced message per change burst', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { input } = setup();
    const region = document.querySelector('[data-slot="photo-upload-announce"]')!;
    expect(region.textContent).toBe('');
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).upload(input(), fileOf(jpeg(), 'a.jpg'));
    await act(async () => vi.advanceTimersByTime(500));
    await waitFor(() => expect(region.textContent).toMatch(/1 photo added/));
    expect(region.textContent).not.toMatch(/%|percent/);
    await act(async () => vi.advanceTimersByTime(500));
    await waitFor(() => expect(region.textContent).toMatch(/Photo 1 of 1 uploaded/));
  });
});

describe('cropping', () => {
  it('opens the cropper, applies a crop, draws once more with it, and returns focus', async () => {
    const { input, runtime } = setup({ crop: { aspect: 1 }, manual: true, processing: { maxEdge: 4000 } });
    await userEvent.upload(input(), fileOf(jpeg({ width: 800, height: 600 }), 'a.jpg'));
    const open = await screen.findByRole('button', { name: /^Crop/ });
    await userEvent.click(open);
    const dialog = await screen.findByRole('dialog');
    const frame = within(dialog).getByRole('application');
    frame.focus();
    await userEvent.keyboard('{ArrowRight}{+}]');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(runtime.encode).toHaveBeenCalled());
    const plan = runtime.encode.mock.calls.at(-1)![1];
    expect(plan.quarter).toBe(90);
    expect(plan.crop).not.toBeNull();
    expect(plan.width / plan.height).toBeCloseTo(1, 1);
  });

  it('removes a photo whose required crop is canceled, and needs the crop before it uploads', async () => {
    const { input, onUpload } = setup({ crop: { required: true, aspect: 1, shape: 'round' } });
    await userEvent.upload(input(), fileOf(jpeg(), 'a.jpg'));
    const dialog = await screen.findByRole('dialog');
    expect(onUpload).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('a.jpg')).toBeNull());
    await userEvent.upload(input(), fileOf(jpeg({ width: 5 }), 'b.jpg'));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Apply' }));
    await done();
    expect(onUpload).toHaveBeenCalledTimes(1);
  });
});

describe('no connection of its own', () => {
  it('calls no fetch, XHR, beacon or WebSocket through add, crop, process and remove: only onUpload speaks', async () => {
    const spies = {
      fetch: vi.fn(),
      xhr: vi.fn(),
      beacon: vi.fn(),
      ws: vi.fn(),
    };
    vi.stubGlobal('fetch', spies.fetch);
    vi.stubGlobal('XMLHttpRequest', spies.xhr);
    vi.stubGlobal('WebSocket', spies.ws);
    Object.defineProperty(navigator, 'sendBeacon', { value: spies.beacon, configurable: true });
    const { input, onUpload } = setup({ crop: {}, processing: { maxEdge: 100 } });
    await userEvent.upload(input(), fileOf(jpeg({ exif: true, gps: true }), 'a.jpg'));
    await done();
    await userEvent.click(screen.getByRole('button', { name: /^Remove/ }));
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(spies.fetch).not.toHaveBeenCalled();
    expect(spies.xhr).not.toHaveBeenCalled();
    expect(spies.beacon).not.toHaveBeenCalled();
    expect(spies.ws).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

beforeEach(() => {
  if (typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = function (this: Blob) {
      return new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as ArrayBuffer);
        r.readAsArrayBuffer(this);
      });
    };
  }
});
void React;
