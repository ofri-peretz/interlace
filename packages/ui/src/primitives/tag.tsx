/**
 * @interlace/ui — Tag + TagList
 *
 * A tiny inline anchor used to surface taxonomy (rule categories, plugin
 * tags, article topics). Two exports because tag chips almost always
 * appear in a wrapping cluster — `TagList` ships the canonical
 * `<ul>`-of-`<li>` semantics so consumers don't reinvent the markup
 * (and don't accidentally drop the list role the way a bare flex of
 * anchors would).
 *
 * Server component — no hooks, just a styled `<a>`. Native focus,
 * native activation, native keyboard handling. The hover affordance
 * (violet border) follows the brand-accent rule (only on interactive
 * surfaces; never on plain text).
 *
 * ## Anatomy
 *
 *   TagList                            (ul — data-min-viewport=320)
 *     └─ li (one per item)
 *          └─ Tag                      (anchor — data-min-viewport=320)
 *               └─ children
 *
 * ## MIN_VIEWPORT — 320
 *
 * Tag clusters wrap; nothing in this primitive assumes desktop width.
 * The `flex-wrap` in `TagList` is the explicit narrow-screen contract.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el + VariantProps | `React.ComponentProps<'a'> & VariantProps<...>`             |
 * | R6   | data-slot on the part            | `data-slot="tag"` / `data-slot="tag-list"`                  |
 * | R7   | className merged + ...rest       | `cn(tagVariants(...), className)` + `{...props}`            |
 * | R8   | No `isXxx`; enums for >2 states  | `tone` is an enum (default | primary | muted)               |
 * | R10  | Composition seam                 | `TagList` renders `Tag` per item; consumer can also use Tag directly |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | zero inline `style`; cva classes only                       |
 * | R19  | Tokens only                      | radius `--radius-full`, padding `--spacing-*`, type `--text-xs`, border `border-border` |
 * | R20  | AA contrast                      | tones use semantic foreground/muted tokens that clear AA    |
 * | R25  | Server component                 | no hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | `<a href>` owns focus + activation; `<ul>` owns list semantics |
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn.js';

/**
 * Minimum viable viewport (CSS px) for this primitive. Below it, the
 * preflight contract draws a dev-mode outline; in prod the component
 * still renders. Exported so consumers / tests can read it.
 */
export const MIN_VIEWPORT = 320 as const;

const tagVariants = cva(
  [
    // Pill anchor — rounded-full border, compact padding, small UI type.
    'inline-flex items-center rounded-full border border-border',
    'px-2.5 py-0.5 text-xs',
    'transition-colors',
    // Brand-accent hover lift (only on the interactive surface).
    'hover:border-violet-500/60',
    // Standard focus ring contract.
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  ].join(' '),
  {
    variants: {
      /**
       * Tone of the chip surface. `default` inherits page foreground;
       * `primary` lifts to the brand foreground; `muted` drops to the
       * muted-foreground token for low-emphasis taxonomy (e.g. dates).
       */
      tone: {
        default: 'text-foreground',
        primary: 'text-primary',
        muted: 'text-muted-foreground',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  },
);

interface TagProps
  extends React.ComponentProps<'a'>,
    VariantProps<typeof tagVariants> {
  /** Destination — required because Tag is always a link, never a button. */
  href: string;
}

/** A single tag chip. Server component (no hooks). */
const Tag = React.forwardRef<HTMLAnchorElement, TagProps>(
  ({ className, tone, href, children, ...props }, ref) => {
    return (
      <a
        ref={ref}
        href={href}
        data-slot="tag"
        data-min-viewport={String(MIN_VIEWPORT)}
        data-tone={tone ?? undefined}
        className={cn(tagVariants({ tone }), className)}
        {...props}
      >
        {children}
      </a>
    );
  },
);
Tag.displayName = 'Tag';

/**
 * One item in a {@link TagList}. Carries the destination + label and an
 * optional per-item tone override.
 */
export interface TagListItem {
  label: React.ReactNode;
  href: string;
  tone?: VariantProps<typeof tagVariants>['tone'];
}

interface TagListProps extends React.ComponentProps<'ul'> {
  /** The chips to render. Each item maps to one `<li>` → `Tag`. */
  items: TagListItem[];
}

/**
 * A wrapping cluster of {@link Tag} chips. Renders as an unordered list
 * for assistive-tech list semantics; visually a `flex-wrap` row with
 * `gap-2` rhythm. Server component (no hooks).
 */
const TagList = React.forwardRef<HTMLUListElement, TagListProps>(
  ({ className, items, ...props }, ref) => {
    return (
      <ul
        ref={ref}
        data-slot="tag-list"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('flex flex-wrap gap-2', className)}
        {...props}
      >
        {items.map((item) => (
          <li key={item.href}>
            <Tag href={item.href} tone={item.tone}>
              {item.label}
            </Tag>
          </li>
        ))}
      </ul>
    );
  },
);
TagList.displayName = 'TagList';

export { Tag, TagList, tagVariants };
export type { TagProps, TagListProps };
