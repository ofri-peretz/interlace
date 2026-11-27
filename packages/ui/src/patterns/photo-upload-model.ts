/**
 * @interlace/ui — PhotoUpload model
 *
 * Everything PhotoUpload decides, with no DOM, no React and no clock: what a
 * file is (by its bytes, never its name), what it says about its owner and
 * how to remove that, whether it needs resizing, the crop maths, the item
 * reducer, the retry delay and what a screen reader is told. The component
 * and the browser runtime only carry out what this file plans.
 *
 * Metadata is removed byte for byte (JPEG APP1 Exif/XMP, APP13 IPTC, COM;
 * PNG eXIf, tEXt, zTXt, iTXt, tIME; WebP EXIF, XMP). Colour profiles stay, so
 * colour does not shift.
 */

export type PhotoMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
export type PhotoStatus =
  | 'queued'
  | 'reading'
  | 'processing'
  | 'ready'
  | 'uploading'
  | 'done'
  | 'error'
  | 'canceled';
export type MetadataKind = 'exif' | 'gps' | 'xmp' | 'iptc' | 'text' | 'thumbnail';
export type Quarter = 0 | 90 | 180 | 270;
/** Fractions (0..1) of the image as shown: oriented, then turned by `quarter`. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type PhotoErrorCode =
  | 'type-not-allowed'
  | 'too-many'
  | 'file-too-large'
  | 'too-many-pixels'
  | 'duplicate'
  | 'decode-failed'
  | 'unsupported-format'
  | 'encode-failed'
  | 'upload-failed'
  | 'canceled';
export interface PhotoError {
  code: PhotoErrorCode;
  retryable: boolean;
  detail?: string;
}
export interface ProcessedPhoto {
  blob: Blob;
  type: PhotoMime;
  width: number;
  height: number;
  bytes: number;
  /** What was found and removed. Empty when the file had none. */
  metadataRemoved: readonly MetadataKind[];
  alt: string;
}
export interface PhotoItem {
  id: string;
  name: string;
  status: PhotoStatus;
  progress: number;
  attempt: number;
  source: { bytes: number; type: string; width: number | null; height: number | null };
  output: ProcessedPhoto | null;
  previewUrl: string | null;
  alt: string;
  crop: { rect: CropRect | null; quarter: Quarter };
  error: PhotoError | null;
  result: unknown;
  /** name + size + lastModified, the duplicate key. */
  fingerprint: string;
}
export interface EncodePlan {
  /** Output size in pixels. */
  width: number;
  height: number;
  /** EXIF orientation 1..8 of the source. */
  orientation: number;
  quarter: Quarter;
  crop: CropRect | null;
  type: 'image/jpeg' | 'image/png' | 'image/webp';
  quality: number;
}

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

/** Throw this from `onUpload` to say what happened. Any other error is shown as `upload-failed` and is not retried by itself. */
export class PhotoUploadError extends Error {
  readonly options: { retryable: boolean; code?: 'network' | 'server' | 'rejected' | 'auth' };
  constructor(message: string, options: { retryable: boolean; code?: 'network' | 'server' | 'rejected' | 'auth' }) {
    super(message);
    this.name = 'PhotoUploadError';
    this.options = options;
  }
}

export const DEFAULT_ACCEPT: readonly PhotoMime[] = ['image/jpeg', 'image/png', 'image/webp'];
export const HEAD_BYTES = 256 * 1024;

/* ------------------------------------------------------------------ sniff */

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0) =>
  b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, at: number, len: number) => {
  let s = '';
  for (let i = at; i < Math.min(at + len, b.length); i++) s += String.fromCharCode(b[i] as number);
  return s;
};

/** The image type a file really is, from its first bytes; null for anything else (SVG, GIF, empty). */
export function sniffImage(b: Uint8Array): PhotoMime | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image/webp';
  if (ascii(b, 4, 4) === 'ftyp' && /avi[fs]/.test(ascii(b, 8, 24))) return 'image/avif';
  return null;
}

/* ------------------------------------------------------------------- scan */

interface Segment {
  /** Byte range [start, end) in the file. */
  start: number;
  end: number;
  /** Kinds this segment holds; empty for a segment we keep. */
  kinds: MetadataKind[];
  drop: boolean;
}
interface Scan {
  width: number | null;
  height: number | null;
  orientation: number;
  hasAlpha: boolean;
  segments: Segment[];
  /** Where the image data begins, for JPEG. */
  tail: number;
}

const u16 = (b: Uint8Array, at: number, little = false) =>
  little ? (b[at] as number) | ((b[at + 1] as number) << 8) : ((b[at] as number) << 8) | (b[at + 1] as number);
const u32 = (b: Uint8Array, at: number, little = false) =>
  little
    ? ((b[at] as number) | ((b[at + 1] as number) << 8) | ((b[at + 2] as number) << 16) | ((b[at + 3] as number) << 24)) >>> 0
    : (((b[at] as number) << 24) | ((b[at + 1] as number) << 16) | ((b[at + 2] as number) << 8) | (b[at + 3] as number)) >>> 0;

/** What an Exif block (a TIFF structure) holds: orientation, GPS, and an IFD1 thumbnail. */
function readTiff(b: Uint8Array, base: number, end: number) {
  const out = { orientation: 1, gps: false, thumbnail: false };
  if (end - base < 8) return out;
  const order = ascii(b, base, 2);
  if (order !== 'II' && order !== 'MM') return out;
  const little = order === 'II';
  const ifd0 = u32(b, base + 4, little);
  const walk = (offset: number, first: boolean): number => {
    const at = base + offset;
    if (offset < 8 || at + 2 > end) return 0;
    const n = u16(b, at, little);
    for (let i = 0; i < n && at + 2 + (i + 1) * 12 <= end; i++) {
      const e = at + 2 + i * 12;
      const tag = u16(b, e, little);
      if (first && tag === 0x0112) out.orientation = u16(b, e + 8, little);
      if (first && tag === 0x8825) out.gps = true;
    }
    const next = at + 2 + n * 12;
    return next + 4 <= end ? u32(b, next, little) : 0;
  };
  const next = walk(ifd0, true);
  if (next) {
    out.thumbnail = true;
    walk(next, false);
  }
  if (out.orientation < 1 || out.orientation > 8) out.orientation = 1;
  return out;
}

function scanJpeg(b: Uint8Array): Scan | null {
  if (!startsWith(b, [0xff, 0xd8])) return null;
  const scan: Scan = { width: null, height: null, orientation: 1, hasAlpha: false, segments: [], tail: b.length };
  let at = 2;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return scan.width === null ? null : scan;
    const marker = b[at + 1] as number;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === 0xda) {
      scan.tail = at;
      break;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      at += 2;
      continue;
    }
    const len = u16(b, at + 2);
    if (len < 2 || at + 2 + len > b.length) return scan.width === null ? null : scan;
    const start = at;
    const end = at + 2 + len;
    const kinds: MetadataKind[] = [];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      scan.height = u16(b, at + 5);
      scan.width = u16(b, at + 7);
    } else if (marker === 0xe1 && ascii(b, at + 4, 6) === 'Exif\0\0') {
      const t = readTiff(b, at + 10, end);
      scan.orientation = t.orientation;
      kinds.push('exif');
      if (t.gps) kinds.push('gps');
      if (t.thumbnail) kinds.push('thumbnail');
    } else if (marker === 0xe1 && ascii(b, at + 4, 28).startsWith('http://ns.adobe.com/xap/1.0/')) {
      kinds.push('xmp');
    } else if (marker === 0xed) {
      kinds.push('iptc');
    } else if (marker === 0xfe) {
      kinds.push('text');
    }
    scan.segments.push({ start, end, kinds, drop: kinds.length > 0 });
    at = end;
  }
  return scan.width === null ? null : scan;
}

function scanPng(b: Uint8Array): Scan | null {
  if (!startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) || b.length < 33) return null;
  if (ascii(b, 12, 4) !== 'IHDR') return null;
  const colour = b[25] as number;
  const scan: Scan = {
    width: u32(b, 16),
    height: u32(b, 20),
    orientation: 1,
    hasAlpha: colour === 4 || colour === 6,
    segments: [],
    tail: b.length,
  };
  let at = 8;
  while (at + 12 <= b.length) {
    const len = u32(b, at);
    const type = ascii(b, at + 4, 4);
    const end = at + 12 + len;
    if (end > b.length) break;
    const kinds: MetadataKind[] = [];
    if (type === 'tRNS') scan.hasAlpha = true;
    if (type === 'eXIf') {
      const t = readTiff(b, at + 8, at + 8 + len);
      scan.orientation = t.orientation;
      kinds.push('exif');
      if (t.gps) kinds.push('gps');
      if (t.thumbnail) kinds.push('thumbnail');
    } else if (type === 'tEXt' || type === 'zTXt' || type === 'tIME') kinds.push('text');
    else if (type === 'iTXt') kinds.push(ascii(b, at + 8, 17) === 'XML:com.adobe.xmp' ? 'xmp' : 'text');
    scan.segments.push({ start: at, end, kinds, drop: kinds.length > 0 });
    at = end;
    if (type === 'IEND') break;
  }
  return scan;
}

function scanWebp(b: Uint8Array): Scan | null {
  if (ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null;
  const scan: Scan = { width: null, height: null, orientation: 1, hasAlpha: false, segments: [], tail: b.length };
  let at = 12;
  while (at + 8 <= b.length) {
    const type = ascii(b, at, 4);
    const len = u32(b, at + 4, true);
    const data = at + 8;
    const end = data + len + (len % 2);
    const kinds: MetadataKind[] = [];
    if (type === 'VP8X' && data + 10 <= b.length) {
      scan.hasAlpha = ((b[data] as number) & 0x10) !== 0;
      scan.width = 1 + ((b[data + 4] as number) | ((b[data + 5] as number) << 8) | ((b[data + 6] as number) << 16));
      scan.height = 1 + ((b[data + 7] as number) | ((b[data + 8] as number) << 8) | ((b[data + 9] as number) << 16));
    } else if (type === 'VP8 ' && scan.width === null && data + 10 <= b.length && startsWith(b, [0x9d, 0x01, 0x2a], data + 3)) {
      scan.width = u16(b, data + 6, true) & 0x3fff;
      scan.height = u16(b, data + 8, true) & 0x3fff;
    } else if (type === 'VP8L' && scan.width === null && data + 5 <= b.length && b[data] === 0x2f) {
      const bits = u32(b, data + 1, true);
      scan.width = (bits & 0x3fff) + 1;
      scan.height = ((bits >>> 14) & 0x3fff) + 1;
      scan.hasAlpha = ((bits >>> 28) & 1) === 1;
    } else if (type === 'EXIF') {
      const skip = ascii(b, data, 6) === 'Exif\0\0' ? 6 : 0;
      const t = readTiff(b, data + skip, Math.min(data + len, b.length));
      scan.orientation = t.orientation;
      kinds.push('exif');
      if (t.gps) kinds.push('gps');
      if (t.thumbnail) kinds.push('thumbnail');
    } else if (type === 'XMP ') kinds.push('xmp');
    else if (type === 'ALPH') scan.hasAlpha = true;
    scan.segments.push({ start: at, end: Math.min(end, b.length), kinds, drop: kinds.length > 0 });
    at = end;
  }
  return scan.width === null ? null : scan;
}

function scanOf(b: Uint8Array, type: PhotoMime): Scan | null {
  if (type === 'image/jpeg') return scanJpeg(b);
  if (type === 'image/png') return scanPng(b);
  if (type === 'image/webp') return scanWebp(b);
  return null;
}

export interface PhotoHeader {
  type: PhotoMime;
  width: number | null;
  height: number | null;
  /** EXIF orientation 1..8 (1 when absent). */
  orientation: number;
  hasAlpha: boolean;
  metadata: readonly MetadataKind[];
}

const KIND_ORDER: readonly MetadataKind[] = ['exif', 'gps', 'thumbnail', 'xmp', 'iptc', 'text'];
const kindsOf = (scan: Scan): MetadataKind[] => {
  const present = new Set(scan.segments.flatMap((s) => s.kinds));
  return KIND_ORDER.filter((k) => present.has(k));
};

/** Width, height, orientation, alpha and the metadata kinds a file carries; null when the header cannot be read. */
export function readHeader(b: Uint8Array, type: PhotoMime): PhotoHeader | null {
  if (type === 'image/avif') return { type, width: null, height: null, orientation: 1, hasAlpha: false, metadata: [] };
  const scan = scanOf(b, type);
  if (!scan) return null;
  return {
    type,
    width: scan.width,
    height: scan.height,
    orientation: scan.orientation,
    hasAlpha: scan.hasAlpha,
    metadata: kindsOf(scan),
  };
}

const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** The same image with its metadata segments cut out. A file with none comes back unchanged. */
export function stripMetadata(b: Uint8Array, type: PhotoMime): { bytes: Uint8Array; removed: MetadataKind[] } {
  const scan = scanOf(b, type);
  if (!scan) return { bytes: b, removed: [] };
  const removed = kindsOf(scan);
  const drops = scan.segments.filter((s) => s.drop);
  if (drops.length === 0) return { bytes: b, removed: [] };
  const parts: Uint8Array[] = [];
  let at = 0;
  for (const d of drops) {
    parts.push(b.subarray(at, d.start));
    at = d.end;
  }
  parts.push(b.subarray(at));
  const out = concat(parts);
  if (type === 'image/webp') {
    const size = out.length - 8;
    out[4] = size & 0xff;
    out[5] = (size >>> 8) & 0xff;
    out[6] = (size >>> 16) & 0xff;
    out[7] = (size >>> 24) & 0xff;
    if (ascii(out, 12, 4) === 'VP8X') out[20] = (out[20] as number) & ~0x0c; // EXIF and XMP flags
  }
  return { bytes: out, removed };
}

/* ------------------------------------------------------------------- plan */

export interface PhotoProcessing {
  maxEdge?: number;
  quality?: number;
  type?: 'auto' | 'image/jpeg' | 'image/webp';
  targetBytes?: number;
  minQuality?: number;
}
export const PROCESSING_DEFAULTS = { maxEdge: 2048, quality: 0.82, minQuality: 0.5 } as const;

export type ProcessingPlan = { kind: 'strip-only' } | ({ kind: 'reencode' } & EncodePlan);

const swaps = (orientation: number) => orientation >= 5 && orientation <= 8;

/** The size of the oriented source, before any crop. */
export function orientedSize(header: Pick<PhotoHeader, 'width' | 'height' | 'orientation'>) {
  const w = header.width ?? 0;
  const h = header.height ?? 0;
  return swaps(header.orientation) ? { width: h, height: w } : { width: w, height: h };
}

/** Strip the bytes when the file already fits; otherwise resize, orient, crop and encode. */
export function planProcessing(
  header: PhotoHeader,
  processing: PhotoProcessing | false | undefined,
  crop: { rect: CropRect | null; quarter: Quarter } = { rect: null, quarter: 0 },
): ProcessingPlan {
  const opts = processing === false ? null : { ...PROCESSING_DEFAULTS, ...processing };
  const base = orientedSize(header);
  const cropped = crop.rect !== null || crop.quarter !== 0;
  const needsOrient = header.orientation !== 1;
  // The crop rectangle lives in the image as the person sees it: oriented, then turned.
  const turned = crop.quarter === 90 || crop.quarter === 270;
  const src = turned ? { width: base.height, height: base.width } : base;
  const w = crop.rect ? Math.max(1, Math.round(src.width * crop.rect.width)) : src.width;
  const h = crop.rect ? Math.max(1, Math.round(src.height * crop.rect.height)) : src.height;
  const maxEdge = opts?.maxEdge ?? Infinity;
  const scale = Math.min(1, maxEdge / Math.max(w, h, 1));
  const convert = processing !== false && processing?.type && processing.type !== 'auto';
  const unknownSize = header.width === null; // AVIF: the bytes cannot be stripped here, so the pixels are redrawn
  if (!cropped && !needsOrient && scale === 1 && !convert && !unknownSize) return { kind: 'strip-only' };
  const wanted = processing === false ? 'auto' : (processing?.type ?? 'auto');
  const type: EncodePlan['type'] =
    wanted !== 'auto'
      ? header.hasAlpha && wanted === 'image/jpeg'
        ? 'image/png'
        : wanted
      : header.type === 'image/png'
        ? 'image/png'
        : header.type === 'image/jpeg'
          ? 'image/jpeg'
          : 'image/webp';
  return {
    kind: 'reencode',
    width: unknownSize ? 0 : Math.max(1, Math.round(w * scale)),
    height: unknownSize ? 0 : Math.max(1, Math.round(h * scale)),
    orientation: header.orientation,
    quarter: crop.quarter,
    crop: crop.rect,
    type,
    quality: opts?.quality ?? PROCESSING_DEFAULTS.quality,
  };
}

/** Qualities to try, at most three, never below `minQuality`, for a `targetBytes` goal. */
export function qualityLadder(processing: PhotoProcessing | false | undefined): number[] {
  const o = processing === false ? undefined : processing;
  const start = o?.quality ?? PROCESSING_DEFAULTS.quality;
  const floor = o?.minQuality ?? PROCESSING_DEFAULTS.minQuality;
  if (!o?.targetBytes) return [start];
  const ladder = [start, start - (start - floor) / 2, floor].map((q) => Math.round(Math.max(floor, q) * 100) / 100);
  return [...new Set(ladder)];
}

/* ----------------------------------------------------------------- intake */

export interface IntakeFile {
  name: string;
  size: number;
  lastModified: number;
  /** The first HEAD_BYTES bytes. */
  head: Uint8Array;
}
export interface IntakeOptions {
  accept: readonly PhotoMime[];
  maxFiles: number;
  maxFileBytes: number;
  maxPixels: number;
}
export interface Intake {
  accepted: { index: number; type: PhotoMime; header: PhotoHeader; fingerprint: string }[];
  rejected: { index: number; name: string; error: PhotoError }[];
}

export const fingerprintOf = (f: Pick<IntakeFile, 'name' | 'size' | 'lastModified'>) =>
  `${f.name}:${f.size}:${f.lastModified}`;

/** Decide, file by file, what becomes an item. One bad file never rejects the batch. */
export function planIntake(files: readonly IntakeFile[], existing: readonly PhotoItem[], opts: IntakeOptions): Intake {
  const out: Intake = { accepted: [], rejected: [] };
  const live = existing.filter((i) => i.status !== 'canceled' && i.status !== 'error');
  const seen = new Set(existing.filter((i) => i.status !== 'canceled').map((i) => i.fingerprint));
  let count = live.length;
  files.forEach((f, index) => {
    const reject = (code: PhotoErrorCode, detail?: string) =>
      out.rejected.push({ index, name: f.name, error: { code, retryable: false, detail } });
    const type = sniffImage(f.head);
    if (!type || !opts.accept.includes(type)) return reject('type-not-allowed');
    if (count >= opts.maxFiles) return reject('too-many');
    if (f.size > opts.maxFileBytes) return reject('file-too-large');
    const header = readHeader(f.head, type);
    if (!header) return reject('decode-failed');
    if (header.width !== null && header.height !== null && header.width * header.height > opts.maxPixels)
      return reject('too-many-pixels');
    const fingerprint = fingerprintOf(f);
    if (seen.has(fingerprint)) return reject('duplicate');
    seen.add(fingerprint);
    count += 1;
    out.accepted.push({ index, type, header, fingerprint });
  });
  return out;
}

/* ------------------------------------------------------------------- crop */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Keep a rectangle inside 0..1 with a size that cannot vanish. */
const MIN_CROP = 0.05;
export function clampRect(r: CropRect, minSize = MIN_CROP): CropRect {
  const width = clamp(r.width, minSize, 1);
  const height = clamp(r.height, minSize, 1);
  return { x: clamp(r.x, 0, 1 - width), y: clamp(r.y, 0, 1 - height), width, height };
}

/**
 * The largest centred rectangle with the pixel aspect `aspect` (width / height)
 * inside an image of `imageAspect`; the whole image when `aspect` is null.
 */
export function initialCrop(aspect: number | null, imageAspect: number): CropRect {
  if (!aspect || !Number.isFinite(aspect) || !Number.isFinite(imageAspect) || imageAspect <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  const width = aspect < imageAspect ? aspect / imageAspect : 1;
  const height = aspect < imageAspect ? 1 : imageAspect / aspect;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

export const panRect = (r: CropRect, dx: number, dy: number): CropRect => clampRect({ ...r, x: r.x + dx, y: r.y + dy }, 0);

/** Scale about the centre; `factor` > 1 zooms in. The aspect of the rectangle is kept, and it stays inside the image. */
export function zoomRect(r: CropRect, factor: number): CropRect {
  const smallest = Math.min(r.width, r.height);
  const k = clamp(1 / clamp(factor, 0.1, 10), MIN_CROP / smallest, Math.min(1 / r.width, 1 / r.height));
  const width = r.width * k;
  const height = r.height * k;
  return clampRect({ x: r.x + (r.width - width) / 2, y: r.y + (r.height - height) / 2, width, height }, 0);
}

export const rotateQuarter = (q: Quarter, dir: 1 | -1): Quarter => ((q + (dir === 1 ? 90 : 270)) % 360) as Quarter;

/** The image aspect after a quarter turn. */
export const aspectAfter = (imageAspect: number, q: Quarter) => (q === 90 || q === 270 ? 1 / imageAspect : imageAspect);

/* ---------------------------------------------------------------- reducer */

export type PhotoAction =
  | { type: 'add'; items: readonly PhotoItem[] }
  | { type: 'reading'; id: string }
  | { type: 'processing'; id: string; progress?: number }
  | { type: 'processed'; id: string; output: ProcessedPhoto; previewUrl: string | null }
  | { type: 'upload'; id: string }
  | { type: 'progress'; id: string; value: number }
  | { type: 'resolved'; id: string; result: unknown }
  | { type: 'failed'; id: string; error: PhotoError }
  | { type: 'retry'; id: string }
  | { type: 'cancel'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'alt'; id: string; alt: string }
  | { type: 'crop'; id: string; crop: PhotoItem['crop'] };

const LIVE: readonly PhotoStatus[] = ['queued', 'reading', 'processing', 'ready', 'uploading', 'error'];

/** The next state of the list. An action for an item that is gone or canceled changes nothing. */
export function reduce(items: readonly PhotoItem[], action: PhotoAction): readonly PhotoItem[] {
  if (action.type === 'add') return [...items, ...action.items];
  if (action.type === 'remove') return items.filter((i) => i.id !== action.id);
  const index = items.findIndex((i) => i.id === action.id);
  const item = items[index];
  if (!item) return items;
  const set = (patch: Partial<PhotoItem>) => items.map((i, n) => (n === index ? { ...i, ...patch } : i));
  if (action.type === 'cancel') {
    return item.status === 'done' || item.status === 'canceled'
      ? items
      : set({ status: 'canceled', progress: 0, error: { code: 'canceled', retryable: false } });
  }
  if (item.status === 'canceled') return items;
  switch (action.type) {
    case 'alt':
      return set({ alt: action.alt, output: item.output ? { ...item.output, alt: action.alt } : null });
    case 'crop':
      return set({ crop: action.crop });
    case 'reading':
      return item.status === 'queued' ? set({ status: 'reading', progress: 0 }) : items;
    case 'processing':
      return item.status === 'queued' || item.status === 'reading' || item.status === 'processing'
        ? set({ status: 'processing', progress: action.progress ?? item.progress })
        : items;
    case 'processed':
      return item.status === 'processing' || item.status === 'reading' || item.status === 'queued'
        ? set({
            status: 'ready',
            progress: 0,
            output: { ...action.output, alt: item.alt },
            previewUrl: action.previewUrl ?? item.previewUrl,
            error: null,
          })
        : items;
    case 'upload':
      return item.status === 'ready' ? set({ status: 'uploading', progress: 0, error: null }) : items;
    case 'progress':
      return item.status === 'uploading' || item.status === 'processing'
        ? set({ progress: clamp(action.value, 0, 1) })
        : items;
    case 'resolved':
      return item.status === 'uploading' ? set({ status: 'done', progress: 1, result: action.result, error: null }) : items;
    case 'failed':
      return item.status === 'uploading' || item.status === 'processing' || item.status === 'reading'
        ? set({ status: 'error', progress: 0, error: action.error })
        : items;
    default: {
      // retry
      if (item.status !== 'error' || !item.error) return items;
      const back: PhotoStatus = item.output ? 'ready' : 'queued';
      return set({ status: back, progress: 0, attempt: item.attempt + 1, error: null });
    }
  }
}

/** Ready items to start now: free slots only, none while offline, none in `manual` until released. */
export function nextToUpload(
  items: readonly PhotoItem[],
  opts: { concurrency: number; online: boolean; manual: boolean; released: boolean },
): string[] {
  if (!opts.online || (opts.manual && !opts.released)) return [];
  const busy = items.filter((i) => i.status === 'uploading').length;
  return items
    .filter((i) => i.status === 'ready')
    .slice(0, Math.max(0, opts.concurrency - busy))
    .map((i) => i.id);
}

export const isLive = (status: PhotoStatus) => LIVE.includes(status);

/** 1 s, 2 s, 4 s ... with up to 25% jitter. `random` is injected, so a test can pin it. */
export function retryDelay(attempt: number, random: () => number): number {
  return Math.round(1000 * 2 ** Math.max(0, attempt) * (1 + 0.25 * clamp(random(), 0, 1)));
}

/** Only an upload that said it is retryable is retried, and only up to `retries` times. */
export const shouldAutoRetry = (error: PhotoError, attempt: number, retries: number) =>
  error.code === 'upload-failed' && error.retryable && attempt < retries;

/* ---------------------------------------------------------------- words */

const KB = 1024;
export function formatBytes(n: number): string {
  if (n < KB) return `${n} B`;
  if (n < KB * KB) return `${Math.round(n / KB)} KB`;
  return `${(n / KB / KB).toFixed(1)} MB`;
}

export const DEFAULT_ERROR_TEXT: Record<PhotoErrorCode, string> = {
  'type-not-allowed': 'not a photo we can take',
  'too-many': 'too many photos',
  'file-too-large': 'the file is too large',
  'too-many-pixels': 'the picture is too large',
  duplicate: 'already added',
  'decode-failed': 'the photo could not be read',
  'unsupported-format': 'this browser cannot open that format',
  'encode-failed': 'the photo could not be prepared',
  'upload-failed': 'the connection dropped',
  canceled: 'canceled',
};

export interface AnnounceContext {
  online: boolean;
  wasOnline: boolean;
  text?: Partial<Record<PhotoErrorCode, string>>;
}

/** What a screen reader hears for a change of state. Nothing on the first render; no per-percent text. */
export function announcements(
  prev: readonly PhotoItem[] | null,
  next: readonly PhotoItem[],
  ctx: AnnounceContext,
): string[] {
  if (prev === null) return [];
  const out: string[] = [];
  const before = new Map(prev.map((i) => [i.id, i]));
  const added = next.filter((i) => !before.has(i.id)).length;
  if (added > 0) out.push(`${added} photo${added === 1 ? '' : 's'} added`);
  next.forEach((item, index) => {
    const old = before.get(item.id);
    if (!old || old.status === item.status) return;
    if (item.status === 'done') out.push(`Photo ${index + 1} of ${next.length} uploaded`);
    if (item.status === 'error' && item.error) {
      const why = ctx.text?.[item.error.code] ?? DEFAULT_ERROR_TEXT[item.error.code];
      out.push(`Photo ${index + 1} failed: ${why}. Try again is available`);
    }
  });
  if (!ctx.online && ctx.wasOnline) out.push('Waiting for a connection');
  return out;
}
