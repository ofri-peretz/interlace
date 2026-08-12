// Mirrors the shadcn Avatar canon, built on Base UI primitives.
// Upstream: https://base-ui.com/react/components/avatar
'use client';

/**
 * @interlace/ui — Avatar
 *
 * A circular image with a text fallback. Wraps @base-ui/react/avatar: Base UI
 * owns the image load/error state machine that decides when the fallback
 * shows, and we own the surface.
 *
 * Ours is the `size-8` clipped circle, the muted fallback face, and a
 * `loading` prop that renders a Skeleton in the same footprint instead.
 *
 * ## Anatomy
 *
 *   Avatar                           (Avatar.Root — size-8, rounded-full, overflow-hidden)
 *     ├─ AvatarImage                 (Avatar.Image — aspect-square size-full)
 *     └─ AvatarFallback              (Avatar.Fallback — bg-muted, centred initials)
 *
 * `size-8` is a default, not a constraint: it is merged through `cn`, so
 * `className="size-12"` wins. The `loading` skeleton is given the same
 * `size-8` and the same `className`, so an overridden size survives the swap.
 *
 * ## Two different absences
 *
 * When the image is missing or fails, Base UI swaps in `AvatarFallback` — the
 * decision is upstream's and this file does not participate in it. When the
 * DATA is not there yet (no URL, no initials), the caller passes `loading` and
 * this file replaces the whole surface with a Skeleton before Base UI is
 * involved at all.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | `React.ComponentProps<typeof BaseAvatar.Root/Image/Fallback>` |
 * | R6   | data-slot per part               | avatar / avatar-image / avatar-fallback                     |
 * | R7   | cn + ...rest                     | `cn('… size-8 …', className)` + `{...props}`                |
 * | R12  | Reuse over wrap                  | Base UI owns the image load/error machine                   |
 * | R19  | Tokens only                      | `bg-muted` on the fallback face                             |
 * | R25  | Client component                 | Required — Base UI Avatar ships client hooks                |
 *
 * No `MIN_VIEWPORT`: an avatar is a fixed-size inline object with no layout of
 * its own to break, so it declares no floor and projects no `data-min-viewport`.
 */

import * as React from 'react';
import { Avatar as BaseAvatar } from '@base-ui/react/avatar';

import { cn } from '../lib/cn.js';
import { Skeleton } from './skeleton.js';

type AvatarProps = React.ComponentProps<typeof BaseAvatar.Root> & {
  /**
   * When true, render a `<Skeleton variant="avatar" />` in place of the
   * normal Avatar surface. Idiomatic state-contract entry — the loading
   * silhouette is shape-matched (size-8 rounded-full — the same size the
   * Root renders) so the layout doesn't shift when the real image lands.
   */
  loading?: boolean;
};

function Avatar({ className, loading, ...props }: AvatarProps) {
  if (loading) {
    return (
      <Skeleton
        variant="avatar"
        data-slot="avatar"
        className={cn('size-8', className)}
      />
    );
  }
  return (
    <BaseAvatar.Root
      data-slot="avatar"
      className={cn(
        'relative flex size-8 shrink-0 overflow-hidden rounded-full',
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof BaseAvatar.Image>) {
  return (
    <BaseAvatar.Image
      data-slot="avatar-image"
      className={cn('aspect-square size-full', className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof BaseAvatar.Fallback>) {
  return (
    <BaseAvatar.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'bg-muted flex size-full items-center justify-center rounded-full text-xs font-medium',
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
