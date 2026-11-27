/**
 * What PhotoUpload promises about privacy, proved against bytes: for every fixture that carries
 * location, camera, time, caption or an embedded preview, the file that leaves has none of it.
 * The scanner that checks is written in the fixtures file, not taken from the code it checks, so
 * the two cannot share a bug.
 */
import { describe, expect, it } from 'vitest';

import { readHeader, sniffImage, stripMetadata, type MetadataKind } from '../src/patterns/photo-upload-model.js';
import { jpeg, leftovers, png, webp, type JpegOptions, type PngOptions, type WebpOptions } from './fixtures/photo-fixtures.js';

const FULL_JPEG: JpegOptions = { exif: true, gps: true, thumbnail: true, xmp: true, iptc: true, comment: true, icc: true, orientation: 1 };
const FULL_PNG: PngOptions = { exif: true, gps: true, thumbnail: true, text: true, itxt: true, time: true, icc: true };
const FULL_WEBP: WebpOptions = { exif: true, gps: true, thumbnail: true, xmp: true, icc: true };

const CASES: [string, Uint8Array, MetadataKind[]][] = [
  ['jpeg with everything', jpeg(FULL_JPEG), ['exif', 'gps', 'thumbnail', 'xmp', 'iptc', 'text']],
  ['jpeg with Exif only', jpeg({ exif: true }), ['exif']],
  ['jpeg with Exif and a location', jpeg({ exif: true, gps: true }), ['exif', 'gps']],
  ['jpeg with XMP only', jpeg({ xmp: true }), ['xmp']],
  ['jpeg with a caption only', jpeg({ iptc: true }), ['iptc']],
  ['jpeg with a comment only', jpeg({ comment: true }), ['text']],
  ['png with everything', png(FULL_PNG), ['exif', 'gps', 'thumbnail', 'xmp', 'text']],
  ['png with text and a time', png({ text: true, time: true }), ['text']],
  ['webp with everything', webp(FULL_WEBP), ['exif', 'gps', 'thumbnail', 'xmp']],
  ['webp with XMP only', webp({ xmp: true }), ['xmp']],
];

describe('the metadata strip, against an independent scanner', () => {
  for (const [name, bytes, kinds] of CASES) {
    it(`${name}: nothing is left, and exactly what was there is reported`, () => {
      expect(leftovers(bytes), 'the fixture must carry something to remove').not.toEqual([]);
      const { bytes: clean, removed } = stripMetadata(bytes, sniffImage(bytes)!);
      expect(leftovers(clean)).toEqual([]);
      expect(removed).toEqual(kinds);
      const header = readHeader(clean, sniffImage(clean)!);
      expect(header?.metadata).toEqual([]);
      expect(header).toMatchObject({ width: 800, height: 600 });
    });
  }

  it('claims GPS only when a location was in the file', () => {
    expect(stripMetadata(jpeg({ exif: true }), 'image/jpeg').removed).not.toContain('gps');
    expect(stripMetadata(jpeg({ exif: true, gps: true }), 'image/jpeg').removed).toContain('gps');
  });

  it('removes the location text itself, not only the marker that points to it', () => {
    const { bytes } = stripMetadata(jpeg({ exif: true, gps: true }), 'image/jpeg');
    expect(new TextDecoder('latin1').decode(bytes)).not.toMatch(/51\.5007|0\.1246|TestCam/);
  });

  it('reports nothing for a clean file, and leaves it byte for byte', () => {
    for (const clean of [jpeg({ icc: true }), png({ icc: true }), webp({ icc: true })]) {
      const out = stripMetadata(clean, sniffImage(clean)!);
      expect(out.removed).toEqual([]);
      expect(out.bytes).toBe(clean);
    }
  });
});
