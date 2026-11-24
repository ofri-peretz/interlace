/**
 * @interlace/ui — QrCode
 *
 * A QR code for a link or a short text, drawn as one SVG path from the pure
 * encoder in `qr-model.ts`. No dependency, no canvas, no image request: it
 * renders on the server and stays sharp at any size, from a phone card to a
 * projector.
 *
 * ## Anatomy
 *
 *   QrCode                         (div — data-slot="qr-code", data-scheme)
 *     └─ svg role="img"            (data-slot="qr-code-svg", named by `label`)
 *         ├─ rect                  (quiet zone, the background token)
 *         └─ path                  (dark modules, the foreground token)
 *
 * ## Contrast
 *
 * Phone cameras read dark modules on a light ground most reliably, so the
 * code keeps the light scheme on a dark page (`scheme="light"`, the default)
 * through `data-scheme`, and the brand's own light background and
 * foreground tokens draw it. `scheme="inherit"` follows the page instead.
 * The four-module quiet zone is part of the code; leave `margin` at 4 unless
 * the code sits on a plain light surface already.
 *
 * ## Server first
 *
 * No hooks: the matrix is computed while rendering.
 *
 * ## Too long
 *
 * A QR code holds at most 2,953 bytes (version 40, level L), fewer at higher
 * error correction. A longer `value` does not throw: the box keeps its size
 * and label, carries `data-state="too-long"`, and draws no code. Keep links
 * short; a join link is well under 100 bytes.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                         |
 * | ---- | ------------------------- | ------------------------------------------ |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`              |
 * | R6   | data-slot per part        | qr-code / -svg                              |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`          |
 * | R8   | Enums, not booleans       | `size`, `scheme`, `errorCorrection`        |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const       |
 * | R19  | Tokens only               | background, foreground                     |
 * | R26  | A11y                      | role="img" named by `label`                 |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { encodeQr, qrPath, type QrErrorCorrection } from './qr-model.js';

export const MIN_VIEWPORT = 320 as const;

const SIZE = {
  sm: 'w-24',
  default: 'w-40',
  lg: 'w-56',
  /** Fills its container: for a big screen, size the parent. */
  fill: 'w-full',
} as const;

type QrCodeProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** What the code holds, usually a join link. Too long to encode renders an empty box (see "Too long"). */
  value: string;
  /** Names the code for assistive tech, e.g. "QR code to join the room". */
  label: string;
  /** @default 'default' */
  size?: keyof typeof SIZE;
  /** @default 'M' */
  errorCorrection?: QrErrorCorrection;
  /** Quiet zone, in modules. @default 4 */
  margin?: number;
  /** Keep the light scheme on a dark page, so every camera reads it. @default 'light' */
  scheme?: 'light' | 'inherit';
};

function QrCode({
  value,
  label,
  size = 'default',
  errorCorrection = 'M',
  margin = 4,
  scheme = 'light',
  className,
  ...props
}: QrCodeProps) {
  let matrix: ReturnType<typeof encodeQr> | null = null;
  try {
    matrix = encodeQr(value, { errorCorrection });
  } catch {
    matrix = null;
  }
  const m = Math.max(0, Math.round(margin));
  const side = (matrix?.size ?? 21) + m * 2;
  return (
    <div
      data-slot="qr-code"
      data-state={matrix ? undefined : 'too-long'}
      data-scheme={scheme === 'light' ? 'light' : undefined}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('bg-background text-foreground inline-block max-w-full shrink-0 rounded-lg', SIZE[size], className)}
      {...props}
    >
      <svg
        data-slot="qr-code-svg"
        role="img"
        aria-label={label}
        viewBox={`0 0 ${side} ${side}`}
        shapeRendering="crispEdges"
        className="block h-auto w-full"
      >
        <rect width={side} height={side} className="fill-background" />
        {matrix && <path d={qrPath(matrix, m)} className="fill-current" />}
      </svg>
    </div>
  );
}
QrCode.displayName = 'QrCode';

export { QrCode };
export type { QrCodeProps };
