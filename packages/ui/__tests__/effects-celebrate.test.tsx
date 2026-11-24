/**
 * Celebrate: plays once per change, never on load, never under reduced
 * motion; CelebrateCheck draws in; vibrate is opt-in and safe everywhere.
 */
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({ useReducedMotion: () => reduced.value }));

const { Celebrate, CelebrateCheck, HAPTICS, vibrate } = await import('../src/effects/celebrate.js');

const animate = vi.fn();
const orig = { html: HTMLElement.prototype.animate, svg: SVGElement.prototype.animate };

beforeEach(() => {
  reduced.value = false;
  animate.mockClear();
  HTMLElement.prototype.animate = animate as unknown as typeof orig.html;
  SVGElement.prototype.animate = animate as unknown as typeof orig.svg;
});
afterEach(() => {
  cleanup();
  HTMLElement.prototype.animate = orig.html;
  SVGElement.prototype.animate = orig.svg;
  vi.unstubAllGlobals();
});

describe('Celebrate', () => {
  it('plays on a new truthy value, not on mount', () => {
    const { rerender, container } = render(<Celebrate play={3}>7</Celebrate>);
    expect(animate).not.toHaveBeenCalled();
    expect(container.querySelector('[data-slot="celebrate-burst"]')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('[data-slot="celebrate-ray"]')).toHaveLength(12);
    rerender(<Celebrate play={3}>7</Celebrate>);
    expect(animate).not.toHaveBeenCalled();
    rerender(<Celebrate play={4}>7</Celebrate>);
    expect(animate).toHaveBeenCalledTimes(13);
    rerender(<Celebrate play={null}>7</Celebrate>);
    expect(animate).toHaveBeenCalledTimes(13);
  });

  it('stays still under reduced motion but can still vibrate', () => {
    reduced.value = true;
    const vib = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate: vib });
    const { rerender } = render(<Celebrate play={false} tone="success" rays={40} haptic="milestone" />);
    rerender(<Celebrate play tone="success" rays={40} haptic="milestone" />);
    expect(animate).not.toHaveBeenCalled();
    expect(vib).toHaveBeenCalledWith([...HAPTICS.milestone]);
  });

  it('skips elements without the Web Animations API', () => {
    HTMLElement.prototype.animate = undefined as unknown as typeof orig.html;
    const { rerender, container } = render(<Celebrate play="a" rays={0} tone="highlight" />);
    rerender(<Celebrate play="b" rays={0} tone="highlight" />);
    expect(container.querySelectorAll('[data-slot="celebrate-ray"]')).toHaveLength(0);
  });
});

describe('vibrate', () => {
  it('is a no-op without the API and survives a throwing one', () => {
    vi.stubGlobal('navigator', {});
    expect(vibrate()).toBe(false);
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('blocked');
      },
    });
    expect(vibrate([5])).toBe(false);
    const vib = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate: vib });
    expect(vibrate('success')).toBe(true);
    expect(vib).toHaveBeenCalledWith([12, 60, 18]);
  });
});

describe('CelebrateCheck', () => {
  it('draws in on mount and is named when labelled', () => {
    render(<CelebrateCheck label="Done" size="lg" />);
    expect(screen.getByRole('img', { name: 'Done' })).toBeTruthy();
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it('is hidden without a label and still without motion', () => {
    const { container } = render(<CelebrateCheck animate={false} tone="primary" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    reduced.value = true;
    render(<CelebrateCheck />);
    expect(animate).not.toHaveBeenCalled();
    reduced.value = false;
    SVGElement.prototype.animate = undefined as unknown as typeof orig.svg;
    render(<CelebrateCheck size="sm" />);
    expect(animate).not.toHaveBeenCalled();
  });
});
