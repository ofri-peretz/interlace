/**
 * PhotoUpload model locks: what a file really is, what it says about its owner and the
 * removal of that, the plan for each file, the crop maths, the item reducer, the retry
 * delay and what a screen reader is told. No DOM here: the model is pure.
 */
import { describe, expect, it } from 'vitest';

import {
  aspectAfter,
  announcements,
  clampRect,
  DEFAULT_ACCEPT,
  fingerprintOf,
  formatBytes,
  HEAD_BYTES,
  initialCrop,
  isLive,
  nextToUpload,
  orientedSize,
  panRect,
  PhotoUploadError,
  planIntake,
  planProcessing,
  qualityLadder,
  readHeader,
  reduce,
  retryDelay,
  rotateQuarter,
  shouldAutoRetry,
  sniffImage,
  stripMetadata,
  zoomRect,
  type PhotoItem,
  type PhotoStatus,
} from '../src/patterns/photo-upload-model.js';
import { jpeg, leftovers, png, webp } from './fixtures/photo-fixtures.js';

const item = (over: Partial<PhotoItem> = {}): PhotoItem => ({
  id: 'a',
  name: 'a.jpg',
  status: 'queued',
  progress: 0,
  attempt: 0,
  source: { bytes: 1000, type: 'image/jpeg', width: 800, height: 600 },
  output: null,
  previewUrl: null,
  alt: '',
  crop: { rect: null, quarter: 0 },
  error: null,
  result: null,
  fingerprint: 'a.jpg:1000:1',
  ...over,
});
const out = { blob: new Blob(['x']), type: 'image/jpeg' as const, width: 8, height: 6, bytes: 1, metadataRemoved: [], alt: '' };

describe('sniffImage', () => {
  it('knows each type by its first bytes', () => {
    expect(sniffImage(jpeg())).toBe('image/jpeg');
    expect(sniffImage(png())).toBe('image/png');
    expect(sniffImage(webp())).toBe('image/webp');
    const avif = Uint8Array.from([0, 0, 0, 24, ...Array.from('ftypavif', (c) => c.charCodeAt(0)), 0, 0, 0, 0]);
    expect(sniffImage(avif)).toBe('image/avif');
  });
  it('refuses SVG, GIF, text, an empty file and a truncated one', () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    expect(sniffImage(enc('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImage(enc('GIF89a....'))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
    expect(sniffImage(Uint8Array.from([0xff, 0xd8]))).toBeNull();
    expect(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e]))).toBeNull();
  });
  it('trusts the bytes, never a name: a PNG saved as .jpg is a PNG', () => {
    expect(sniffImage(png())).toBe('image/png');
  });
});

describe('readHeader', () => {
  it('reads JPEG size and every orientation', () => {
    expect(readHeader(jpeg({ width: 1234, height: 567 }), 'image/jpeg')).toMatchObject({ width: 1234, height: 567, orientation: 1 });
    for (let o = 1; o <= 8; o++) {
      expect(readHeader(jpeg({ orientation: o }), 'image/jpeg')?.orientation).toBe(o);
    }
  });
  it('treats an out-of-range orientation as 1', () => {
    expect(readHeader(jpeg({ orientation: 9 }), 'image/jpeg')?.orientation).toBe(1);
  });
  it('names the metadata kinds it finds, GPS only when GPS is there', () => {
    const all = readHeader(jpeg({ exif: true, gps: true, thumbnail: true, xmp: true, iptc: true, comment: true }), 'image/jpeg');
    expect(all?.metadata).toEqual(['exif', 'gps', 'thumbnail', 'xmp', 'iptc', 'text']);
    expect(readHeader(jpeg({ exif: true }), 'image/jpeg')?.metadata).toEqual(['exif']);
    expect(readHeader(jpeg(), 'image/jpeg')?.metadata).toEqual([]);
  });
  it('reads PNG size, alpha by colour type and by tRNS, and its chunks', () => {
    expect(readHeader(png({ width: 30, height: 20 }), 'image/png')).toMatchObject({ width: 30, height: 20, hasAlpha: false });
    expect(readHeader(png({ alpha: true }), 'image/png')?.hasAlpha).toBe(true);
    expect(readHeader(png({ trns: true }), 'image/png')?.hasAlpha).toBe(true);
    expect(readHeader(png({ exif: true, gps: true, text: true, itxt: true, time: true }), 'image/png')?.metadata).toEqual([
      'exif',
      'gps',
      'xmp',
      'text',
    ]);
    expect(readHeader(png({ text: true }), 'image/png')?.metadata).toEqual(['text']);
  });
  it('reads WebP size from VP8X, VP8 and VP8L, with alpha and metadata', () => {
    expect(readHeader(webp({ width: 640, height: 480 }), 'image/webp')).toMatchObject({ width: 640, height: 480, hasAlpha: false });
    expect(readHeader(webp({ alpha: true, lossless: true }), 'image/webp')?.hasAlpha).toBe(true);
    expect(readHeader(webp({ exif: true, gps: true, xmp: true }), 'image/webp')?.metadata).toEqual(['exif', 'gps', 'xmp']);
    // A bare VP8 and a bare VP8L (no VP8X): the size comes from the frame header.
    const bare = (kind: 'VP8 ' | 'VP8L') => {
      const full = webp({ width: 320, height: 200, lossless: kind === 'VP8L' });
      return full.slice(0, 12).length ? Uint8Array.from([...full.slice(0, 12), ...full.slice(12 + 18)]) : full;
    };
    expect(readHeader(bare('VP8 '), 'image/webp')).toMatchObject({ width: 320, height: 200 });
    expect(readHeader(bare('VP8L'), 'image/webp')).toMatchObject({ width: 320, height: 200 });
  });
  it('gives a header-less answer for AVIF and null for corrupt input, never a throw', () => {
    expect(readHeader(new Uint8Array(32), 'image/avif')).toMatchObject({ width: null, metadata: [] });
    expect(readHeader(Uint8Array.from([0xff, 0xd8, 0, 0, 0]), 'image/jpeg')).toBeNull();
    expect(readHeader(jpeg().slice(0, 30), 'image/jpeg')).toBeNull();
    expect(readHeader(Uint8Array.from([1, 2, 3]), 'image/png')).toBeNull();
    expect(readHeader(png().slice(0, 12).fill(0), 'image/png')).toBeNull();
    expect(readHeader(Uint8Array.from([1, 2, 3]), 'image/webp')).toBeNull();
    expect(readHeader(webp().slice(0, 20), 'image/webp')).toBeNull();
  });
  it('reads a damaged Exif block without throwing', () => {
    const bad = jpeg({ exif: true });
    const at = new TextDecoder('latin1').decode(bad).indexOf('Exif\0\0') + 6;
    bad[at] = 0x58; // the byte order mark is neither II nor MM
    expect(readHeader(bad, 'image/jpeg')?.metadata).toEqual(['exif']);
    const tiny = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0, 12, ...Array.from('Exif', (c) => c.charCodeAt(0)), 0, 0, 0, 0, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 2, 0, 2, 1, 1, 0x11, 0]);
    expect(readHeader(tiny, 'image/jpeg')?.metadata).toEqual(['exif']);
  });
});

describe('stripMetadata', () => {
  it('removes every listed segment from a JPEG and keeps the colour profile', () => {
    const src = jpeg({ exif: true, gps: true, thumbnail: true, xmp: true, iptc: true, comment: true, icc: true });
    const { bytes, removed } = stripMetadata(src, 'image/jpeg');
    expect(removed).toEqual(['exif', 'gps', 'thumbnail', 'xmp', 'iptc', 'text']);
    expect(leftovers(bytes)).toEqual([]);
    expect(new TextDecoder('latin1').decode(bytes)).toContain('ICC_PROFILE');
    expect(readHeader(bytes, 'image/jpeg')).toMatchObject({ width: 800, height: 600, metadata: [] });
  });
  it('removes every listed chunk from a PNG and keeps the profile', () => {
    const { bytes, removed } = stripMetadata(png({ exif: true, gps: true, text: true, itxt: true, time: true, icc: true }), 'image/png');
    expect(removed).toEqual(['exif', 'gps', 'xmp', 'text']);
    expect(leftovers(bytes)).toEqual([]);
    expect(new TextDecoder('latin1').decode(bytes)).toContain('iCCP');
    expect(readHeader(bytes, 'image/png')).toMatchObject({ width: 800, height: 600 });
  });
  it('removes EXIF and XMP from a WebP, fixes the size and the flags, keeps the profile', () => {
    const src = webp({ exif: true, gps: true, xmp: true, icc: true });
    const { bytes, removed } = stripMetadata(src, 'image/webp');
    expect(removed).toEqual(['exif', 'gps', 'xmp']);
    expect(leftovers(bytes)).toEqual([]);
    const riff = (bytes[4] as number) | ((bytes[5] as number) << 8) | ((bytes[6] as number) << 16) | ((bytes[7] as number) << 24);
    expect(riff).toBe(bytes.length - 8);
    expect((bytes[20] as number) & 0x0c).toBe(0);
    expect((bytes[20] as number) & 0x20).toBe(0x20);
    expect(readHeader(bytes, 'image/webp')).toMatchObject({ width: 800, height: 600, metadata: [] });
  });
  it('returns a file with no metadata byte for byte, and what it cannot parse unchanged', () => {
    const clean = jpeg();
    expect(stripMetadata(clean, 'image/jpeg')).toEqual({ bytes: clean, removed: [] });
    const junk = Uint8Array.from([1, 2, 3]);
    expect(stripMetadata(junk, 'image/png')).toEqual({ bytes: junk, removed: [] });
    expect(stripMetadata(junk, 'image/avif')).toEqual({ bytes: junk, removed: [] });
  });
});

describe('planProcessing', () => {
  const head = (over = {}) => ({ ...readHeader(jpeg(), 'image/jpeg')!, ...over });
  it('keeps a file that already fits and only strips it', () => {
    expect(planProcessing(head(), undefined)).toEqual({ kind: 'strip-only' });
    expect(planProcessing(head(), false)).toEqual({ kind: 'strip-only' });
  });
  it('re-encodes a larger photo to maxEdge and never upscales', () => {
    const big = planProcessing(head({ width: 4000, height: 3000 }), undefined);
    expect(big).toMatchObject({ kind: 'reencode', width: 2048, height: 1536, type: 'image/jpeg' });
    expect(planProcessing(head({ width: 4000, height: 3000 }), { maxEdge: 1000 })).toMatchObject({ width: 1000, height: 750 });
    expect(planProcessing(head({ width: 400, height: 300 }), { maxEdge: 1000 })).toEqual({ kind: 'strip-only' });
  });
  it('re-encodes when the orientation is not 1, even with processing off', () => {
    expect(planProcessing(head({ orientation: 6 }), undefined)).toMatchObject({ kind: 'reencode', width: 600, height: 800, orientation: 6 });
    expect(planProcessing(head({ orientation: 6 }), false)).toMatchObject({ kind: 'reencode', width: 600, height: 800 });
  });
  it('keeps the family: PNG stays PNG, WebP stays WebP, an alpha PNG never becomes a JPEG', () => {
    const p = readHeader(png({ alpha: true, width: 4000, height: 3000 }), 'image/png')!;
    expect(planProcessing(p, undefined)).toMatchObject({ type: 'image/png' });
    expect(planProcessing(p, { type: 'image/jpeg' })).toMatchObject({ type: 'image/png' });
    expect(planProcessing(p, { type: 'image/webp' })).toMatchObject({ type: 'image/webp' });
    const w = readHeader(webp({ width: 4000, height: 3000 }), 'image/webp')!;
    expect(planProcessing(w, undefined)).toMatchObject({ type: 'image/webp' });
    expect(planProcessing(head({ width: 4000, height: 3000 }), { type: 'image/webp' })).toMatchObject({ type: 'image/webp' });
  });
  it('converts on request even when the file fits', () => {
    expect(planProcessing(head(), { type: 'image/webp' })).toMatchObject({ kind: 'reencode', type: 'image/webp', width: 800 });
  });
  it('sizes a crop in the picture as shown, after any turn', () => {
    const rect = { x: 0, y: 0, width: 0.5, height: 1 };
    expect(planProcessing(head(), undefined, { rect, quarter: 0 })).toMatchObject({ width: 400, height: 600 });
    expect(planProcessing(head(), undefined, { rect, quarter: 90 })).toMatchObject({ width: 300, height: 800 });
    expect(planProcessing(head(), undefined, { rect: null, quarter: 180 })).toMatchObject({ kind: 'reencode', width: 800, height: 600 });
  });
  it('redraws an AVIF, since its bytes cannot be stripped here, and leaves its size to the runtime', () => {
    const avif = readHeader(new Uint8Array(32), 'image/avif')!;
    expect(planProcessing(avif, undefined)).toMatchObject({ kind: 'reencode', width: 0, height: 0, type: 'image/webp' });
  });
  it('reports the oriented size', () => {
    expect(orientedSize({ width: 800, height: 600, orientation: 6 })).toEqual({ width: 600, height: 800 });
    expect(orientedSize({ width: null, height: null, orientation: 1 })).toEqual({ width: 0, height: 0 });
  });
});

describe('qualityLadder', () => {
  it('tries one quality without a target and at most three with one, never below the floor', () => {
    expect(qualityLadder(undefined)).toEqual([0.82]);
    expect(qualityLadder(false)).toEqual([0.82]);
    expect(qualityLadder({ targetBytes: 1000 })).toEqual([0.82, 0.66, 0.5]);
    expect(qualityLadder({ targetBytes: 1000, quality: 0.6, minQuality: 0.6 })).toEqual([0.6]);
    expect(qualityLadder({ targetBytes: 1, quality: 0.9, minQuality: 0.3 }).every((q) => q >= 0.3)).toBe(true);
  });
});

describe('planIntake', () => {
  const opts = { accept: DEFAULT_ACCEPT, maxFiles: 3, maxFileBytes: 5000, maxPixels: 1_000_000 };
  const f = (bytes: Uint8Array, name: string, over = {}) => ({ name, size: bytes.length, lastModified: 1, head: bytes, ...over });
  it('accepts what is a photo and says why for what is not, one file at a time', () => {
    const r = planIntake(
      [f(jpeg(), 'a.jpg'), f(new TextEncoder().encode('<svg/>'), 'b.png'), f(png(), 'c.png'), f(jpeg({ width: 5000, height: 5000 }), 'big.jpg'), f(jpeg(), 'huge.jpg', { size: 9999 })],
      [],
      opts,
    );
    expect(r.accepted.map((a) => a.index)).toEqual([0, 2]);
    expect(r.rejected.map((x) => [x.name, x.error.code])).toEqual([
      ['b.png', 'type-not-allowed'],
      ['big.jpg', 'too-many-pixels'],
      ['huge.jpg', 'file-too-large'],
    ]);
  });
  it('honours `accept`, refuses beyond maxFiles, and skips a duplicate by name, size and date', () => {
    expect(planIntake([f(png(), 'a.png')], [], { ...opts, accept: ['image/jpeg'] }).rejected[0]?.error.code).toBe('type-not-allowed');
    const full = [item({ id: '1' }), item({ id: '2', fingerprint: 'x' }), item({ id: '3', fingerprint: 'y' })];
    expect(planIntake([f(jpeg(), 'n.jpg')], full, opts).rejected[0]?.error.code).toBe('too-many');
    const same = item({ fingerprint: fingerprintOf({ name: 'a.jpg', size: jpeg().length, lastModified: 1 }), status: 'done' });
    expect(planIntake([f(jpeg(), 'a.jpg')], [same], opts).rejected[0]?.error.code).toBe('duplicate');
    expect(planIntake([f(jpeg(), 'a.jpg'), f(jpeg(), 'a.jpg')], [], opts).rejected.map((r) => r.error.code)).toEqual(['duplicate']);
  });
  it('does not count a canceled or failed item against the limit, and lets a canceled name come back', () => {
    const gone = [item({ id: '1', status: 'canceled' }), item({ id: '2', status: 'error', fingerprint: 'e' }), item({ id: '3', status: 'canceled', fingerprint: 'z' })];
    expect(planIntake([f(jpeg(), 'a.jpg'), f(jpeg(), 'b.jpg'), f(jpeg(), 'c.jpg')], gone, opts).accepted).toHaveLength(3);
  });
  it('rejects a header it cannot read, and takes an AVIF whose size is unknown', () => {
    expect(planIntake([f(Uint8Array.from([0xff, 0xd8, 0xff, 0, 0, 0, 0]), 'x.jpg')], [], opts).rejected[0]?.error.code).toBe('decode-failed');
    const avif = Uint8Array.from([0, 0, 0, 24, ...Array.from('ftypavif', (c) => c.charCodeAt(0)), 0, 0, 0, 0]);
    expect(planIntake([f(avif, 'x.avif')], [], { ...opts, accept: ['image/avif'] }).accepted).toHaveLength(1);
  });
  it('reads at most HEAD_BYTES', () => {
    expect(HEAD_BYTES).toBe(262144);
  });
});

describe('crop maths', () => {
  it('clamps a rectangle inside 0..1 and keeps it from vanishing', () => {
    expect(clampRect({ x: -1, y: 2, width: 0.5, height: 0.5 })).toEqual({ x: 0, y: 0.5, width: 0.5, height: 0.5 });
    expect(clampRect({ x: 0, y: 0, width: 0, height: 9 })).toEqual({ x: 0, y: 0, width: 0.05, height: 1 });
  });
  it('starts with the biggest centred frame of the aspect, or the whole picture', () => {
    expect(initialCrop(null, 4 / 3)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(initialCrop(NaN, 4 / 3)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    const square = initialCrop(1, 2);
    expect(square.width / square.height).toBeCloseTo(0.5);
    expect(initialCrop(2, 1)).toEqual({ x: 0, y: 0.25, width: 1, height: 0.5 });
    expect(initialCrop(1, 1)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
  it('pans and comes back: pan then reverse is the identity, and the frame stays inside', () => {
    const r = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    const back = panRect(panRect(r, 0.1, -0.1), -0.1, 0.1);
    for (const k of ['x', 'y', 'width', 'height'] as const) expect(back[k]).toBeCloseTo(r[k]);
    expect(panRect(r, 5, 5)).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
  });
  it('zooms about the centre, keeps the aspect, and stops at the whole picture and at a small floor', () => {
    const r = { x: 0, y: 0, width: 1, height: 1 };
    const inn = zoomRect(r, 2);
    expect(inn).toEqual({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
    expect(zoomRect(inn, 0.5)).toEqual(r);
    expect(zoomRect(r, 0.5)).toEqual(r);
    const tiny = zoomRect({ x: 0, y: 0, width: 0.06, height: 0.06 }, 10);
    expect(tiny.width).toBeCloseTo(0.05);
    const wide = zoomRect({ x: 0, y: 0.25, width: 1, height: 0.5 }, 2);
    expect(wide.width / wide.height).toBeCloseTo(2);
  });
  it('turns a quarter at a time, and swaps the aspect for 90 and 270', () => {
    expect(rotateQuarter(0, 1)).toBe(90);
    expect(rotateQuarter(0, -1)).toBe(270);
    expect(rotateQuarter(270, 1)).toBe(0);
    expect(aspectAfter(2, 0)).toBe(2);
    expect(aspectAfter(2, 90)).toBe(0.5);
    expect(aspectAfter(2, 180)).toBe(2);
  });
});

describe('reduce', () => {
  const ids = (xs: readonly PhotoItem[]) => xs.map((i) => `${i.id}:${i.status}`);
  const base = [item({ id: 'a' }), item({ id: 'b', fingerprint: 'b' })];
  it('walks an item from queued to done', () => {
    let s = reduce(base, { type: 'reading', id: 'a' });
    s = reduce(s, { type: 'processing', id: 'a', progress: 0.5 });
    expect(s[0]).toMatchObject({ status: 'processing', progress: 0.5 });
    s = reduce(s, { type: 'processed', id: 'a', output: out, previewUrl: 'blob:1' });
    expect(s[0]).toMatchObject({ status: 'ready', previewUrl: 'blob:1' });
    s = reduce(s, { type: 'upload', id: 'a' });
    s = reduce(s, { type: 'progress', id: 'a', value: 2 });
    expect(s[0]?.progress).toBe(1);
    s = reduce(s, { type: 'resolved', id: 'a', result: { url: 'u' } });
    expect(s[0]).toMatchObject({ status: 'done', result: { url: 'u' }, progress: 1 });
  });
  it('adds, removes and edits', () => {
    expect(reduce(base, { type: 'add', items: [item({ id: 'c' })] })).toHaveLength(3);
    expect(ids(reduce(base, { type: 'remove', id: 'a' }))).toEqual(['b:queued']);
    expect(reduce(base, { type: 'alt', id: 'a', alt: 'a hill' })[0]?.alt).toBe('a hill');
    const withOut = [item({ id: 'a', status: 'ready', output: out })];
    expect(reduce(withOut, { type: 'alt', id: 'a', alt: 'x' })[0]?.output?.alt).toBe('x');
    expect(reduce(base, { type: 'crop', id: 'a', crop: { rect: null, quarter: 90 } })[0]?.crop.quarter).toBe(90);
  });
  it('ignores illegal transitions and unknown ids', () => {
    expect(reduce(base, { type: 'upload', id: 'a' })).toBe(base);
    expect(reduce(base, { type: 'resolved', id: 'a', result: 1 })).toBe(base);
    expect(reduce(base, { type: 'progress', id: 'a', value: 0.5 })).toBe(base);
    expect(reduce(base, { type: 'failed', id: 'a', error: { code: 'upload-failed', retryable: true } })).toBe(base);
    expect(reduce(base, { type: 'retry', id: 'a' })).toBe(base);
    expect(reduce(base, { type: 'reading', id: 'zzz' })).toBe(base);
    expect(reduce([item({ status: 'done' })], { type: 'reading', id: 'a' })[0]?.status).toBe('done');
    expect(reduce([item({ status: 'done' })], { type: 'processing', id: 'a' })[0]?.status).toBe('done');
    expect(reduce([item({ status: 'done' })], { type: 'processed', id: 'a', output: out, previewUrl: null })[0]?.status).toBe('done');
    expect(reduce([item({ status: 'done' })], { type: 'cancel', id: 'a' })[0]?.status).toBe('done');
  });
  it('ignores a late resolve, progress or failure for a canceled item', () => {
    const c = reduce([item({ status: 'uploading', output: out })], { type: 'cancel', id: 'a' });
    expect(c[0]).toMatchObject({ status: 'canceled', error: { code: 'canceled' } });
    expect(reduce(c, { type: 'resolved', id: 'a', result: 1 })).toBe(c);
    expect(reduce(c, { type: 'progress', id: 'a', value: 0.9 })).toBe(c);
    expect(reduce(c, { type: 'failed', id: 'a', error: { code: 'upload-failed', retryable: true } })).toBe(c);
    expect(reduce(c, { type: 'cancel', id: 'a' })).toBe(c);
    expect(reduce(c, { type: 'alt', id: 'a', alt: 'late' })).toBe(c);
    expect(reduce(c, { type: 'crop', id: 'a', crop: { rect: null, quarter: 90 } })).toBe(c);
  });
  it('fails and retries: the retry counts, and reuses the output when there is one', () => {
    const up = [item({ status: 'uploading', output: out })];
    const failed = reduce(up, { type: 'failed', id: 'a', error: { code: 'upload-failed', retryable: true } });
    expect(failed[0]).toMatchObject({ status: 'error', attempt: 0 });
    expect(reduce(failed, { type: 'retry', id: 'a' })[0]).toMatchObject({ status: 'ready', attempt: 1, error: null });
    const early = reduce([item({ status: 'processing' })], { type: 'failed', id: 'a', error: { code: 'encode-failed', retryable: true } });
    expect(reduce(early, { type: 'retry', id: 'a' })[0]).toMatchObject({ status: 'queued', attempt: 1 });
    expect(reduce([item({ status: 'error' })], { type: 'retry', id: 'a' })).toHaveLength(1);
  });
  it('starts uploads within the concurrency, never offline, never in manual until released', () => {
    const ready = ['a', 'b', 'c', 'd'].map((id) => item({ id, status: 'ready', output: out }));
    const o = { concurrency: 2, online: true, manual: false, released: false };
    expect(nextToUpload(ready, o)).toEqual(['a', 'b']);
    expect(nextToUpload([item({ id: 'u', status: 'uploading' }), ...ready], o)).toEqual(['a']);
    expect(nextToUpload([item({ id: 'u1', status: 'uploading' }), item({ id: 'u2', status: 'uploading' }), ...ready], o)).toEqual([]);
    expect(nextToUpload(ready, { ...o, online: false })).toEqual([]);
    expect(nextToUpload(ready, { ...o, manual: true })).toEqual([]);
    expect(nextToUpload(ready, { ...o, manual: true, released: true })).toEqual(['a', 'b']);
  });
  it('knows which statuses are still live', () => {
    const live: PhotoStatus[] = ['queued', 'reading', 'processing', 'ready', 'uploading', 'error'];
    for (const s of live) expect(isLive(s)).toBe(true);
    expect(isLive('done')).toBe(false);
    expect(isLive('canceled')).toBe(false);
  });
});

describe('retries', () => {
  it('waits 1 s, 2 s, 4 s with up to 25% jitter, and the same for the same random', () => {
    expect(retryDelay(0, () => 0)).toBe(1000);
    expect(retryDelay(1, () => 0)).toBe(2000);
    expect(retryDelay(2, () => 0)).toBe(4000);
    expect(retryDelay(0, () => 1)).toBe(1250);
    expect(retryDelay(2, () => 0.5)).toBe(4500);
    expect(retryDelay(-3, () => 9)).toBe(1250);
    expect(retryDelay(1, () => 0.3)).toBe(retryDelay(1, () => 0.3));
  });
  it('retries only what said it is retryable, and only up to `retries`', () => {
    const yes = { code: 'upload-failed' as const, retryable: true };
    expect(shouldAutoRetry(yes, 0, 2)).toBe(true);
    expect(shouldAutoRetry(yes, 1, 2)).toBe(true);
    expect(shouldAutoRetry(yes, 2, 2)).toBe(false);
    expect(shouldAutoRetry({ ...yes, retryable: false }, 0, 2)).toBe(false);
    expect(shouldAutoRetry({ code: 'encode-failed', retryable: true }, 0, 2)).toBe(false);
    expect(new PhotoUploadError('x', { retryable: true }).options.retryable).toBe(true);
  });
});

describe('words', () => {
  it('formats sizes', () => {
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5.4 * 1024 * 1024)).toBe('5.4 MB');
  });
  const ctx = { online: true, wasOnline: true };
  it('says nothing on the first render', () => {
    expect(announcements(null, [item()], ctx)).toEqual([]);
  });
  it('announces additions, an upload finishing, a failure and going offline, once each', () => {
    const a = item({ id: 'a', status: 'uploading' });
    expect(announcements([], [a, item({ id: 'b' })], ctx)).toEqual(['2 photos added']);
    expect(announcements([], [a], ctx)).toEqual(['1 photo added']);
    expect(announcements([a], [{ ...a, status: 'done' }, item({ id: 'b' })], ctx)).toEqual(['1 photo added', 'Photo 1 of 2 uploaded']);
    const err = { ...a, status: 'error' as const, error: { code: 'upload-failed' as const, retryable: true } };
    expect(announcements([a], [err], ctx)).toEqual(['Photo 1 failed: the connection dropped. Try again is available']);
    expect(announcements([a], [err], { ...ctx, text: { 'upload-failed': 'the server said no' } })).toEqual([
      'Photo 1 failed: the server said no. Try again is available',
    ]);
    expect(announcements([a], [a], { online: false, wasOnline: true })).toEqual(['Waiting for a connection']);
    expect(announcements([a], [a], { online: false, wasOnline: false })).toEqual([]);
  });
  it('does not announce progress, only a change of status', () => {
    const a = item({ id: 'a', status: 'uploading', progress: 0.1 });
    expect(announcements([a], [{ ...a, progress: 0.9 }], ctx)).toEqual([]);
    expect(announcements([a], [{ ...a, status: 'error', error: null }], ctx)).toEqual([]);
  });
});

describe('unusual and damaged files', () => {
  const dec = (b: Uint8Array) => new TextDecoder('latin1').decode(b);
  it('refuses a JPEG that does not start like one, and one with no size', () => {
    expect(readHeader(Uint8Array.from([1, 2, 3]), 'image/jpeg')).toBeNull();
    expect(readHeader(Uint8Array.from([0xff, 0xd8, 0x00, 0x00, 0x00, 0x00]), 'image/jpeg')).toBeNull();
  });
  it('skips fill bytes, restart markers and stand-alone markers between segments', () => {
    const base = jpeg();
    const at = 2;
    const padded = Uint8Array.from([...base.slice(0, at), 0xff, 0xff, 0xd0, 0xff, 0x01, ...base.slice(at)]);
    expect(readHeader(padded, 'image/jpeg')).toMatchObject({ width: 800, height: 600 });
  });
  it('keeps what it read when the file is cut short after the size', () => {
    const base = jpeg({ exif: true });
    const sof = Array.from(base).findIndex((b, i) => b === 0xff && base[i + 1] === 0xc0);
    const withTail = (tail: number[]) => Uint8Array.from([...base.slice(0, sof + 13), ...tail]);
    expect(readHeader(withTail([0x00, 0x00, 0x00, 0x00]), 'image/jpeg')).toMatchObject({ width: 800, height: 600 });
    expect(readHeader(withTail([0xff, 0xe0, 0xff, 0xff, 0x00]), 'image/jpeg')).toMatchObject({ width: 800, height: 600 });
  });
  it('refuses a PNG with no header chunk and stops at a chunk that runs past the end', () => {
    const bad = png();
    bad[12] = 0x58;
    expect(readHeader(bad, 'image/png')).toBeNull();
    const whole = png({ text: true });
    const idat = Array.from(whole).findIndex((_, i) => dec(whole.slice(i, i + 4)) === 'IDAT') - 4;
    whole.set([0x7f, 0xff, 0xff, 0xff], idat); // a chunk that claims more bytes than the file has
    expect(readHeader(whole, 'image/png')).toMatchObject({ width: 800, height: 600, metadata: ['text'] });
    expect(readHeader(png({ exif: true }), 'image/png')?.metadata).toEqual(['exif']);
  });
  it('names thumbnails and GPS in PNG and WebP too, and plain iTXt as text', () => {
    expect(readHeader(png({ exif: true, gps: true, thumbnail: true }), 'image/png')?.metadata).toEqual(['exif', 'gps', 'thumbnail']);
    expect(readHeader(png({ itxtPlain: true }), 'image/png')?.metadata).toEqual(['text']);
    expect(readHeader(webp({ exif: true, gps: true, thumbnail: true }), 'image/webp')?.metadata).toEqual(['exif', 'gps', 'thumbnail']);
  });
  it('reads an EXIF chunk with no prefix, an ALPH chunk, and a bare RIFF with no VP8X', () => {
    expect(readHeader(webp({ exifBare: true }), 'image/webp')?.metadata).toEqual(['exif']);
    expect(readHeader(webp({ alph: true }), 'image/webp')?.hasAlpha).toBe(true); // the VP8X flag says no, the ALPH chunk says yes
    const bare = readHeader(webp({ noVp8x: true, alph: true, exif: true }), 'image/webp');
    expect(bare).toMatchObject({ width: 800, height: 600, hasAlpha: true, metadata: ['exif'] });
  });
  it('strips a bare RIFF whose EXIF chunk has no VP8X to correct', () => {
    const src = webp({ noVp8x: true, exif: true });
    const { bytes, removed } = stripMetadata(src, 'image/webp');
    expect(removed).toEqual(['exif']);
    expect(leftovers(bytes)).toEqual([]);
  });
  it('reads a damaged TIFF: an IFD offset inside the header, or one that runs off the end', () => {
    const tiff = (ifd: number, count: number) => [...Array.from('MM', (c) => c.charCodeAt(0)), 0, 0x2a, 0, 0, 0, ifd, 0, count];
    const wrap = (t: number[]) => {
      const payload = [...Array.from('Exif\0\0', (c) => c.charCodeAt(0)), ...t];
      const len = payload.length + 2;
      return Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...payload, 0xff, 0xc0, 0, 11, 8, 0, 2, 0, 2, 1, 1, 0x11, 0]);
    };
    expect(readHeader(wrap(tiff(2, 1)), 'image/jpeg')?.metadata).toEqual(['exif']);
    expect(readHeader(wrap(tiff(8, 0)), 'image/jpeg')?.metadata).toEqual(['exif']);
  });
});

describe('reduce details', () => {
  it('keeps progress when none is given, and the old preview when there is no new one', () => {
    const a = item({ id: 'a', status: 'processing', progress: 0.4, previewUrl: 'blob:old' });
    expect(reduce([a], { type: 'processing', id: 'a' })[0]?.progress).toBe(0.4);
    expect(reduce([a], { type: 'processed', id: 'a', output: out, previewUrl: null })[0]?.previewUrl).toBe('blob:old');
  });
});
