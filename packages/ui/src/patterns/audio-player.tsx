/**
 * @interlace/ui — AudioPlayer
 *
 * A titled audio clip with its transcript. The player is the browser's own
 * `<audio controls>`: it is keyboard- and screen-reader-operable on every
 * platform, honours the OS media keys, and needs no JavaScript from us. What
 * this pattern adds is the frame around it: a title, a line of detail (length,
 * speaker), and a transcript in a native `<details>`, because audio without a
 * transcript fails WCAG 1.2.1 and leaves out everyone who cannot listen
 * right now.
 *
 * ## Anatomy
 *
 *   AudioPlayer                       (figure — data-min-viewport=320)
 *     ├─ figcaption                   (title + detail)
 *     ├─ audio[controls]              (preload="metadata" by default)
 *     └─ details > summary + transcript   (when `transcript` is given)
 *
 * ## MIN_VIEWPORT — 320
 *
 * The native control stretches to the figure's width.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `figure` props; `audioProps` reach the `<audio>`            |
 * | R6   | data-slot per part               | audio-player / -audio / -transcript                         |
 * | R7   | cn + ...rest                     | `cn(…, className)` + `{...props}`                           |
 * | R12  | Reuse over wrap                  | The browser owns playback, seeking, volume and media keys   |
 * | R14  | Declares min viewport            | `data-min-viewport` on the root + exported const            |
 * | R19  | Tokens only                      | `bg-card`, `border-border`, `text-muted-foreground`         |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | `<audio controls>`, `<figcaption>`, transcript in `<details>` |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

type AudioPlayerProps = Omit<React.ComponentProps<'figure'>, 'title' | 'children'> & {
  /** The audio file URL. */
  src: string;
  /** What the clip is. Also names the audio element for assistive tech. */
  title: string;
  /** A short line under the title: length, speaker, date. */
  detail?: React.ReactNode;
  /** The words spoken. Strongly recommended (WCAG 1.2.1). */
  transcript?: React.ReactNode;
  /** Summary text of the transcript toggle. @default 'Transcript' */
  transcriptLabel?: React.ReactNode;
  /** Passed to the `<audio>` element (`preload`, `onPlay`, …). */
  audioProps?: Omit<React.ComponentProps<'audio'>, 'src' | 'controls'>;
};

function AudioPlayer({
  src,
  title,
  detail,
  transcript,
  transcriptLabel = 'Transcript',
  audioProps,
  className,
  ...props
}: AudioPlayerProps) {
  return (
    <figure
      data-slot="audio-player"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('bg-card text-card-foreground border-border space-y-3 rounded-xl border p-4', className)}
      {...props}
    >
      <figcaption>
        <p className="font-medium">{title}</p>
        {detail ? <p className="text-muted-foreground text-sm">{detail}</p> : null}
      </figcaption>
      <audio
        data-slot="audio-player-audio"
        src={src}
        controls
        preload="metadata"
        aria-label={title}
        className="w-full"
        {...audioProps}
      />
      {transcript ? (
        <details data-slot="audio-player-transcript" className="text-sm">
          <summary className="hover:text-primary cursor-pointer rounded-sm font-medium">
            {transcriptLabel}
          </summary>
          <div className="text-muted-foreground space-y-2 pt-2 leading-relaxed">{transcript}</div>
        </details>
      ) : null}
    </figure>
  );
}

export { AudioPlayer };
export type { AudioPlayerProps };
