/**
 * @interlace/ui — List
 *
 * A list whose markers carry the voice of the page: numbered claims, a row of
 * checks, a "what we're not saying" list of crosses. The marker sits on the
 * first line of each item, whatever the item holds: a sentence, rich text
 * with inline `Citation` chips, a paragraph and a link.
 *
 * | `marker`  | Renders | Marker                                     | Use it for                         |
 * | --------- | ------- | ------------------------------------------ | ---------------------------------- |
 * | `bullet`  | `ul`    | A small dot                                | Plain lists                        |
 * | `number`  | `ol`    | The item's number in a filled circle       | Claims or steps read in order      |
 * | `check`   | `ul`    | A check in the success colour              | What is true, done, or included    |
 * | `cross`   | `ul`    | A cross in the destructive colour          | What is not claimed, not included  |
 *
 * ## The meaning is in the words
 *
 * Every marker is drawn in CSS (`::before`), so assistive technology never
 * reads it. A list of crosses needs a heading that says what the crosses
 * mean ("What we're not saying"), exactly as a sighted reader needs it.
 * Numbers come from the browser's own `list-item` counter, so `start` and
 * `reversed` on the `ol` work as they do on any ordered list, and screen
 * readers still announce the list and its length.
 *
 * ## Anatomy
 *
 *   List                     (ul | ol — data-slot="list", data-marker)
 *     └─ ListItem × n        (li)
 *         ├─ list-marker     (span, aria-hidden — one line tall; the marker is its ::before)
 *         └─ {children}
 *
 * ## MIN_VIEWPORT — 320
 *
 * Text rows with a fixed 2rem gutter for the marker; content wraps.
 *
 * | Rule | Concept                 | Where in this file                                         |
 * | ---- | ----------------------- | ---------------------------------------------------------- |
 * | R4   | Extends native el       | `ul` / `ol` / `li` props                                   |
 * | R6   | data-slot per part      | list / list-item, `data-marker` on the root                |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                          |
 * | R8   | Enums, not booleans     | `marker`, `density`                                        |
 * | R14  | Declares min viewport   | `data-min-viewport` on the root + exported const           |
 * | R19  | Tokens only             | `bg-foreground`, `bg-success`, `bg-destructive`            |
 * | R25  | Server component        | No hooks; the item reads the marker from the root in CSS   |
 * | R26  | A11y from native el     | A real `ul`/`ol`; markers are decoration, words carry meaning |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

export type ListMarker = 'bullet' | 'number' | 'check' | 'cross';

/**
 * Each marker is the ::before of a one-line box, keyed off the root's
 * `data-marker` so ListItem needs no prop and no context.
 */
const MARKER = {
  bullet:
    'group-data-[marker=bullet]/list:before:size-1.5 group-data-[marker=bullet]/list:before:rounded-full group-data-[marker=bullet]/list:before:bg-foreground',
  number:
    'group-data-[marker=number]/list:before:grid group-data-[marker=number]/list:before:size-6 group-data-[marker=number]/list:before:place-items-center group-data-[marker=number]/list:before:rounded-full group-data-[marker=number]/list:before:bg-foreground group-data-[marker=number]/list:before:text-xs group-data-[marker=number]/list:before:leading-none group-data-[marker=number]/list:before:font-semibold group-data-[marker=number]/list:before:text-background group-data-[marker=number]/list:before:tabular-nums group-data-[marker=number]/list:before:content-[counter(list-item)]',
  check:
    'group-data-[marker=check]/list:before:size-4 group-data-[marker=check]/list:before:bg-success group-data-[marker=check]/list:before:[mask-repeat:no-repeat] group-data-[marker=check]/list:before:[mask-size:contain] group-data-[marker=check]/list:before:[mask-image:url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27black%27%20stroke-width=%273%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M20%206%209%2017l-5-5%27/%3E%3C/svg%3E)]',
  cross:
    'group-data-[marker=cross]/list:before:size-4 group-data-[marker=cross]/list:before:bg-destructive group-data-[marker=cross]/list:before:[mask-repeat:no-repeat] group-data-[marker=cross]/list:before:[mask-size:contain] group-data-[marker=cross]/list:before:[mask-image:url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27black%27%20stroke-width=%273%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M18%206%206%2018M6%206l12%2012%27/%3E%3C/svg%3E)]',
} as const satisfies Record<ListMarker, string>;

const DENSITY = {
  compact: 'space-y-1.5',
  default: 'space-y-3',
  relaxed: 'space-y-5',
} as const;

type ListOwnProps = {
  /** The marker every item gets. `number` renders an `ol`. @default 'bullet' */
  marker?: ListMarker;
  /** Space between items. @default 'default' */
  density?: keyof typeof DENSITY;
};

/**
 * `marker="number"` renders an `ol` and takes its props (`start`,
 * `reversed`); every other marker renders a `ul`, so those are a type error.
 */
export type ListProps =
  | (ListOwnProps & { marker: 'number' } & React.ComponentProps<'ol'>)
  | (ListOwnProps & { marker?: Exclude<ListMarker, 'number'> } & React.ComponentProps<'ul'>);

function List({ marker = 'bullet', density = 'default', className, ...props }: ListProps) {
  const shared = {
    'data-slot': 'list',
    'data-marker': marker,
    'data-min-viewport': String(MIN_VIEWPORT),
    className: cn('group/list list-none ps-0', DENSITY[density], className),
  };
  return marker === 'number' ? (
    <ol {...(props as React.ComponentProps<'ol'>)} {...shared} />
  ) : (
    <ul {...(props as React.ComponentProps<'ul'>)} {...shared} />
  );
}

export type ListItemProps = React.ComponentProps<'li'>;

function ListItem({ className, children, ...props }: ListItemProps) {
  return (
    <li data-slot="list-item" className={cn('relative ps-8', className)} {...props}>
      {/* The marker box is one line tall in the item's own font (1lh), so the
          marker centres on the first line at any text size. Hidden: the words
          carry the meaning, and its only content is a ::before. */}
      <span
        aria-hidden
        data-slot="list-marker"
        className={cn(
          "absolute start-0 top-0 flex h-[1lh] w-6 items-center justify-center before:content-['']",
          MARKER.bullet,
          MARKER.number,
          MARKER.check,
          MARKER.cross,
        )}
      />
      {children}
    </li>
  );
}

const ListWithItem = Object.assign(List, { Item: ListItem });

export { ListWithItem as List, ListItem };
