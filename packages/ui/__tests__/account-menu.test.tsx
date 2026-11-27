/**
 * AccountMenu: three states, a named menu, a sign-out that may fail, and a root whose room
 * does not change between them. Axe runs on each state.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccountMenu, type AccountMenuProps } from '../src/patterns/account-menu.js';
import type { Account, AccountState } from '../src/patterns/account-menu-model.js';

afterEach(cleanup);

const dana: Account = {
  id: 'a1',
  firstName: 'Dana',
  lastName: 'Levi',
  email: 'dana@example.com',
  imageUrl: 'https://img.example/dana.png',
};
const signedIn = (account: Account = dana): AccountState => ({ status: 'signed-in', account });
const signedOut: AccountState = { status: 'signed-out' };
const unknown: AccountState = { status: 'unknown' };

const base = { signInHref: '/sign-in', onSignOut: () => {} };

function setup(props: Partial<AccountMenuProps> & { state: AccountState }) {
  return render(<AccountMenu {...base} {...props} />);
}

const root = () => document.querySelector<HTMLElement>('[data-slot="account-menu"]')!;
const trigger = () => screen.getByRole('button', { name: /Account menu for/ });

async function violations(container: Element) {
  const results = await axe.run(container as HTMLElement, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`);
}

describe('AccountMenu: unknown', () => {
  it('is an inert, hidden placeholder: nothing in the tree, nothing to focus', async () => {
    const user = userEvent.setup();
    setup({ state: unknown });
    const placeholder = document.querySelector('[data-slot="account-menu-placeholder"]')!;
    expect(root().getAttribute('data-state')).toBe('unknown');
    expect(placeholder.getAttribute('aria-hidden')).toBe('true');
    expect(placeholder.hasAttribute('inert')).toBe(true);
    expect(placeholder.className).toContain('invisible');
    expect(placeholder.textContent).toBe('');
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    await user.tab();
    expect(document.body).toBe(document.activeElement);
  });

  it('server-renders the placeholder, so there is no signed-out flash', () => {
    const html = renderToStaticMarkup(<AccountMenu {...base} state={unknown} />);
    expect(html).toContain('data-state="unknown"');
    expect(html).not.toContain('Sign in');
  });
});

describe('AccountMenu: signed out', () => {
  it('is a Sign in link that carries the page', () => {
    setup({ state: signedOut, here: '/pricing?plan=pro' });
    const link = screen.getByRole('link', { name: 'Sign in' });
    expect(link.getAttribute('href')).toBe('/sign-in?next=%2Fpricing%3Fplan%3Dpro');
    expect(link.getAttribute('data-slot')).toBe('account-menu-sign-in');
    expect(root().getAttribute('data-state')).toBe('signed-out');
  });

  it('does not carry the sign-in page itself', () => {
    setup({ state: signedOut, here: '/sign-in/' });
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/sign-in');
  });

  it('uses the label and the link seam it is given', () => {
    const renderLink = vi.fn(({ children, href, className }) => (
      <a href={href} className={className} data-router="yes">
        {children}
      </a>
    ));
    setup({ state: signedOut, labels: { signIn: 'Log in' }, renderLink });
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('data-router')).toBe('yes');
  });
});

describe('AccountMenu: signed in', () => {
  it('has a trigger named for the person, a picture that says nothing, and initials that are hidden', () => {
    setup({ state: signedIn() });
    const button = trigger();
    expect(button.getAttribute('aria-label')).toBe('Account menu for Dana');
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(root().getAttribute('data-account-id')).toBe('a1');
    const fallback = button.querySelector('[data-slot="avatar-fallback"]')!;
    expect(fallback.textContent).toBe('DL');
    expect(fallback.getAttribute('aria-hidden')).toBe('true');
  });

  it('loads the photo with no referrer and an empty alt', async () => {
    const original = globalThis.Image;
    class LoadedImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      referrerPolicy = '';
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    globalThis.Image = LoadedImage as unknown as typeof Image;
    try {
      setup({ state: signedIn() });
      const image = await waitFor(() => {
        const img = trigger().querySelector('img');
        expect(img).not.toBeNull();
        return img!;
      });
      expect(image.getAttribute('referrerpolicy')).toBe('no-referrer');
      expect(image.getAttribute('alt')).toBe('');
    } finally {
      globalThis.Image = original;
    }
  });

  it('shows initials when there is no photo, and ? with no name and no email', () => {
    setup({ state: signedIn({ id: 'x' }) });
    expect(trigger().getAttribute('aria-label')).toBe('Account menu for Your account');
    expect(trigger().querySelector('[data-slot="avatar-fallback"]')!.textContent).toBe('?');
  });

  it('opens with Enter, Space and ArrowDown, and closes with Escape back to the trigger', async () => {
    const user = userEvent.setup();
    setup({ state: signedIn(), links: [{ label: 'Your account', href: '/account' }] });
    for (const key of ['{Enter}', ' ', '{ArrowDown}']) {
      trigger().focus();
      await user.keyboard(key);
      expect(await screen.findByRole('menu')).toBeTruthy();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger()));
    }
  });

  it('opens on a header that is not an item, then the links, then Sign out', async () => {
    const user = userEvent.setup();
    setup({
      state: signedIn(),
      links: [
        { label: 'Your account', href: '/account' },
        { label: 'Billing', href: '/billing', icon: <svg data-testid="icon" /> },
      ],
    });
    await user.click(trigger());
    const menu = await screen.findByRole('menu');
    const header = menu.querySelector('[data-slot="account-menu-header"]')!;
    expect(header.textContent).toContain('Dana');
    expect(header.textContent).toContain('dana@example.com');
    expect(header.getAttribute('role')).toBeNull();
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Your account',
      'Billing',
      'Sign out',
    ]);
    expect(within(menu).getByTestId('icon')).toBeTruthy();
    // Arrow keys move over the items and never land on the header.
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toBe('Your account');
    await user.keyboard('{End}');
    expect(document.activeElement?.textContent).toBe('Sign out');
    await user.keyboard('{Home}');
    expect(document.activeElement?.textContent).toBe('Your account');
  });

  it('draws the links through renderLink, as links', async () => {
    const user = userEvent.setup();
    const renderLink = vi.fn(({ children, href, className }) => (
      <a href={href} className={className} data-router="yes">
        {children}
      </a>
    ));
    setup({ state: signedIn(), links: [{ label: 'Your account', href: '/account' }], renderLink });
    await user.click(trigger());
    const link = await screen.findByRole('menuitem', { name: 'Your account' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/account');
    expect(link.getAttribute('data-router')).toBe('yes');
  });

  it('omits the email line when there is none', async () => {
    const user = userEvent.setup();
    setup({ state: signedIn({ id: 'x', firstName: 'Dana' }) });
    await user.click(trigger());
    const header = (await screen.findByRole('menu')).querySelector('[data-slot="account-menu-header"]')!;
    expect(header.querySelectorAll('span')).toHaveLength(1);
  });

  it('has an empty polite live region at rest, so nothing is announced on load', () => {
    setup({ state: signedIn() });
    const live = document.querySelector('[data-slot="account-menu-live"]')!;
    expect(live.getAttribute('role')).toBe('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toBe('');
  });
});

describe('AccountMenu: sign out', () => {
  async function openAndSignOut(user: ReturnType<typeof userEvent.setup>) {
    await user.click(trigger());
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
  }

  it('is disabled and reads Signing out while it works, then closes when it succeeds', async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const onSignOut = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    setup({ state: signedIn(), onSignOut });
    await openAndSignOut(user);
    const item = await screen.findByRole('menuitem', { name: 'Signing out…' });
    expect(item.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('menu')).toBeTruthy();
    await act(async () => finish());
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('a second activation while it works does nothing, even in the same tick', async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const onSignOut = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    setup({ state: signedIn(), onSignOut });
    await user.click(trigger());
    const item = await screen.findByRole('menuitem', { name: 'Sign out' });
    act(() => {
      fireEvent.click(item);
      fireEvent.click(item);
    });
    expect(onSignOut).toHaveBeenCalledTimes(1);
    const working = await screen.findByRole('menuitem', { name: 'Signing out…' });
    await user.click(working);
    await user.keyboard('{Enter}');
    expect(onSignOut).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });

  it('works with a plain function that returns nothing', async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    setup({ state: signedIn(), onSignOut });
    await openAndSignOut(user);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('says it failed, once, in the live region, closes the menu, focuses the trigger and calls onError', async () => {
    const user = userEvent.setup();
    const failure = new Error('network');
    const onError = vi.fn();
    setup({ state: signedIn(), onSignOut: () => Promise.reject(failure), onError });
    await openAndSignOut(user);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    const live = document.querySelector('[data-slot="account-menu-live"]')!;
    await waitFor(() => expect(live.textContent).toBe('We could not sign you out. Try again.'));
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  it('a synchronous throw is a failure too, and onError is optional', async () => {
    const user = userEvent.setup();
    setup({
      state: signedIn(),
      onSignOut: () => {
        throw new Error('sync');
      },
    });
    await openAndSignOut(user);
    await waitFor(() =>
      expect(document.querySelector('[data-slot="account-menu-live"]')!.textContent).toContain('could not sign you out'),
    );
  });

  it('clears the message when the menu opens again, and lets the person try again', async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined);
    setup({ state: signedIn(), onSignOut, labels: { signOutFailed: 'Could not.' } });
    await openAndSignOut(user);
    const live = document.querySelector('[data-slot="account-menu-live"]')!;
    await waitFor(() => expect(live.textContent).toBe('Could not.'));
    await user.click(trigger());
    await screen.findByRole('menu');
    expect(live.textContent).toBe('');
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(onSignOut).toHaveBeenCalledTimes(2);
  });

  it('takes its words from labels', async () => {
    const user = userEvent.setup();
    setup({
      state: signedIn(),
      labels: { menu: (name) => `Compte de ${name}`, signOut: 'Se déconnecter', fallbackName: 'Compte' },
    });
    const button = screen.getByRole('button', { name: 'Compte de Dana' });
    await user.click(button);
    expect(await screen.findByRole('menuitem', { name: 'Se déconnecter' })).toBeTruthy();
  });
});

describe('AccountMenu: the bar does not move', () => {
  const room = (state: AccountState) => {
    const { unmount } = setup({ state });
    const r = root();
    const result = { min: r.style.minInlineSize, layout: r.className };
    unmount();
    return result;
  };

  it('keeps the same reserved room in all three states', () => {
    const states = [unknown, signedOut, signedIn()].map(room);
    expect(states[0]!.min).toBe('var(--account-menu-room, 4.5rem)');
    expect(new Set(states.map((s) => s.min)).size).toBe(1);
    expect(new Set(states.map((s) => s.layout)).size).toBe(1);
    expect(states[0]!.layout).toContain('justify-end');
  });

  it('keeps the room when the state changes in place', () => {
    const { rerender } = setup({ state: unknown });
    const element = root();
    const before = element.style.minInlineSize;
    rerender(<AccountMenu {...base} state={signedOut} />);
    expect(root()).toBe(element);
    rerender(<AccountMenu {...base} state={signedIn()} />);
    expect(root()).toBe(element);
    expect(element.style.minInlineSize).toBe(before);
  });

  it('lets an app pass its own className and style through', () => {
    setup({ state: signedOut, className: 'extra', style: { color: 'red' }, id: 'acct' });
    expect(root().className).toContain('extra');
    expect(root().style.color).toBe('red');
    expect(root().id).toBe('acct');
    expect(root().style.minInlineSize).toContain('--account-menu-room');
  });
});

describe('AccountMenu: axe', () => {
  it.each([
    ['unknown', unknown],
    ['signed out', signedOut],
    ['signed in', signedIn()],
    ['signed in, no photo', signedIn({ id: 'x', firstName: 'Dana' })],
    ['signed in, nothing known', signedIn({ id: 'y' })],
  ] as const)('finds nothing in %s', async (_name, state) => {
    const { container } = setup({ state });
    expect(await violations(container)).toEqual([]);
  });

  it('finds nothing with the menu open', async () => {
    const user = userEvent.setup();
    setup({ state: signedIn(), links: [{ label: 'Your account', href: '/account' }] });
    await user.click(trigger());
    const menu = await screen.findByRole('menu');
    await act(async () => {});
    await act(async () => {});
    expect(await violations(menu.parentElement ?? menu)).toEqual([]);
  });
});
