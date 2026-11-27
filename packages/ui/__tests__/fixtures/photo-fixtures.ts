/**
 * Hand-built image bytes for the PhotoUpload tests: no real person's photo, nothing
 * decodable (the scan data is a few bytes), each well under 2 KB. Every fixture can
 * carry the metadata the privacy tests look for, so the check has something to find.
 */
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const be16 = (n: number) => [(n >> 8) & 255, n & 255];
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const le24 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];

/** The visible text carried inside the Exif block, so a scanner has a location to find. */
export const GPS_TEXT = 'GPS 51.5007N 0.1246W';

/** A little-endian-free (big-endian, `MM`) Exif TIFF block. */
export function exifBlock(o: { orientation?: number; gps?: boolean; thumbnail?: boolean }): number[] {
  const entries: number[][] = [];
  const text = ascii(`${GPS_TEXT}\0`);
  // IFD0: ImageDescription (0x010E) with the location text, Make, Orientation, optional GPS pointer.
  const make = ascii('TestCam\0');
  const entryCount = 3 + (o.gps ? 1 : 0);
  const ifd0Size = 2 + entryCount * 12 + 4;
  const dataStart = 8 + ifd0Size;
  entries.push([...be16(0x010e), ...be16(2), ...be32(text.length), ...be32(dataStart)]);
  entries.push([...be16(0x010f), ...be16(2), ...be32(make.length), ...be32(dataStart + text.length)]);
  entries.push([...be16(0x0112), ...be16(3), ...be32(1), ...be16(o.orientation ?? 1), 0, 0]);
  let gpsAt = dataStart + text.length + make.length;
  if (o.gps) entries.push([...be16(0x8825), ...be16(4), ...be32(1), ...be32(gpsAt)]);
  const gpsIfd = o.gps ? [...be16(1), ...be16(1), ...be16(2), ...be32(2), ...ascii('N\0\0\0'), ...be32(0)] : [];
  const ifd1At = gpsAt + gpsIfd.length;
  const next = o.thumbnail ? ifd1At : 0;
  const ifd1 = o.thumbnail ? [...be16(1), ...be16(0x0201), ...be16(4), ...be32(1), ...be32(0), ...be32(0)] : [];
  return [
    ...ascii('MM'),
    ...be16(0x2a),
    ...be32(8),
    ...be16(entryCount),
    ...entries.flat(),
    ...be32(next),
    ...text,
    ...make,
    ...gpsIfd,
    ...ifd1,
  ];
}

const segment = (marker: number, payload: number[]) => [0xff, marker, ...be16(payload.length + 2), ...payload];

export interface JpegOptions {
  width?: number;
  height?: number;
  orientation?: number;
  exif?: boolean;
  gps?: boolean;
  thumbnail?: boolean;
  xmp?: boolean;
  iptc?: boolean;
  comment?: boolean;
  icc?: boolean;
  /** Extra picture bytes, so a re-encode can be smaller than the original. */
  pad?: number;
}

export function jpeg(o: JpegOptions = {}): Uint8Array {
  const out: number[] = [0xff, 0xd8, ...segment(0xe0, [...ascii('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0])];
  if (o.exif || o.gps || o.thumbnail || o.orientation) {
    out.push(...segment(0xe1, [...ascii('Exif\0\0'), ...exifBlock(o)]));
  }
  if (o.xmp) out.push(...segment(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/\0'), ...ascii('<x:xmpmeta>owner</x:xmpmeta>')]));
  if (o.iptc) out.push(...segment(0xed, [...ascii('Photoshop 3.0\0'), ...ascii('8BIM caption')]));
  if (o.comment) out.push(...segment(0xfe, ascii('shot on a phone')));
  if (o.icc) out.push(...segment(0xe2, [...ascii('ICC_PROFILE\0'), 1, 1, ...ascii('profile')]));
  out.push(...segment(0xc0, [8, ...be16(o.height ?? 600), ...be16(o.width ?? 800), 1, 1, 0x11, 0]));
  out.push(...segment(0xda, [1, 1, 0, 0, 63, 0]), 1, 2, 3, 4, ...Array.from({ length: o.pad ?? 0 }, () => 7), 0xff, 0xd9);
  return Uint8Array.from(out);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes: number[]) => {
  let c = 0xffffffff;
  for (const b of bytes) c = (crcTable[(c ^ b) & 255] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: number[]) => [...be32(data.length), ...ascii(type), ...data, ...be32(crc32([...ascii(type), ...data]))];

export interface PngOptions {
  width?: number;
  height?: number;
  alpha?: boolean;
  exif?: boolean;
  gps?: boolean;
  thumbnail?: boolean;
  text?: boolean;
  itxt?: boolean;
  /** An iTXt chunk that is not XMP. */
  itxtPlain?: boolean;
  time?: boolean;
  icc?: boolean;
  trns?: boolean;
}

export function png(o: PngOptions = {}): Uint8Array {
  const ihdr = [...be32(o.width ?? 800), ...be32(o.height ?? 600), 8, o.alpha ? 6 : o.trns ? 3 : 2, 0, 0, 0];
  const out: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', ihdr)];
  if (o.icc) out.push(...chunk('iCCP', [...ascii('sRGB\0'), 0, 1, 2]));
  if (o.exif || o.gps || o.thumbnail) out.push(...chunk('eXIf', exifBlock({ gps: o.gps, thumbnail: o.thumbnail })));
  if (o.text) out.push(...chunk('tEXt', [...ascii('Author\0'), ...ascii('the owner')]));
  if (o.itxt) out.push(...chunk('iTXt', [...ascii('XML:com.adobe.xmp\0'), 0, 0, 0, 0, ...ascii('<x:xmpmeta/>')]));
  if (o.itxtPlain) out.push(...chunk('iTXt', [...ascii('Comment\0'), 0, 0, 0, 0, ...ascii('hello')]));
  if (o.time) out.push(...chunk('tIME', [0x07, 0xea, 11, 26, 9, 30, 0]));
  if (o.trns) out.push(...chunk('tRNS', [0]));
  out.push(...chunk('IDAT', [1, 2, 3, 4]), ...chunk('IEND', []));
  return Uint8Array.from(out);
}

export interface WebpOptions {
  width?: number;
  height?: number;
  alpha?: boolean;
  /** An ALPH chunk beside a lossy VP8 frame. */
  alph?: boolean;
  /** An EXIF chunk without the `Exif\0\0` prefix. */
  exifBare?: boolean;
  /** No VP8X chunk: a bare RIFF with an EXIF chunk. */
  noVp8x?: boolean;
  thumbnail?: boolean;
  exif?: boolean;
  gps?: boolean;
  xmp?: boolean;
  icc?: boolean;
  lossless?: boolean;
}

export function webp(o: WebpOptions = {}): Uint8Array {
  const pad = (d: number[]) => (d.length % 2 ? [...d, 0] : d);
  const c = (type: string, d: number[]) => [...ascii(type), ...le32(d.length), ...pad(d)];
  const w = o.width ?? 800;
  const h = o.height ?? 600;
  const flags = (o.alpha ? 0x10 : 0) | (o.icc ? 0x20 : 0) | (o.exif || o.gps || o.exifBare ? 0x08 : 0) | (o.xmp ? 0x04 : 0);
  const body: number[] = [
    ...(o.noVp8x ? [] : c('VP8X', [flags, 0, 0, 0, ...le24(w - 1), ...le24(h - 1)])),
    ...(o.icc ? c('ICCP', ascii('profile')) : []),
    ...(o.alph ? c('ALPH', [0, 1, 2]) : []),
    ...(o.exif || o.gps || o.thumbnail ? c('EXIF', [...ascii('Exif\0\0'), ...exifBlock({ gps: o.gps, thumbnail: o.thumbnail })]) : []),
    ...(o.exifBare ? c('EXIF', exifBlock({ gps: o.gps })) : []),
    ...(o.xmp ? c('XMP ', ascii('<x:xmpmeta>owner</x:xmpmeta>')) : []),
    ...(o.lossless
      ? c('VP8L', [0x2f, ...le32((w - 1) | ((h - 1) << 14))])
      : c('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, w & 255, (w >> 8) & 63, h & 255, (h >> 8) & 63, 0, 0])),
  ];
  return Uint8Array.from([...ascii('RIFF'), ...le32(body.length + 4), ...ascii('WEBP'), ...body]);
}

/** What `FileReader` or `arrayBuffer` hands back, as a File. */
const TYPE_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
export const fileOf = (
  bytes: Uint8Array,
  name: string,
  type = TYPE_BY_EXT[name.split('.').pop() ?? ''] ?? '',
  lastModified = 1,
) => new File([bytes as BlobPart], name, { type, lastModified });

/**
 * The independent scanner: written here, not taken from the code it checks, so the two
 * cannot share a bug. Returns every marker still present in `bytes`.
 */
export function leftovers(bytes: Uint8Array): string[] {
  const text = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  const markers: [string, string][] = [
    ['Exif\0\0', 'exif header'],
    ['http://ns.adobe.com/xap', 'xmp'],
    ['GPS', 'gps text'],
    ['eXIf', 'png exif'],
    ['tEXt', 'png text'],
    ['zTXt', 'png text'],
    ['iTXt', 'png text'],
    ['tIME', 'png time'],
    ['EXIF', 'webp exif'],
    ['XMP ', 'webp xmp'],
    ['TestCam', 'camera make'],
    ['\xff\xe1', 'jpeg APP1'],
    ['\xff\xed', 'jpeg APP13'],
    ['\xff\xfe', 'jpeg COM'],
  ];
  return markers.filter(([m]) => text.includes(m)).map(([, name]) => name);
}
