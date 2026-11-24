'use client';

/**
 * @interlace/ui — View transitions: startViewTransition, useViewTransition, Morph, PageTransitions
 *
 * The browser's View Transitions API, made safe to reach for: a card grows
 * into its detail page, a list reorders in place, and a page change
 * cross-fades instead of blinking. Interlace adds only what the API leaves
 * to every app: a fallback where it is missing, nothing at all under reduced
 * motion, React state flushed inside the transition, and names that are
 * always valid.
 *
 * ## Anatomy
 *
 *   startViewTransition(update, options?)   (plain function: any framework)
 *   useViewTransition()                     → (update, options?) => void, with flushSync
 *   Morph name="card-42"                    (gives its one child a view-transition-name)
 *   PageTransitions                         (a <style>: page changes between documents)
 *
 * ## A card that grows into its page
 *
 * Wrap the card's image (or the whole card) in `<Morph name={`item-${id}`}>`
 * and the detail page's hero in the same `<Morph>`. Change the view inside
 * `useViewTransition()` (same document) or navigate between documents with
 * `PageTransitions` on both pages: the browser moves and scales the one into
 * the other. A name must be unique on the page at any moment; `Morph`
 * cleans it into a valid identifier (`viewTransitionName`).
 *
 * ## Motion
 *
 * The page itself: the old view fades out (180ms) and the new one rises in
 * by half a rem (300ms, `--ease-enter`); a named element moves and scales
 * between its two boxes (`--duration-slow`). Opacity and transform only.
 * Under `prefers-reduced-motion: reduce` there is no transition at all: the
 * update runs straight away, and `PageTransitions` turns cross-document
 * transitions off. Where the browser has no View Transitions, the update
 * simply runs.
 *
 * | Rule | Concept                   | Where in this file                              |
 * | ---- | ------------------------- | ----------------------------------------------- |
 * | R6   | data-slot per part        | `data-slot="morph"` on the child; page-transitions |
 * | R25  | Client component          | transitions run in the browser                  |
 * | R26  | A11y                      | off under reduced motion; content never hidden  |
 */

import * as React from 'react';
import { flushSync } from 'react-dom';

import { useReducedMotion } from '../lib/use-reduced-motion.js';

export interface ViewTransitionOptions {
  /** View transition types (`:active-view-transition-type(forward)`), where supported. */
  types?: string[];
  /** Run the update without a transition. */
  skip?: boolean;
}

type DocumentWithTransitions = Document & {
  startViewTransition?: (
    arg: (() => void | Promise<void>) | { update: () => void | Promise<void>; types?: string[] },
  ) => ViewTransition;
};

/** Whether this browser can run a same-document view transition. */
export function supportsViewTransitions(): boolean {
  return (
    typeof document !== 'undefined' && typeof (document as DocumentWithTransitions).startViewTransition === 'function'
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/**
 * Runs `update` inside a view transition where the browser has one and the
 * reader has not asked for less motion; otherwise runs it straight away.
 * Returns the transition, or null when there was none.
 */
export function startViewTransition(
  update: () => void | Promise<void>,
  options: ViewTransitionOptions = {},
): ViewTransition | null {
  const doc = (globalThis as { document?: DocumentWithTransitions }).document;
  if (options.skip || !doc?.startViewTransition || prefersReducedMotion()) {
    void update();
    return null;
  }
  if (options.types?.length) {
    try {
      return doc.startViewTransition({ update, types: options.types });
    } catch {
      // Older engines take only a callback.
    }
  }
  return doc.startViewTransition(update);
}

/**
 * `startViewTransition` for React state: the update is flushed inside the
 * transition, so the browser captures the new view, not the old one.
 */
export function useViewTransition(): (update: () => void, options?: ViewTransitionOptions) => ViewTransition | null {
  const reduced = useReducedMotion();
  return React.useCallback(
    (update: () => void, options: ViewTransitionOptions = {}) =>
      startViewTransition(() => flushSync(update), { ...options, skip: options.skip || reduced }),
    [reduced],
  );
}

/** A valid `view-transition-name` from any string: letters, digits, `-` and `_`, not starting with a digit. */
export function viewTransitionName(raw: string): string {
  const cleaned = raw
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const name = /^(?:\d|-\d|--)/.test(cleaned) || !cleaned ? `vt-${cleaned}` : cleaned;
  // `none` and `auto` are keywords, not names.
  return name === 'none' || name === 'auto' ? `vt-${name}` : name;
}

export interface MorphProps {
  /** Shared by the element on both views. Unique on the page at any moment. */
  name: string;
  /** Leave the name off, e.g. on every card but the one being opened. @default false */
  disabled?: boolean;
  /** One element that takes a `style` prop. */
  children: React.ReactElement<{ style?: React.CSSProperties; 'data-slot'?: string }>;
}

/**
 * Names its one child for view transitions, so the same name on the next
 * view morphs from this box into that one.
 */
function Morph({ name, disabled = false, children }: MorphProps) {
  const child = React.Children.only(children);
  if (disabled) return child;
  return React.cloneElement(child, {
    style: { ...child.props.style, viewTransitionName: viewTransitionName(name) },
  });
}
Morph.displayName = 'Morph';

export interface PageTransitionsProps {
  /** Turn on transitions between documents (multi-page sites). @default true */
  crossDocument?: boolean;
  /** The page's own fade and rise. 'none' leaves only named elements moving. @default 'rise' */
  page?: 'rise' | 'fade' | 'none';
}

const PAGE: Record<NonNullable<PageTransitionsProps['page']>, string> = {
  rise:
    '::view-transition-old(root){animation:ilx-vt-out 180ms var(--ease-exit,ease-in) both}' +
    '::view-transition-new(root){animation:ilx-vt-in 300ms var(--ease-enter,ease-out) both}',
  fade:
    '::view-transition-old(root){animation:ilx-vt-fade-out 180ms var(--ease-exit,ease-in) both}' +
    '::view-transition-new(root){animation:ilx-vt-fade-in 300ms var(--ease-enter,ease-out) both}',
  none: '::view-transition-old(root),::view-transition-new(root){animation:none}',
};

/** The CSS `PageTransitions` renders, for a stylesheet of your own. */
export function pageTransitionsCss({ crossDocument = true, page = 'rise' }: PageTransitionsProps = {}): string {
  return (
    '@media (prefers-reduced-motion:no-preference){' +
    (crossDocument ? '@view-transition{navigation:auto}' : '') +
    '::view-transition-group(*){animation-duration:var(--duration-slow,400ms);animation-timing-function:var(--ease-enter,ease-out)}' +
    PAGE[page] +
    '}' +
    '@media (prefers-reduced-motion:reduce){::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){animation:none!important}}' +
    '@keyframes ilx-vt-out{to{opacity:0;transform:translateY(-0.25rem)}}' +
    '@keyframes ilx-vt-in{from{opacity:0;transform:translateY(0.5rem)}}' +
    '@keyframes ilx-vt-fade-out{to{opacity:0}}' +
    '@keyframes ilx-vt-fade-in{from{opacity:0}}'
  );
}

/**
 * The page-level look of view transitions, once per page (in the root
 * layout). Server-safe: it renders a `<style>` and nothing else.
 */
function PageTransitions(props: PageTransitionsProps) {
  return <style data-slot="page-transitions">{pageTransitionsCss(props)}</style>;
}
PageTransitions.displayName = 'PageTransitions';

export { Morph, PageTransitions };
