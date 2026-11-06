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
 * Out of scope: this primitive does not own `data-testid` / `data-slot` defaults
 * (R5 / R6) — those are consumer-supplied and live one level up in the
 * compound parent (`<MyButton data-testid="submit" data-slot="form-submit">`).
 */

import * as React from 'react';
import { useRender } from '@base-ui/react/use-render';
import type { VariantProps } from 'class-variance-authority';

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
     * Stretch to the width of the container (form actions, mobile CTAs).
     * Prefer this over `className="w-full"`.
     * @default false
     */
    fullWidth?: boolean;
    /**
     * Native button type. Unlike a bare `<button>`, Button does NOT submit by
     * default: pass `type="submit"` for the form's submit action.
     * @default 'button' (no default when `render` replaces the element)
     */
    type?: 'button' | 'submit' | 'reset';
  };

function Button({
  className,
  variant = 'default',
  size = 'default',
  fullWidth = false,
  render,
  type,
  ...props
}: ButtonProps) {
  const element = useRender({
    render: render ?? <button />,
    props: {
      'data-slot': 'button',
      'data-variant': variant ?? undefined,
      'data-size': size ?? undefined,
      className: cn(buttonVariants({ variant, size, fullWidth, className })),
      // A native <button> defaults to type="submit", so a Cancel inside a form
      // submitted it. Default to "button" (MUI ButtonBase, Chakra, Primer do the
      // same); submitting is now an explicit `type="submit"`. A `render`ed
      // element (an <a>, a router Link) gets no type unless one is passed.
      type: type ?? (render ? undefined : 'button'),
      ...props,
    },
  });

  return element;
}

export { Button, buttonVariants };
export type { ButtonProps };
