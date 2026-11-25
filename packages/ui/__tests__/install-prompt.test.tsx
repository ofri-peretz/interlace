/**
 * InstallPrompt: offered only where it can work, the browser's dialog behind
 * Install, the iOS Share steps, quiet after Not now and once installed.
 */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstallPrompt, isIosSafari, MIN_VIEWPORT, useInstallPrompt } from '../src/patterns/install-prompt.js';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const CHROME_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

function setUserAgent(ua: string, touchPoints = 5) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touchPoints, configurable: true });
}

function setStandalone(on: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: on && query.includes('standalone'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function offerInstall(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

beforeEach(() => {
  setUserAgent(ANDROID);
  setStandalone(false);
  window.localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as Navigator & { standalone?: boolean }).standalone;
});

describe('isIosSafari', () => {
  it('knows Safari on iPhone and iPad, and not other iOS browsers or a Mac', () => {
    expect(isIosSafari(IPHONE, 5)).toBe(true);
    expect(isIosSafari(IPAD_DESKTOP, 5)).toBe(true);
    expect(isIosSafari(IPAD_DESKTOP, 0)).toBe(false);
    expect(isIosSafari(CHROME_IOS, 5)).toBe(false);
    expect(isIosSafari(ANDROID, 5)).toBe(false);
    expect(isIosSafari('iPhone', 5)).toBe(false);
  });
});

describe('InstallPrompt', () => {
  it('shows nothing until the browser offers an install', () => {
    const { container } = render(<InstallPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('opens the browser dialog from Install and reports the choice', async () => {
    const onInstallChoice = vi.fn();
    render(<InstallPrompt icon={<svg />} className="extra" onInstallChoice={onInstallChoice} />);
    const event = offerInstall('accepted');
    expect(event.defaultPrevented).toBe(true);
    const region = screen.getByRole('region', { name: 'Install the app' });
    expect(region.getAttribute('data-platform')).toBe('prompt');
    expect(region.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(region.className).toContain('extra');
    expect(region.querySelector('[data-slot="install-prompt-icon"]')?.getAttribute('aria-hidden')).toBe('true');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    });
    expect(event.prompt).toHaveBeenCalled();
    expect(onInstallChoice).toHaveBeenCalledWith(true);
    // The prompt is spent: the offer goes away.
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('reports a dismissed dialog, and works without a callback', async () => {
    const onInstallChoice = vi.fn();
    const { rerender } = render(<InstallPrompt onInstallChoice={onInstallChoice} />);
    offerInstall('dismissed');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    });
    expect(onInstallChoice).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('region')).toBeNull();
    rerender(<InstallPrompt />);
    offerInstall('accepted');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    });
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('gives the Share steps on iOS Safari, in the page language', () => {
    setUserAgent(IPHONE);
    render(<InstallPrompt labels={{ title: 'Add to Home Screen', iosShare: 'Partager' }} />);
    const region = screen.getByRole('region', { name: 'Add to Home Screen' });
    expect(region.getAttribute('data-platform')).toBe('ios');
    expect(region.textContent).toContain('Tap');
    expect(region.textContent).toContain('Partager');
    expect(region.textContent).toContain('then Add to Home Screen.');
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
  });

  it('stays quiet after Not now, until the days pass', () => {
    setUserAgent(IPHONE);
    const { unmount } = render(<InstallPrompt storageKey="k" dismissDays={7} />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region')).toBeNull();
    unmount();
    render(<InstallPrompt storageKey="k" dismissDays={7} />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('comes back once the quiet days have passed', () => {
    setUserAgent(IPHONE);
    window.localStorage.setItem('k', String(Date.now() - 8 * 86_400_000));
    render(<InstallPrompt storageKey="k" dismissDays={7} />);
    expect(screen.getByRole('region')).toBeTruthy();
  });

  it('shows nothing in an installed app, or after the app is installed', () => {
    setUserAgent(IPHONE);
    setStandalone(true);
    const { container, unmount } = render(<InstallPrompt />);
    expect(container.innerHTML).toBe('');
    unmount();
    setStandalone(false);
    (navigator as Navigator & { standalone?: boolean }).standalone = true;
    const second = render(<InstallPrompt />);
    expect(second.container.innerHTML).toBe('');
    second.unmount();
    delete (navigator as Navigator & { standalone?: boolean }).standalone;
    setUserAgent(ANDROID);
    render(<InstallPrompt />);
    offerInstall();
    expect(screen.getByRole('region')).toBeTruthy();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('still works when storage is blocked', () => {
    setUserAgent(IPHONE);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<InstallPrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region')).toBeNull();
  });
});

describe('useInstallPrompt', () => {
  it('cannot install without a prompt, and says why', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.platform).toBeNull();
    expect(result.current.canInstall).toBe(false);
    await expect(result.current.install()).resolves.toBe(false);
  });

  it('reads a missing maxTouchPoints and matchMedia as none', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: undefined, configurable: true });
    const original = window.matchMedia;
    // @ts-expect-error: an old engine without matchMedia
    window.matchMedia = undefined;
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.installed).toBe(false);
    window.matchMedia = original;
  });
});
