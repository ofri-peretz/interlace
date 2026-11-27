'use client';

/**
 * @interlace/ui — ChoiceCard
 *
 * Big, tappable tiles for picking: one answer to a question, the topics a
 * reader cares about, the kind of session a group wants. A tile carries a
 * title, an optional line of description and an optional picture or icon, and
 * the whole tile is the control, so a thumb never has to find a small dot.
 *
 * `type="single"` is a radio group (one pick, arrow keys move it); `type=
 * "multiple"` is a group of checkboxes (any number, Space toggles each). Both
 * keep the controlled/uncontrolled pair (`value` + `onValueChange` /
 * `defaultValue`) and post their value with a form through `name`.
 * Mirrors: https://base-ui.com/react/components/radio and /checkbox-group
 *
 * ## Anatomy
 *
 *   ChoiceCardGroup               (div[role=radiogroup] | div[role=group] — data-slot="choice-card-group", data-type, data-layout, data-min-viewport=320)
 *     └─ ChoiceCard               (span[role=radio|checkbox] — data-slot="choice-card", data-checked) — repeats
 *         ├─ media?               (data-slot="choice-card-media")
 *         ├─ title                (data-slot="choice-card-title": the accessible name)
 *         ├─ description?         (data-slot="choice-card-description": the accessible description)
 *         ├─ children?            (anything else the tile shows)
 *         └─ indicator            (aria-hidden — data-slot="choice-card-indicator": a ring, or a box when multiple)
 *
 * ## Keyboard (owned by Base UI)
 *
 * | Key        | single                                  | multiple                    |
 * | ---------- | --------------------------------------- | --------------------------- |
 * | Tab        | into the group, on the picked tile      | to each tile in turn        |
 * | ↓ → / ↑ ←  | pick the next / previous tile (wraps)   | —                           |
 * | Space      | pick the focused tile                   | toggle the focused tile     |
 *
 * ## Layout
 *
 * `layout="grid"` (default) fills the row with tiles at least
 * `--choice-card-min` wide (12rem), one per row on a phone; `layout="list"`
 * stacks full-width rows, the shape of quiz answers. Text wraps; nothing is
 * truncated.
 *
 * ## Motion
 *
 * A tile presses in to 0.97 while held and its border and tint follow the
 * pick, timed by `--duration-fast` on `--ease-enter`; under reduced motion it
 * stays still and only the colours change.
 *
 * ## Contrast
 *
 * The picked state never rests on colour alone: the border thickens to the
 * `--primary` ring and the indicator fills and shows a check. Text keeps
 * `--card-foreground` / `--muted-foreground` on a tint of at most 6%
 * `--primary`, so body text keeps its contrast.
 *
 * | Rule | Concept                          | Where in this file                                       |
 * | ---- | -------------------------------- | -------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | group and card extend their Base UI part's props          |
 * | R6   | data-slot per part               | choice-card-group / -card / -media / -title / -description / -indicator |
 * | R7   | className merged + ...rest + ref | `cn(BASE, className)` + `{...props}` + forwarded ref      |
 * | R8   | Enums, not booleans              | `type`, `layout`                                          |
 * | R11  | Composition over prop-drilling   | cards are children, not an `options` array prop           |
 * | R12  | Reuse over wrap                  | Base UI owns roving tabindex, ARIA and the hidden inputs  |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | zero inline `style`                                       |
 * | R19  | Tokens only                      | `--primary`, `--border`, `--card`, `--duration-*`, `--ease-*` |
 * | R25  | Client component                 | required — Base UI radio and checkbox ship client hooks   |
 * | R26  | A11y from upstream               | `role="radio"` / `role="checkbox"`, named by the title    |
 */

import * as React from 'react';
import { Checkbox } from '@base-ui/react/checkbox';
import { CheckboxGroup } from '@base-ui/react/checkbox-group';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { CheckIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';

/** Smallest viable viewport (CSS px) for this primitive. */
export const MIN_VIEWPORT = 320 as const;

export type ChoiceCardLayout = 'grid' | 'list';

const ChoiceCardContext = React.createContext<'single' | 'multiple'>('single');

const LAYOUT: Record<ChoiceCardLayout, string> = {
  grid: 'grid-cols-[repeat(auto-fill,minmax(min(100%,var(--choice-card-min,12rem)),1fr))]',
  list: 'grid-cols-1',
};

interface ChoiceCardGroupShared {
  /** `grid` fills the row with tiles; `list` stacks full-width rows. @default 'grid' */
  layout?: ChoiceCardLayout;
  className?: string;
  children?: React.ReactNode;
}

export type ChoiceCardGroupSingleProps = ChoiceCardGroupShared &
  Omit<React.ComponentProps<typeof RadioGroup>, 'className' | 'children' | 'value' | 'defaultValue' | 'onValueChange'> & {
    /** One pick: a radio group. */
    type?: 'single';
    value?: string | null;
    defaultValue?: string | null;
    onValueChange?: (value: string) => void;
  };

export type ChoiceCardGroupMultipleProps = ChoiceCardGroupShared &
  Omit<React.ComponentProps<typeof CheckboxGroup>, 'className' | 'children' | 'value' | 'defaultValue' | 'onValueChange'> & {
    /** Any number of picks: a group of checkboxes. */
    type: 'multiple';
    value?: string[];
    defaultValue?: string[];
    onValueChange?: (value: string[]) => void;
    /** With `multiple`, the field name each picked tile posts with a form. */
    name?: string;
  };

export type ChoiceCardGroupProps = ChoiceCardGroupSingleProps | ChoiceCardGroupMultipleProps;

const ChoiceCardGroup = React.forwardRef<HTMLDivElement, ChoiceCardGroupProps>(function ChoiceCardGroup(
  props,
  ref,
) {
  const shared = (type: 'single' | 'multiple', layout: ChoiceCardLayout, className?: string) => ({
    'data-slot': 'choice-card-group',
    'data-type': type,
    'data-layout': layout,
    'data-min-viewport': String(MIN_VIEWPORT),
    className: cn('grid gap-3', LAYOUT[layout], className),
  });

  if (props.type === 'multiple') {
    const { type, layout = 'grid', className, children, onValueChange, name, ...rest } = props;
    return (
      <ChoiceCardContext.Provider value={type}>
        <NameContext.Provider value={name}>
          <CheckboxGroup
            ref={ref}
            {...shared(type, layout, className)}
            onValueChange={onValueChange ? (value) => onValueChange(value) : undefined}
            {...rest}
          >
            {children}
          </CheckboxGroup>
        </NameContext.Provider>
      </ChoiceCardContext.Provider>
    );
  }

  const { type = 'single', layout = 'grid', className, children, onValueChange, ...rest } = props;
  return (
    <ChoiceCardContext.Provider value={type}>
      <RadioGroup
        ref={ref}
        {...shared(type, layout, className)}
        onValueChange={onValueChange ? (value) => onValueChange(value as string) : undefined}
        {...rest}
      >
        {children}
      </RadioGroup>
    </ChoiceCardContext.Provider>
  );
});

const NameContext = React.createContext<string | undefined>(undefined);

const CARD =
  // Base UI renders a span with the role; every part inside is a span too, so the markup stays valid.
  'group/choice-card relative flex min-h-11 cursor-pointer flex-col items-start gap-1 rounded-xl border border-border bg-card p-4 pe-11 text-start text-card-foreground focus-visible:outline-hidden ' +
  'transition-[border-color,background-color,box-shadow,scale] duration-(--duration-fast) ease-enter motion-safe:active:scale-[0.97] ' +
  'hover:border-ring/60 hover:bg-muted/40 ' +
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'data-[checked]:border-primary data-[checked]:bg-primary/6 data-[checked]:shadow-[inset_0_0_0_1px_var(--primary)] ' +
  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:motion-safe:active:scale-100 ' +
  'aria-invalid:border-destructive';

const INDICATOR =
  'absolute end-3 top-3 flex size-5 items-center justify-center border border-input bg-background text-primary-foreground ' +
  'transition-[background-color,border-color] duration-(--duration-fast) ease-enter ' +
  'group-data-[checked]/choice-card:border-primary group-data-[checked]/choice-card:bg-primary';

export interface ChoiceCardProps extends Omit<React.ComponentPropsWithoutRef<'span'>, 'title' | 'onChange'> {
  /** The value this tile picks. */
  value: string;
  /** The tile's name: short, read first, and the accessible name. */
  title: React.ReactNode;
  /** One line under the title, read as the accessible description. */
  description?: React.ReactNode;
  /** A picture or icon above the title. Give an image its own `alt`, or `alt=""` when the title says it all. */
  media?: React.ReactNode;
  /** The tile cannot be picked. */
  disabled?: boolean;
}

const ChoiceCard = React.forwardRef<HTMLElement, ChoiceCardProps>(function ChoiceCard(
  { value, title, description, media, disabled, className, children, ...props },
  ref,
) {
  const type = React.useContext(ChoiceCardContext);
  const name = React.useContext(NameContext);
  const id = React.useId();
  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;

  const parts = (
    <>
      {media ? (
        <span data-slot="choice-card-media" className="mb-2 flex text-primary [&_svg:not([class*='size-'])]:size-6">
          {media}
        </span>
      ) : null}
      <span id={titleId} data-slot="choice-card-title" className="font-medium">
        {title}
      </span>
      {description ? (
        <span id={descriptionId} data-slot="choice-card-description" className="text-muted-foreground text-sm">
          {description}
        </span>
      ) : null}
      {children}
      <span
        aria-hidden="true"
        data-slot="choice-card-indicator"
        className={cn(INDICATOR, type === 'single' ? 'rounded-full' : 'rounded-md')}
      >
        <CheckIcon
          className="size-3.5 opacity-0 transition-opacity duration-(--duration-fast) ease-enter group-data-[checked]/choice-card:opacity-100"
          strokeWidth={3}
        />
      </span>
    </>
  );

  const common = {
    'data-slot': 'choice-card',
    'aria-labelledby': titleId,
    'aria-describedby': descriptionId,
    className: cn(CARD, className),
    disabled,
    ...props,
  };

  if (type === 'multiple') {
    return (
      <Checkbox.Root ref={ref} value={value} name={name} {...common}>
        {parts}
      </Checkbox.Root>
    );
  }
  return (
    <Radio.Root
      ref={ref}
      value={value}
      {...common}
      // Base UI puts `aria-readonly` on the radio too; ARIA allows it only on the group, which also gets it.
      aria-readonly={undefined}
    >
      {parts}
    </Radio.Root>
  );
});

export { ChoiceCard, ChoiceCardGroup };
