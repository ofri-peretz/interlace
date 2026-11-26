'use client';

/**
 * @interlace/ui — DirectionProvider
 *
 * Sets the reading direction once, for both halves of a component: the CSS
 * and the keyboard.
 *
 * `dir="rtl"` on an element is enough for layout. Logical sides (`ps-*`,
 * `border-s`, `start-*`) and the `rtl:` variant follow it. It is not enough
 * for behaviour. Base UI reads direction from React context, not from the
 * DOM, so without a provider a slider still grows to the right, ArrowRight
 * still moves to the next tab, and ArrowRight still opens a submenu that
 * opens to the left. This component sets both from one prop, so they cannot
 * disagree.
 *
 * Put it at the root of the app, next to `<html dir>`, or around any subtree
 * written in the other direction (a quote in Arabic inside an English page).
 *
 * ## Anatomy
 *
 *   DirectionProvider               (div · display: contents · dir · data-min-viewport=320)
 *     └─ children                   (Base UI composites read the same direction)
 *
 * The wrapper is `display: contents`, so it adds no box: it never changes
 * layout, a grid's tracks or a flex row.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Direction is a property of the language, not of the screen.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'div'> & DirectionProviderProps`      |
 * | R6   | data-slot on root                | `data-slot="direction"`                                     |
 * | R7   | className merged + ...rest       | `cn('contents', className)` + `{...props}`                  |
 * | R8   | Enum, not boolean                | `direction = 'ltr' \| 'rtl'`                                |
 * | R13  | Ecosystem first                  | Wraps Base UI's `DirectionProvider`; re-exports `useDirection` |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`                                          |
 * | R26  | A11y                             | `dir` on a real element, so assistive tech and the bidi algorithm see it |
 */

import * as React from 'react';
import {
  DirectionProvider as BaseDirectionProvider,
  useDirection,
  type TextDirection,
} from '@base-ui/react/direction-provider';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

type DirectionProviderProps = Omit<React.ComponentProps<'div'>, 'dir'> & {
  /** The reading direction of everything inside. @default 'ltr' */
  direction?: TextDirection;
};

function DirectionProvider({
  direction = 'ltr',
  className,
  children,
  ...props
}: DirectionProviderProps) {
  return (
    <BaseDirectionProvider direction={direction}>
      <div
        dir={direction}
        data-slot="direction"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('contents', className)}
        {...props}
      >
        {children}
      </div>
    </BaseDirectionProvider>
  );
}

export { DirectionProvider, useDirection };
export type { DirectionProviderProps, TextDirection };
