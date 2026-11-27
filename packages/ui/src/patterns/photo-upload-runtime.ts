/**
 * @interlace/ui — PhotoUpload runtime
 *
 * The only file that touches the browser's image APIs. `ImageRuntime` is the
 * seam: the component and its tests talk to the type, so a test substitutes a
 * fake, an agent a headless one, an app a HEIC decoder or a worker.
 *
 * A canvas redraw carries no metadata by construction, which is why every
 * re-encoded photo leaves with none. Nothing here makes a network request.
 */
import type { CropRect, EncodePlan, Quarter } from './photo-upload-model.js';

/** A decoded picture, opaque to everyone but the runtime that made it. */
export interface DecodedImage {
  /** Pixels of the image as shown: already oriented. */
  width: number;
  height: number;
  /** The runtime's own handle (an `ImageBitmap` in the browser). */
  handle: unknown;
}

export interface ImageRuntime {
  /** Reads and orients a picture. Resolves null when this browser cannot decode the type. */
  decode(
    blob: Blob,
    opts: { maxEdge: number; signal: AbortSignal; hint?: { width: number; height: number } },
  ): Promise<DecodedImage | null>;
  /** Draws the oriented, turned, cropped, resized image and encodes it. */
  encode(img: DecodedImage, plan: EncodePlan, signal: AbortSignal): Promise<Blob>;
  /** A small preview, longest edge `edge`. */
  thumbnail(img: DecodedImage, edge: number): Promise<Blob>;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  /** Release the decoded pixels. */
  dispose?(img: DecodedImage): void;
}

type Canvas2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
interface Surface {
  ctx: Canvas2D;
  toBlob(type: string, quality: number): Promise<Blob>;
}

function surface(width: number, height: number): Surface {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx) return { ctx, toBlob: (type, quality) => canvas.convertToBlob({ type, quality }) };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d canvas');
  return {
    ctx,
    toBlob: (type, quality) =>
      new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality),
      ),
  };
}

const bitmapOf = (img: DecodedImage) => img.handle as ImageBitmap;
const turned = (q: Quarter) => q === 90 || q === 270;

/** The image turned by `quarter`, on its own surface (the bitmap itself when it is not turned). */
function rotated(img: DecodedImage, quarter: Quarter): { source: CanvasImageSource; width: number; height: number } {
  if (quarter === 0) return { source: bitmapOf(img), width: img.width, height: img.height };
  const w = turned(quarter) ? img.height : img.width;
  const h = turned(quarter) ? img.width : img.height;
  const s = surface(w, h);
  s.ctx.translate(w / 2, h / 2);
  s.ctx.rotate((quarter * Math.PI) / 180);
  s.ctx.drawImage(bitmapOf(img), -img.width / 2, -img.height / 2);
  // `surface` hides the canvas; draw it back through a bitmap-free path.
  return { source: (s.ctx.canvas as CanvasImageSource), width: w, height: h };
}

function draw(img: DecodedImage, quarter: Quarter, crop: CropRect | null, width: number, height: number, flatten: boolean) {
  const s = surface(width, height);
  if (flatten) {
    s.ctx.fillStyle = '#fff';
    s.ctx.fillRect(0, 0, width, height);
  }
  const r = rotated(img, quarter);
  const c = crop ?? { x: 0, y: 0, width: 1, height: 1 };
  s.ctx.drawImage(r.source, c.x * r.width, c.y * r.height, c.width * r.width, c.height * r.height, 0, 0, width, height);
  return s;
}

export const browserRuntime: ImageRuntime = {
  async decode(blob, { maxEdge, signal, hint }) {
    if (typeof createImageBitmap !== 'function') return null;
    try {
      const scale = hint ? Math.min(1, maxEdge / Math.max(hint.width, hint.height, 1)) : 1;
      const options: ImageBitmapOptions = { imageOrientation: 'from-image' };
      if (hint && scale < 1) {
        options.resizeWidth = Math.max(1, Math.round(hint.width * scale));
        options.resizeHeight = Math.max(1, Math.round(hint.height * scale));
        options.resizeQuality = 'high';
      }
      const bitmap = await createImageBitmap(blob, options);
      if (signal.aborted) {
        bitmap.close();
        return null;
      }
      return { width: bitmap.width, height: bitmap.height, handle: bitmap };
    } catch {
      return null;
    }
  },
  async encode(img, plan, signal) {
    const width = plan.width || img.width;
    const height = plan.height || img.height;
    const s = draw(img, plan.quarter, plan.crop, width, height, plan.type === 'image/jpeg');
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    return s.toBlob(plan.type, plan.quality);
  },
  async thumbnail(img, edge) {
    const k = Math.min(1, edge / Math.max(img.width, img.height, 1));
    const s = draw(img, 0, null, Math.max(1, Math.round(img.width * k)), Math.max(1, Math.round(img.height * k)), true);
    return s.toBlob('image/jpeg', 0.7);
  },
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
  dispose(img) {
    (img.handle as ImageBitmap | undefined)?.close?.();
  },
};
