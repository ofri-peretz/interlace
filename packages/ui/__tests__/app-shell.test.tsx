/**
 * The mobile app shell: AppShell's frame, TabBar's current tab and badges,
 * AppHeader's single heading and its scroll states, and AppHeaderBack.
 */
import { act, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { AppHeader, AppHeaderBack, MIN_VIEWPORT as HEADER_MIN } from '../src/patterns/app-header.js';
import { AppShell, MIN_VIEWPORT as SHELL_MIN } from '../src/patterns/app-shell.js';
import { isTabCurrent, MIN_VIEWPORT as TAB_MIN, TabBar, type TabBarItem } from '../src/patterns/tab-bar.js';

const Icon = () => <svg data-testid="icon" />;
const Filled = () => <svg data-testid="filled" />;

const ITEMS: TabBarItem[] = [
  { href: '/', label: 'Home', icon: <Icon /> },
  { href: '/answers', label: 'Answers', icon: <Icon />, activeIcon: <Filled /> },
  { href: '/answers/saved', label: 'Saved', icon: <Icon />, badge: 3, badgeLabel: '3 new' },
  { href: '/inbox', label: 'Inbox', icon: <Icon />, badge: true, badgeLabel: 'unread' },
  { href: '/me', label: 'Me', icon: <Icon />, badge: 120 },
];

describe('TabBar', () => {
  it('is a named nav of links, one current, marked in words and by data', () => {
    render(<TabBar items={ITEMS} currentHref="/answers/42?x=1" className="extra" />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav.className).toContain('extra');
    expect(nav.className).toContain('md:hidden');
    expect(nav.getAttribute('data-min-viewport')).toBe(String(TAB_MIN));
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
    const current = links.filter((l) => l.getAttribute('aria-current') === 'page');
    expect(current.map((l) => l.getAttribute('href'))).toEqual(['/answers']);
    expect(current[0]!.hasAttribute('data-active')).toBe(true);
    expect(current[0]!.querySelector('[data-testid="filled"]')).not.toBeNull();
  });

  it('prefers the deepest matching tab', () => {
    render(<TabBar items={ITEMS} currentHref="/answers/saved" />);
    expect(screen.getByRole('link', { current: 'page' }).getAttribute('href')).toBe('/answers/saved');
  });

  it('has no current tab without currentHref, and falls back to the plain icon', () => {
    render(<TabBar items={ITEMS} currentHref="/inbox" hideFrom="never" aria-label="Sections" />);
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(nav.className).not.toContain(':hidden');
    const inbox = screen.getByRole('link', { current: 'page' });
    expect(inbox.querySelector('[data-testid="icon"]')).not.toBeNull();
  });

  it('shows counts, caps them and reads the badge label', () => {
    const { container } = render(<TabBar items={ITEMS} hideFrom="lg" />);
    const badges = [...container.querySelectorAll('[data-slot="tab-bar-badge"]')];
    expect(badges.map((b) => b.textContent)).toEqual(['3', '', '99+']);
    expect(badges.every((b) => b.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(screen.getByRole('link', { name: /^Saved\s*,\s*3 new$/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /^Inbox\s*,\s*unread$/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Me' })).toBeTruthy();
    expect(screen.queryAllByRole('link', { current: 'page' })).toHaveLength(0);
    expect(container.querySelector('nav')!.className).toContain('lg:hidden');
  });

  it('hides a zero or false badge', () => {
    const { container } = render(
      <TabBar
        items={[
          { href: '/a', label: 'A', icon: <Icon />, badge: 0, badgeLabel: 'none' },
          { href: '/b', label: 'B', icon: <Icon />, badge: false },
        ]}
      />,
    );
    expect(container.querySelector('[data-slot="tab-bar-badge"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'A' })).toBeTruthy();
  });

  it('hands links to renderLink with aria-current and data attributes', () => {
    render(
      <TabBar
        items={ITEMS.slice(0, 2)}
        currentHref="/"
        renderLink={({ href, children, ...rest }) => (
          <a href={`#${href}`} data-router="" {...rest}>
            {children}
          </a>
        )}
      />,
    );
    const home = screen.getByRole('link', { name: 'Home' });
    expect(home.getAttribute('href')).toBe('#/');
    expect(home.getAttribute('aria-current')).toBe('page');
    expect(home.getAttribute('data-slot')).toBe('tab-bar-item');
    expect(home.hasAttribute('data-router')).toBe(true);
  });

  it('matches a tab to its page and its children only', () => {
    expect(isTabCurrent('/', '/')).toBe(true);
    expect(isTabCurrent('/', '/answers')).toBe(false);
    expect(isTabCurrent('/answers/', '/answers')).toBe(true);
    expect(isTabCurrent('/answers', '/answers#top')).toBe(true);
    expect(isTabCurrent('/answers', '/answersheet')).toBe(false);
    expect(isTabCurrent('/answers', undefined)).toBe(false);
  });
});

describe('AppHeader', () => {
  afterEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('is a header with start, one h1 title and end', () => {
    render(
      <AppHeader
        title="Answers"
        start={<AppHeaderBack href="/" label="Home" />}
        end={<button type="button">Search</button>}
        className="extra"
      />,
    );
    const header = screen.getByRole('banner');
    expect(header.className).toContain('extra');
    expect(header.getAttribute('data-min-viewport')).toBe(String(HEADER_MIN));
    expect(header.getAttribute('data-edge')).toBe('scroll');
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Answers']);
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
  });

  it('marks itself scrolled once the page moves, and cleans up on unmount', () => {
    const { unmount } = render(<AppHeader title="Feed" />);
    const header = screen.getByRole('banner');
    expect(header.hasAttribute('data-scrolled')).toBe(false);
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 40, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(header.hasAttribute('data-scrolled')).toBe(true);
    unmount();
    expect(header.hasAttribute('data-scrolled')).toBe(false);
  });

  it('with a large title reads the title once and collapses it into the bar', () => {
    render(<AppHeader title="Today" largeTitle titleAs="h2" />);
    const header = screen.getByRole('banner');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Today']);
    const small = header.querySelector('[data-slot="app-header-title"]')!;
    expect(small.getAttribute('aria-hidden')).toBe('true');
    const large = document.querySelector<HTMLElement>('[data-slot="app-header-large"]')!;
    header.getBoundingClientRect = () => ({ bottom: 56 }) as DOMRect;
    large.getBoundingClientRect = () => ({ bottom: 120 }) as DOMRect;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(header.hasAttribute('data-collapsed')).toBe(false);
    large.getBoundingClientRect = () => ({ bottom: 50 }) as DOMRect;
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(header.hasAttribute('data-collapsed')).toBe(true);
  });

  it('with edge="always" has its surface from the start and no scroll watcher', () => {
    const { container } = render(<AppHeader title="Settings" edge="always" titleAs="p" />);
    const header = screen.getByRole('banner');
    expect(header.className).toContain('bg-background/90');
    expect(container.querySelector('[data-slot="app-header-edge"]')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('keeps working when the watcher is rendered outside a header', async () => {
    const { AppHeaderEdge } = await import('../src/patterns/app-header-edge.js');
    const { container } = render(<AppHeaderEdge threshold={10} />);
    expect(container.querySelector('[data-slot="app-header-edge"]')).not.toBeNull();
  });
});

describe('AppHeaderBack', () => {
  it('can be an arrow alone, named by its label, through a router link', () => {
    render(
      <AppHeaderBack
        href="/answers"
        label="Answers"
        iconOnly
        renderLink={({ href, children, ...rest }) => (
          <a href={href} data-router="" {...rest}>
            {children}
          </a>
        )}
      />,
    );
    const link = screen.getByRole('link', { name: 'Answers' });
    expect(link.textContent).toBe('');
    expect(link.hasAttribute('data-router')).toBe(true);
    expect(link.querySelector('svg')!.getAttribute('class')).toContain('rtl:-scale-x-100');
  });

  it('defaults to the word Back', () => {
    render(<AppHeaderBack href="/" />);
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('data-slot')).toBe('app-header-back');
  });
});

describe('AppShell', () => {
  it('frames header, one focusable main and the tab bar, in order', () => {
    const { container } = render(
      <AppShell
        header={<AppHeader title="Home" />}
        tabBar={<TabBar items={ITEMS.slice(0, 3)} currentHref="/" />}
        className="extra"
        mainProps={{ className: 'gap-4', 'aria-busy': true }}
      >
        <p>Content</p>
      </AppShell>,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.getAttribute('data-slot')).toBe('app-shell');
    expect(shell.getAttribute('data-min-viewport')).toBe(String(SHELL_MIN));
    expect(shell.className).toContain('min-h-dvh');
    expect(shell.className).toContain('extra');
    const main = screen.getByRole('main');
    expect(main.id).toBe('main');
    expect(main.tabIndex).toBe(-1);
    expect(main.className).toContain('gap-4');
    expect(main.getAttribute('aria-busy')).toBe('true');
    const slots = [...shell.children].map((el) => el.getAttribute('data-slot'));
    expect(slots).toEqual(['app-header', 'app-shell-main', 'tab-bar']);
  });

  it('takes another main id and tab index', () => {
    render(
      <AppShell mainId="content" mainProps={{ tabIndex: 0 }}>
        x
      </AppShell>,
    );
    expect(screen.getByRole('main').id).toBe('content');
    expect(screen.getByRole('main').tabIndex).toBe(0);
  });
});
