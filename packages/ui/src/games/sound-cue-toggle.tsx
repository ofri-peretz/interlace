'use client';

/**
 * @interlace/ui — SoundCueToggle
 *
 * The switch for a room's sound cues, and the words for them. Sound is off until a person turns it
 * on (a browser keeps a page silent until a tap, and a hall should not start making noise on its
 * own). Every cue that plays is also written as a plain phrase beside the switch ("Answer
 * revealed"), announced politely, so a person who cannot hear it still knows it happened.
 *
 * ## Anatomy
 *
 *   SoundCueToggle                   (div — data-slot="sound-cue-toggle", data-state=on|off|unsupported)
 *     ├─ label                       (data-slot="sound-cue-label": the switch and its name)
 *     │    └─ Switch                 (role="switch", Space toggles)
 *     └─ p aria-live                 (data-slot="sound-cue-caption": the last cue in words)
 *
 * Wire it with `useSoundCues`: `<SoundCueToggle {...cues.toggleProps} />`.
 *
 * ## Motion
 *
 * None. A cue is sound, and the caption changes in place.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                              |
 * | ---- | ------------------------- | ----------------------------------------------- |
 * | R4   | Extends native el         | `div` props                                     |
 * | R6   | data-slot per part        | sound-cue-toggle / -label / -caption            |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`               |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const            |
 * | R26  | A11y                      | a named switch; cues written out, announced     |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Switch } from '../primitives/switch.js';

export const MIN_VIEWPORT = 320 as const;

type SoundCueToggleProps = Omit<React.ComponentProps<'div'>, 'children' | 'onChange'> & {
  enabled: boolean;
  /** False where the browser has no audio: the switch is disabled and says so. @default true */
  supported?: boolean;
  onChange: (on: boolean) => void;
  /** The last cue in words; it is announced when it changes. */
  caption?: string;
  labels?: {
    /** @default 'Sound cues' */
    name?: string;
    /** @default 'This browser cannot play sound.' */
    unsupported?: string;
  };
};

function SoundCueToggle({ enabled, supported = true, onChange, caption = '', labels, className, ...props }: SoundCueToggleProps) {
  return (
    <div
      data-slot="sound-cue-toggle"
      data-state={!supported ? 'unsupported' : enabled ? 'on' : 'off'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-1', className)}
      {...props}
    >
      <label data-slot="sound-cue-label" className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <Switch checked={enabled && supported} disabled={!supported} onCheckedChange={(on) => onChange(Boolean(on))} />
        <span>{labels?.name ?? 'Sound cues'}</span>
      </label>
      <p data-slot="sound-cue-caption" aria-live="polite" className="text-muted-foreground text-sm empty:hidden">
        {supported ? (enabled ? caption : '') : (labels?.unsupported ?? 'This browser cannot play sound.')}
      </p>
    </div>
  );
}
SoundCueToggle.displayName = 'SoundCueToggle';

export { SoundCueToggle };
export type { SoundCueToggleProps };
