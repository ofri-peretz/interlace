'use client';

import * as React from 'react';
import { Check, Cloud, Copy, Briefcase, Send } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { Cluster } from '../primitives/stack.js';

/**
 * @interlace/ui — ShareButtons
 *
 * A compact "share this page" cluster: one ghost icon-button per social
 * network plus a copy-link affordance. Each share button opens its
 * network's prefilled share URL in a new tab; the copy button writes the
 * URL to the clipboard and flips its icon + aria-label to a brief
 * confirmation state for 1.5s before resetting.
 *
 * Client component — `navigator.clipboard.writeText` and the timed
 * confirmation toggle both require a browser runtime (R25).
 *
 * ## Anatomy
 *
 *   ShareButtons                       (Cluster — data-min-viewport=320)
 *     ├─ <a>   Button variant=ghost size=sm  (twitter — Twitter icon)
 *     ├─ <a>   Button variant=ghost size=sm  (bluesky — Cloud icon)
 *     ├─ <a>   Button variant=ghost size=sm  (linkedin — Linkedin icon)
 *     └─ <button> Button variant=ghost size=sm  (copy — Copy / Check icon)
 *
 * ## MIN_VIEWPORT — 320
 *
 * Share-on-mobile is the dominant share path. The ghost `size=sm` button
 * meets the WCAG 2.5.5 target-size floor on a 320 CSS-px iPhone SE, and
 * the cluster wraps so four buttons still fit on one row at that width.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends React.ComponentProps     | `React.ComponentProps<'div'> & ShareButtonsProps`           |
 * | R6   | data-slot on root                | `data-slot="share-buttons"`                                 |
 * | R7   | className merged + ...rest       | `cn(...) + {...props}` on the Cluster root                  |
 * | R8   | No isXxx; enums for variants     | `networks` is a string-union array, not booleans            |
 * | R10  | Composition seam                 | Built on Button + Cluster primitives                        |
 * | R13  | Ecosystem first                  | lucide-react icons; native `<a target="_blank">`            |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline style; primitives own all visual classes        |
 * | R19  | Tokens only                      | Spacing/typography inherited from Cluster + Button          |
 * | R20  | AA contrast                      | Ghost Button hover/focus uses semantic tokens               |
 * | R25  | Client component                 | `'use client'` — clipboard + `useState` toggle              |
 * | R26  | A11y from native el              | `aria-label` per button; copy state announces via aria-live |
 */

export const MIN_VIEWPORT = 320 as const;

export type ShareNetwork = 'twitter' | 'bluesky' | 'linkedin' | 'copy';

const DEFAULT_NETWORKS: readonly ShareNetwork[] = [
  'twitter',
  'bluesky',
  'linkedin',
  'copy',
];

const COPIED_RESET_MS = 1500;

type ShareButtonsProps = React.ComponentProps<'div'> & {
  /** The canonical URL being shared. */
  url: string;
  /** Page / post title — used as prefilled share text. */
  title: string;
  /**
   * Which networks to render and in what order. Defaults to all four:
   * `['twitter', 'bluesky', 'linkedin', 'copy']`.
   */
  networks?: ReadonlyArray<ShareNetwork>;
};

function buildShareHref(network: Exclude<ShareNetwork, 'copy'>, url: string, title: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  switch (network) {
    case 'twitter':
      return `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
    case 'bluesky':
      return `https://bsky.app/intent/compose?text=${t}%20${u}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
  }
}

const NETWORK_META: Record<
  Exclude<ShareNetwork, 'copy'>,
  { label: string; Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }> }
> = {
  twitter: { label: 'Share on Twitter', Icon: Send },
  bluesky: { label: 'Share on Bluesky', Icon: Cloud },
  linkedin: { label: 'Share on LinkedIn', Icon: Briefcase },
};

export function ShareButtons({
  className,
  url,
  title,
  networks = DEFAULT_NETWORKS,
  ...props
}: ShareButtonsProps) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = React.useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      // Silently no-op on permission denial; consumer can wrap to show a toast.
    }
  }, [url]);

  return (
    <Cluster
      gap="xs"
      align="center"
      data-slot="share-buttons"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(className)}
      {...props}
    >
      {networks.map((network) => {
        if (network === 'copy') {
          const CopyIcon = copied ? Check : Copy;
          const label = copied ? 'Copied!' : 'Copy link';
          return (
            <Button
              key="copy"
              type="button"
              variant="ghost"
              size="sm"
              aria-label={label}
              aria-live="polite"
              data-slot="share-copy"
              data-copied={copied ? 'true' : undefined}
              onClick={handleCopy}
            >
              <CopyIcon className="size-4" aria-hidden />
            </Button>
          );
        }
        const { label, Icon } = NETWORK_META[network];
        return (
          <Button
            key={network}
            variant="ghost"
            size="sm"
            aria-label={label}
            data-slot={`share-${network}`}
            render={
              <a
                href={buildShareHref(network, url, title)}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <Icon className="size-4" aria-hidden />
          </Button>
        );
      })}
    </Cluster>
  );
}
