'use client';

/**
 * @interlace/ui — InstallPrompt, useInstallPrompt
 *
 * An offer to add the site to the home screen, made once, politely, and
 * only where it can work. Browsers that support it hand over their install
 * dialog (`beforeinstallprompt`), and the Install button opens it. Safari on
 * an iPhone or iPad has no such dialog, so the offer says how instead: the
 * Share button, then Add to Home Screen. Nothing shows when the page is
 * already running as an installed app, after it is installed, or for
 * `dismissDays` after the reader says Not now.
 *
 * `useInstallPrompt()` gives the same state to a control of your own, such
 * as an Install item in a settings list.
 *
 * ## Anatomy
 *
 *   <section data-slot="install-prompt" data-platform="prompt|ios" aria-labelledby>
 *     <span data-slot="install-prompt-icon">{icon}</span>
 *     <div><h2>{title}</h2><p>{description | iOS steps}</p></div>
 *     <div data-slot="install-prompt-actions">[Install] [Not now]</div>
 *   </section>
 *
 * ## Motion
 *
 * It rises 8px and fades in (200ms, `--ease-enter`) when it appears, never
 * on first paint (it only appears after the browser offers the install), and
 * is simply there under reduced motion.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The actions sit under the words in a narrow container and beside them
 * from 28rem (`@container`).
 *
 * | Rule | Concept                 | Where in this file                              |
 * | ---- | ----------------------- | ----------------------------------------------- |
 * | R4   | Extends native el       | `React.ComponentProps<'section'>`               |
 * | R6   | data-slot per part      | install-prompt, -icon, -actions                 |
 * | R7   | className merged + rest | `cn(BASE, className)` + `{...props}`            |
 * | R14  | Declares min viewport   | `data-min-viewport` + exported const            |
 * | R25  | Client component        | browser install events, storage                 |
 * | R26  | A11y                    | a named region, real buttons, words not icons   |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';

export const MIN_VIEWPORT = 320 as const;

/** The event Chromium browsers fire when the page can be installed. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'prompt' | 'ios' | null;

export interface UseInstallPromptOptions {
  /** Where the Not now choice is remembered (localStorage). @default 'interlace:install-dismissed' */
  storageKey?: string;
  /** Days to stay quiet after Not now. @default 30 */
  dismissDays?: number;
}

export interface InstallPromptState {
  /** How this browser installs: its own dialog, the iOS Share sheet, or not at all. */
  platform: InstallPlatform;
  /** The page runs as an installed app (standalone display mode). */
  installed: boolean;
  /** Whether to offer the install: possible here, not installed, not recently dismissed. */
  canInstall: boolean;
  /** Open the browser's install dialog. Resolves to whether the reader accepted. */
  install: () => Promise<boolean>;
  /** Not now: stay quiet for `dismissDays`. */
  dismiss: () => void;
}

const DAY = 86_400_000;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or storage off: the offer just comes back next visit.
  }
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** Safari on iOS and iPadOS, which installs from the Share sheet only. */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  const ios = /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent);
  return ios && !otherBrowser && /Safari\//.test(userAgent);
}

export function useInstallPrompt({
  storageKey = 'interlace:install-dismissed',
  dismissDays = 30,
}: UseInstallPromptOptions = {}): InstallPromptState {
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = React.useState(false);
  const [installed, setInstalled] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(true);

  React.useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIosSafari(navigator.userAgent, navigator.maxTouchPoints ?? 0));
    const at = Number(readStorage(storageKey));
    setDismissed(Number.isFinite(at) && at > 0 && Date.now() - at < dismissDays * DAY);
    const onPrompt = (event: Event) => {
      // Keep the browser's mini-bar away; the offer is ours to make.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [storageKey, dismissDays]);

  const platform: InstallPlatform = deferred ? 'prompt' : ios ? 'ios' : null;

  const install = React.useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // A prompt can be used once.
    setDeferred(null);
    return outcome === 'accepted';
  }, [deferred]);

  const dismiss = React.useCallback(() => {
    writeStorage(storageKey, String(Date.now()));
    setDismissed(true);
  }, [storageKey]);

  return { platform, installed, canInstall: platform !== null && !installed && !dismissed, install, dismiss };
}

export interface InstallPromptLabels {
  /** @default 'Install the app' */
  title: string;
  /** @default 'Open it from your home screen, full screen, like any other app.' */
  description: string;
  /** @default 'Install' */
  install: string;
  /** @default 'Not now' */
  dismiss: string;
  /** Before the Share icon on iOS. @default 'Tap' */
  iosBefore: string;
  /** The Share icon's name on iOS. @default 'Share' */
  iosShare: string;
  /** After the Share icon on iOS. @default 'then Add to Home Screen.' */
  iosAfter: string;
}

const LABELS: InstallPromptLabels = {
  title: 'Install the app',
  description: 'Open it from your home screen, full screen, like any other app.',
  install: 'Install',
  dismiss: 'Not now',
  iosBefore: 'Tap',
  iosShare: 'Share',
  iosAfter: 'then Add to Home Screen.',
};

export interface InstallPromptProps
  extends Omit<React.ComponentProps<'section'>, 'title'>,
    UseInstallPromptOptions {
  /** The app's icon, decorative. */
  icon?: React.ReactNode;
  /** Words, in the page's language. */
  labels?: Partial<InstallPromptLabels>;
  /** After the reader answers the browser's dialog. */
  onInstallChoice?: (accepted: boolean) => void;
}

const ShareIcon = () => (
  <svg
    aria-hidden
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="inline size-4 align-[-0.125em]"
  >
    <path d="M12 3v12" />
    <path d="m8 7 4-4 4 4" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);

function InstallPrompt({
  icon,
  labels: labelsProp,
  storageKey,
  dismissDays,
  onInstallChoice,
  className,
  ...props
}: InstallPromptProps) {
  const labels = { ...LABELS, ...labelsProp };
  const { platform, canInstall, install, dismiss } = useInstallPrompt({ storageKey, dismissDays });
  const titleId = React.useId();
  if (!canInstall) return null;
  return (
    <section
      data-slot="install-prompt"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-platform={platform}
      aria-labelledby={titleId}
      className={cn(
        '@container bg-card text-card-foreground border-border rounded-lg border p-4 shadow-sm',
        'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-(--duration-medium) motion-safe:ease-enter',
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-3 @md:flex-row @md:items-center">
        <div className="flex min-w-0 flex-1 gap-3">
          {icon ? (
            <span
              aria-hidden
              data-slot="install-prompt-icon"
              className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md [&_img]:size-full [&_svg]:size-6"
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold">
              {labels.title}
            </h2>
            <p className="text-muted-foreground text-sm">
              {platform === 'ios' ? (
                <>
                  {labels.iosBefore} <ShareIcon />
                  <span className="text-foreground font-medium"> {labels.iosShare}</span> {labels.iosAfter}
                </>
              ) : (
                labels.description
              )}
            </p>
          </div>
        </div>
        <div data-slot="install-prompt-actions" className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={dismiss}>
            {labels.dismiss}
          </Button>
          {platform === 'prompt' ? (
            <Button
              size="sm"
              onClick={async () => {
                // Call install() first: `onInstallChoice?.(await install())` would skip it.
                const accepted = await install();
                onInstallChoice?.(accepted);
              }}
            >
              {labels.install}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
InstallPrompt.displayName = 'InstallPrompt';

export { InstallPrompt };
