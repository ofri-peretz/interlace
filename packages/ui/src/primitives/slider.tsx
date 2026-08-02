'use client';

/**
 * @interlace/ui — Slider
 *
 * Range / value-picker primitive on top of @base-ui/react/slider. Compositional
 * API: Slider.Root + Track + Indicator + Thumb. Re-exports the DS-styled
 * surface (rail, fill, thumb) without owning state — Base UI handles keyboard
 * (Arrow / Home / End / PageUp / PageDown), drag, focus-visible, and ARIA.
 *
 * ## Anatomy
 *
 *   Slider (Root)                    (div — data-min-viewport=320)
 *     ├─ SliderControl              (the rail track wrapper — flex row)
 *     │   ├─ SliderTrack            (the rail)
 *     │   │   └─ SliderIndicator    (the filled portion)
 *     │   └─ SliderThumb            (the draggable knob — repeats for range)
 *     └─ {value readout}             (consumer-supplied, optional)
 *
 * ## MIN_VIEWPORT — 320
 *
 * ## Target size (SC 2.5.8, AA)
 *
 * The painted knob is 20×20 CSS px; a transparent `before:` pseudo-element
 * extends the hit area to 24×24 without changing the visual, so the
 * primitive is usable by touch on every phone.
 *
 * ## Contrast (verified by token math)
 *
 * | Composite                                     | Light  | Dark    | Floor           |
 * | --------------------------------------------- | ------ | ------- | --------------- |
 * | rail `bg-input` on `--background`             | 3.62:1 | 3.35:1  | 3:1 (SC 1.4.11) |
 * | knob `border-primary` on `--background`       | 8.80:1 | 11.79:1 | 3:1 (SC 1.4.11) |
 * | fill `bg-primary` on the rail                 | 2.43:1 | 3.52:1  | see below       |
 * | `focus-visible:ring-ring` on `--background`   | 8.80:1 | 11.79:1 | 3:1 (SC 2.4.13) |
 *
 * The rail used to be `bg-muted` — 1.07:1 on `--background`, an invisible
 * track. `--input` fixes that, but note the fill/rail row: in LIGHT mode
 * those two cannot both clear 3:1. The rail needs L ≥ 0.308 to sit 3:1
 * from `--primary` (L 0.069), and any rail that dark measures ≤2.93:1
 * against a white page. The two constraints are mutually exclusive for
 * this brand orange — no rail value satisfies both.
 *
 * Resolved the way WCAG's own Understanding note for sliders does: the
 * KNOB is the state indicator that carries SC 1.4.11 (8.80:1 / 11.79:1
 * against the page in both modes), and the fill is supplementary
 * reinforcement. Do not "fix" the fill/rail row by lightening the rail —
 * that reintroduces the invisible-track failure, which is the worse one.
 *
 * `disabled:opacity-50` is exempt (inactive component).
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | Each wrapper extends `React.ComponentProps<typeof BaseSlider.X>` |
 * | R6   | data-slot on every part          | slider / -control / -track / -indicator / -thumb            |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R8   | No isXxx; enums for variants     | n/a — no variants yet                                       |
 * | R12  | Reuse over wrap                  | Wraps Base UI's slider — no bespoke drag/keyboard state    |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline style; Tailwind classes only                    |
 * | R19  | Tokens only                      | bg-primary, bg-muted, border-border — semantic tokens       |
 * | R25  | Client component                 | Required — Base UI Slider ships client hooks                |
 * | R26  | A11y from upstream               | Base UI owns role=slider, aria-valuenow, keyboard           |
 */

import * as React from 'react';
import { Slider as BaseSlider } from '@base-ui/react/slider';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

const Slider = React.forwardRef<
  React.ElementRef<typeof BaseSlider.Root>,
  React.ComponentProps<typeof BaseSlider.Root>
>(({ className, ...props }, ref) => (
  <BaseSlider.Root
    ref={ref}
    data-slot="slider"
    data-min-viewport={String(MIN_VIEWPORT)}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  />
));
Slider.displayName = 'Slider';

const SliderControl = React.forwardRef<
  React.ElementRef<typeof BaseSlider.Control>,
  React.ComponentProps<typeof BaseSlider.Control>
>(({ className, ...props }, ref) => (
  <BaseSlider.Control
    ref={ref}
    data-slot="slider-control"
    className={cn('relative flex w-full items-center', className)}
    {...props}
  />
));
SliderControl.displayName = 'SliderControl';

const SliderTrack = React.forwardRef<
  React.ElementRef<typeof BaseSlider.Track>,
  React.ComponentProps<typeof BaseSlider.Track>
>(({ className, ...props }, ref) => (
  <BaseSlider.Track
    ref={ref}
    data-slot="slider-track"
    // bg-input, not bg-muted: the unfilled rail is what identifies the
    // slider's extent, so SC 1.4.11 applies. `--muted` measured 1.07:1 on
    // `--background` — the rail was invisible. `--input` is the DS's
    // 3:1-cleared control-boundary token (3.62 light / 3.35 dark).
    className={cn('bg-input relative h-2 w-full grow overflow-hidden rounded-full', className)}
    {...props}
  />
));
SliderTrack.displayName = 'SliderTrack';

const SliderIndicator = React.forwardRef<
  React.ElementRef<typeof BaseSlider.Indicator>,
  React.ComponentProps<typeof BaseSlider.Indicator>
>(({ className, ...props }, ref) => (
  <BaseSlider.Indicator
    ref={ref}
    data-slot="slider-indicator"
    className={cn('bg-primary absolute h-full', className)}
    {...props}
  />
));
SliderIndicator.displayName = 'SliderIndicator';

const SliderThumb = React.forwardRef<
  React.ElementRef<typeof BaseSlider.Thumb>,
  React.ComponentProps<typeof BaseSlider.Thumb>
>(({ className, ...props }, ref) => (
  <BaseSlider.Thumb
    ref={ref}
    data-slot="slider-thumb"
    className={cn(
      'border-primary bg-background block size-5 rounded-full border-2 shadow-sm transition-colors',
      // Full-opacity ring (8.80:1 light / 11.79:1 dark on --background) —
      // already well past the 3:1 focus floor, so no /60 alpha needed here.
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      // SC 2.5.8 — transparent 24×24 hit area around the 20px knob.
      "relative before:absolute before:-inset-[2px] before:content-['']",
      className,
    )}
    {...props}
  />
));
SliderThumb.displayName = 'SliderThumb';

/* ─────────────────────────────────────────────────────────────────
 * SimpleSlider — convenience composition.
 *
 * Renders Root → Control → Track → Indicator → Thumb(s) with a single
 * `label` prop that auto-derives thumb aria-labels:
 *   - single thumb:  `getAriaLabel = () => label`
 *   - range (2):     `getAriaLabel = (i) => i === 0 ? `${label} minimum` : `${label} maximum``
 *
 * Use this when you don't need per-part className overrides. Drops to
 * about 90% of slider call-sites; the compositional API stays for the
 * remaining 10% that need per-part customisation.
 * ──────────────────────────────────────────────────────────────── */
interface SimpleSliderProps
  extends Omit<React.ComponentProps<typeof BaseSlider.Root>, 'defaultValue'> {
  /** Accessible label propagated to every thumb's aria-label. Required. */
  label: string;
  /**
   * Initial value. Number for single-thumb, [min, max] tuple for range
   * (renders 2 thumbs labelled `${label} minimum` / `${label} maximum`).
   */
  defaultValue?: number | [number, number];
}

function SimpleSlider({
  label,
  defaultValue = 0,
  className,
  ...props
}: SimpleSliderProps) {
  const isRange = Array.isArray(defaultValue);
  const thumbs = isRange ? 2 : 1;
  const getAriaLabel = (i: number) =>
    isRange ? `${label} ${i === 0 ? 'minimum' : 'maximum'}` : label;
  const rootValue = Array.isArray(defaultValue) ? defaultValue : [defaultValue];

  return (
    <Slider
      defaultValue={rootValue}
      aria-label={label}
      className={className}
      {...props}
    >
      <SliderControl>
        <SliderTrack>
          <SliderIndicator />
        </SliderTrack>
        {Array.from({ length: thumbs }).map((_, i) => (
          <SliderThumb key={i} getAriaLabel={() => getAriaLabel(i)} />
        ))}
      </SliderControl>
    </Slider>
  );
}

export {
  Slider,
  SliderControl,
  SliderTrack,
  SliderIndicator,
  SliderThumb,
  SimpleSlider,
};
export type { SimpleSliderProps };
