'use client';

/**
 * @interlace/ui — Button (secondary reference for the interlace-component skill)
 *
 * The minimal-surface counterpart to [dialog.tsx](./dialog.tsx). Where Dialog
 * exercises compound composition + portal + focus, Button exercises the
 * variant + render-prop polymorphism + native-event passthrough surface.
 *
 * | Rule | Concept                          | Where in this file                                                          |
 * | ---- | -------------------------------- | --------------------------------------------------------------------------- |
 * | R4   | Extends native el + VariantProps | `React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>`      |
 * | R7   | className merged + ...rest + ref | `cn(buttonVariants({ ... }), className)` + `{...props}` + `useRender`        |
 * | R8   | No `isXxx` prefix                | All variant keys (`variant`, `size`) follow MUI naming, not `isXxx`         |
 * | R9   | Native onClick stays native      | `onClick` passes through `{...props}` — never wrapped in a bespoke name     |
 * | R12  | Reuse over wrap                  | The `render` prop lets consumers replace the rendered element entirely      |
 * | R13  | Ecosystem first                  | `useRender` from `@base-ui/react/use-render` owns slot rendering |
 * | R17  | API parity                       | Mirrors shadcn/ui Button + Base UI's `useRender` slot — no deviation        |
 * | R18  | Tailwind only                    | Zero inline `style={{}}`; all visual classes come from `buttonVariants`     |
 * | R19  | Tokens only                      | `buttonVariants` lives in [button-variants.ts](./button-variants.ts) and uses theme tokens |
 * | R20  | AA contrast                      | Variant classes target `bg-primary`/`text-primary-foreground` — token pair  |
 * | R26  | A11y from native el              | `<button>` is the native element; focus, keyboard, ARIA inherited           |
 *
 * ## Loading
 *
 * `loading` keeps the button where it is and as wide as it was, and says it
 * is busy. The label and any direct icon stay in the layout but stop
 * painting (`-webkit-text-fill-color: transparent` and `invisible`), and a
 * spinner sits over the middle in the label's own colour, so nothing beside
 * the button shifts. The button stays focusable: it takes `aria-busy` and
 * `aria-disabled`, not `disabled`, because a focused button that becomes
 * `disabled` drops focus to the page. Clicks are swallowed while it loads,
 * including a form submit. Under reduced motion the spinner stands still,
 * which still reads as "working".
 *
 * Out of scope: this primitive does not own `data-testid` / `data-slot` defaults
 * (R5 / R6) — those are consumer-supplied and live one level up in the
 * compound parent (`<MyButton data-testid="submit" data-slot="form-submit">`).
 */

import * as React from 'react';
import { useRender } from '@base-ui/react/use-render';
import type { VariantProps } from 'class-variance-authority';
import { LoaderCircleIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { buttonVariants } from './button-variants.js';

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /**
     * Replace the rendered element. Equivalent to shadcn's legacy `asChild`.
     * Pass a `ReactElement` (e.g. `<Link href="...">`) or a render function.
     */
    render?: useRender.RenderProp;
    /**
     * Busy: show a spinner over the label, keep the size and focus, and
     * ignore clicks until it is false again. The click still bubbles, as it
     * does for any `aria-disabled` control, so a clickable parent should
     * check `aria-busy` if it must ignore it too.
     */
    loading?: boolean;
  };

/**
 * The label stops painting but keeps its space. Text through the fill colour
 * (`currentColor` still reaches the spinner), direct icons through
 * `invisible`. The spinner's icon sits inside a span, out of both reaches,
 * and a span keeps Button's `has-[>svg]` padding from seeing it.
 */
const LOADING = '[-webkit-text-fill-color:transparent] [&>svg]:invisible cursor-progress';

function swallow(event: React.MouseEvent) {
  event.preventDefault();
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  render,
  loading = false,
  ...props
}: ButtonProps) {
  const { children } = props;
  const element = useRender({
    render: render ?? <button />,
    props: {
      'data-slot': 'button',
      'data-variant': variant ?? undefined,
      'data-size': size ?? undefined,
      className: cn(buttonVariants({ variant, size }), loading && LOADING, className),
      ...props,
      ...(loading && {
        'data-loading': '',
        'aria-busy': true,
        'aria-disabled': true,
        onClick: swallow,
        // Only while loading: otherwise `children` rides in `...props`, so a
        // `render` element keeps its own children.
        children: (
          <>
            {children}
            <span
              data-slot="button-spinner"
              aria-hidden
              className="absolute inset-0 grid place-items-center"
            >
              <LoaderCircleIcon className="size-4 motion-safe:animate-spin" />
            </span>
          </>
        ),
      }),
    },
  });

  return element;
}

export { Button, buttonVariants };
export type { ButtonProps };
