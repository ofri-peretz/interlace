'use client';

/**
 * @interlace/ui — PhotoCropper
 *
 * The crop and turn dialog PhotoUpload opens for one photo. Lazy-loaded, so a
 * form that never crops never loads it. Everything pointer-only has a keyboard
 * twin: drag the frame or press the arrows (Shift for ten times as far),
 * zoom with the range or `+` / `-`, turn a quarter with `[` / `]` or the two
 * buttons, Enter applies, Escape cancels. Arrow keys are physical: Left moves
 * the frame left, in right-to-left layouts too.
 *
 * The frame is a rectangle in fractions of the picture as shown, so it does
 * not depend on the preview's pixel size. `shape="round"` masks the preview
 * only: the saved crop is the whole rectangle.
 */
import * as React from 'react';
import { RotateCcwIcon, RotateCwIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../primitives/dialog.js';
import {
  aspectAfter,
  initialCrop,
  panRect,
  rotateQuarter,
  zoomRect,
  type CropRect,
  type PhotoItem,
  type Quarter,
} from './photo-upload-model.js';

interface PhotoCropperProps {
  item: PhotoItem;
  /** Pixel aspect (width / height) of the saved crop; null for the whole picture. */
  aspect: number | null;
  shape: 'rect' | 'round';
  labels?: {
    title?: string;
    zoom?: string;
    rotateLeft?: string;
    rotateRight?: string;
    apply?: string;
    cancel?: string;
  };
  onApply: (crop: { rect: CropRect | null; quarter: Quarter }) => void;
  onCancel: () => void;
}

const MAX_ZOOM = 4;

export default function PhotoCropper({ item, aspect, shape, labels, onApply, onCancel }: PhotoCropperProps) {
  const w = item.source.width ?? item.output?.width ?? 1;
  const h = item.source.height ?? item.output?.height ?? 1;
  const [quarter, setQuarter] = React.useState<Quarter>(item.crop.quarter);
  const imageAspect = aspectAfter(w / h, quarter);
  const [rect, setRect] = React.useState<CropRect>(() => item.crop.rect ?? initialCrop(aspect, aspectAfter(w / h, item.crop.quarter)));
  const [zoom, setZoom] = React.useState(1);
  const stage = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ x: number; y: number; rect: CropRect } | null>(null);
  const words = {
    title: labels?.title ?? 'Crop photo',
    zoom: labels?.zoom ?? 'Zoom',
    rotateLeft: labels?.rotateLeft ?? 'Turn left',
    rotateRight: labels?.rotateRight ?? 'Turn right',
    apply: labels?.apply ?? 'Apply',
    cancel: labels?.cancel ?? 'Cancel',
  };

  React.useEffect(() => {
    frame.current?.focus();
  }, []);

  const turn = (dir: 1 | -1) => {
    const next = rotateQuarter(quarter, dir);
    setQuarter(next);
    setRect(initialCrop(aspect, aspectAfter(w / h, next)));
    setZoom(1);
  };
  const zoomTo = (z: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(1, z));
    setRect((r) => zoomRect(r, clamped / zoom));
    setZoom(clamped);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const move = (dx: number, dy: number) => {
      e.preventDefault();
      setRect((r) => panRect(r, dx, dy));
    };
    if (e.key === 'ArrowLeft') move(-step, 0);
    else if (e.key === 'ArrowRight') move(step, 0);
    else if (e.key === 'ArrowUp') move(0, -step);
    else if (e.key === 'ArrowDown') move(0, step);
    else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomTo(zoom + 0.25);
    } else if (e.key === '-') {
      e.preventDefault();
      zoomTo(zoom - 0.25);
    } else if (e.key === '[') {
      e.preventDefault();
      turn(-1);
    } else if (e.key === ']') {
      e.preventDefault();
      turn(1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onApply({ rect, quarter });
    }
  };

  const turnedBox = quarter === 90 || quarter === 270;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent data-slot="photo-cropper" onKeyDown={(e) => e.target === e.currentTarget && onKeyDown(e)}>
        <DialogHeader>
          <DialogTitle>{words.title}</DialogTitle>
          <DialogDescription>{item.name}</DialogDescription>
        </DialogHeader>
        <div
          ref={stage}
          className="bg-muted relative mx-auto w-full max-w-prose select-none overflow-hidden rounded-lg"
          style={{ aspectRatio: String(imageAspect) }}
        >
          {item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt=""
              draggable={false}
              className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
              style={{
                width: turnedBox ? `${100 / imageAspect}%` : '100%',
                height: turnedBox ? `${100 * imageAspect}%` : '100%',
                transform: `translate(-50%, -50%) rotate(${quarter}deg)`,
              }}
            />
          ) : null}
          <div
            ref={frame}
            role="application"
            aria-label={`${words.title}: arrow keys move, plus and minus zoom, brackets turn, Enter applies`}
            tabIndex={0}
            data-slot="photo-cropper-frame"
            onKeyDown={onKeyDown}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, rect };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              const box = stage.current?.getBoundingClientRect();
              if (!d || !box) return;
              setRect(panRect(d.rect, (e.clientX - d.x) / box.width, (e.clientY - d.y) / box.height));
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            className={cn(
              'border-primary focus-visible:ring-ring absolute cursor-move touch-none border-2 focus-visible:ring-2 focus-visible:outline-none forced-colors:border-[Highlight]',
              shape === 'round' && 'rounded-full',
            )}
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="icon" onClick={() => turn(-1)} aria-label={words.rotateLeft}>
            <RotateCcwIcon aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => turn(1)} aria-label={words.rotateRight}>
            <RotateCwIcon aria-hidden="true" />
          </Button>
          <label className="flex flex-1 items-center gap-2 text-sm">
            {words.zoom}
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.05}
              value={zoom}
              onChange={(e) => zoomTo(Number(e.target.value))}
              className="flex-1"
            />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {words.cancel}
          </Button>
          <Button type="button" onClick={() => onApply({ rect, quarter })}>
            {words.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
