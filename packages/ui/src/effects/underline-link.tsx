/**
 * @interlace/ui — UnderlineLink
 *
 * A text link whose underline draws itself in when the reader points at it
 * or tabs to it, from the start of the line to the end, and wraps across
 * lines with the text. For links in running text, navigation and footers
 * where a hard underline on every link would be loud.
 *
 * ## Content first
 *
 * It is an `<a>` (or your router's link, through `render`), so it behaves as
 * a link everywhere: middle-click, copy link, a screen reader's link list. At
 * rest it keeps a thin underline by default (`rest="thin"`), because a link
 * must not be told apart by colour alone (WCAG 1.4.1); `rest="none"` is for
 * places where every item is plainly a link, like a nav bar.
 *
 * ## Motion
 *
 * One CSS transition of `background-size`, timed by the motion tokens. The
 * underline grows from the inline-start edge, so it runs right to left in a
 * right-to-left line. Under `prefers-reduced-motion: reduce` the preflight
 * clamp makes it appear at once. It needs no JavaScript and runs as a server
 * component.
 *
 * ## Tokens
 *
 * The line takes `currentColor`, so it follows the link's own colour.
 * `tone="primary"` colours the text with `--primary`.
 *
 * ## Composition
 *
 *   UnderlineLink                       (a — data-slot="underline-link", data-rest, data-tone)
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `a` props                                            |
 * | R6   | data-slot per part      | underline-link                                       |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}` + `useRender`      |
 * | R8   | Enums, not booleans     | `rest`, `tone`                                       |
 * | R13  | Ecosystem first         | `useRender` for a router link                        |
 * | R19  | Tokens only             | `--primary`, `--ring`, `--duration-*`, `--ease-*`    |
 * | R26  | A11y from native el     | a real link, underlined at rest by default           |
 */

import { useRender } from '@base-ui/react/use-render';
import * as React from 'react';

import { cn } from '../lib/cn.js';

const REST = {
  /** A hairline at rest that thickens and fills as the link is pointed at. */
  thin: '[--underline-rest:100%_1px]',
  /** No line at rest; for places where every item is plainly a link. */
  none: '[--underline-rest:0%_0.08em]',
} as const;

const TONES = {
  inherit: 'text-inherit',
  primary: 'text-primary',
} as const;

export type UnderlineLinkRest = keyof typeof REST;
export type UnderlineLinkTone = keyof typeof TONES;

export interface UnderlineLinkProps extends React.ComponentPropsWithoutRef<'a'> {
  /** What shows at rest: a `thin` underline, or `none`. @default 'thin' */
  rest?: UnderlineLinkRest;
  /** The text colour: the surrounding text's, or `primary`. @default 'inherit' */
  tone?: UnderlineLinkTone;
  /** Replace the rendered element, e.g. with a router link. */
  render?: useRender.RenderProp;
}

/** The default element. Written out, so the href and the text are plainly on the link. */
function renderAnchor(props: React.HTMLAttributes<HTMLElement>) {
  const { href, children, ...rest } = props as React.ComponentPropsWithoutRef<'a'>;
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

export function UnderlineLink({ rest = 'thin', tone = 'inherit', render, className, ...props }: UnderlineLinkProps) {
  return useRender({
    // A function rather than `<a />`: the href and the text arrive through the props.
    render: render ?? renderAnchor,
    props: {
      'data-slot': 'underline-link',
      'data-rest': rest,
      'data-tone': tone,
      className: cn(
        'rounded-[0.125rem] bg-no-repeat no-underline [background-image:linear-gradient(currentColor,currentColor)] [background-size:var(--underline-rest)] bg-[position:0_100%] rtl:bg-[position:100%_100%] [box-decoration-break:slice]',
        'transition-[background-size] duration-(--duration-slow) ease-(--ease-move)',
        'hover:[background-size:100%_0.08em] focus-visible:[background-size:100%_0.08em]',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        'forced-colors:underline',
        REST[rest],
        TONES[tone],
        className,
      ),
      ...props,
    },
  });
}
