/**
 * Presence and Swap. jsdom has no Web Animations, so these tests stub
 * `element.animate` with animations the test finishes by hand, and pin what
 * each component asks the browser for and what it renders at every step:
 * the leave before removal, one version of the content at a time, inert
 * content on its way out, focus that follows a swap, and the still path
 * under reduced motion.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

const { Presence, Swap } = await import('../src/effects/presence.js');

type FakeAnimation = {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  onfinish: (() => void) | null;
  cancel: ReturnType<typeof vi.fn>;
  reverse: ReturnType<typeof vi.fn>;
  finish: () => void;
};

let played: FakeAnimation[] = [];

function animate(this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  const animation: FakeAnimation = {
    keyframes,
    options,
    onfinish: null,
    cancel: vi.fn(),
    reverse: vi.fn(),
    finish: () => act(() => animation.onfinish?.()),
  };
  played.push(animation);
  return animation;
}

beforeEach(() => {
  reduced.value = false;
  played = [];
  (Element.prototype as unknown as { animate: unknown }).animate = animate;
});

afterEach(() => {
  delete (Element.prototype as unknown as { animate?: unknown }).animate;
  document.documentElement.style.removeProperty('--duration-medium');
  document.documentElement.style.removeProperty('--ease-enter');
});

const last = () => played.at(-1)!;

describe('Presence', () => {
  it('renders shown content on the server with no inline style, and nothing when hidden', () => {
    const html = renderToStaticMarkup(
      <Presence show effect="rise">
        Saved
      </Presence>,
    );
    expect(html).toBe('<div data-slot="presence" data-state="open" data-effect="rise">Saved</div>');
    expect(renderToStaticMarkup(<Presence show={false}>Saved</Presence>)).toBe('');
  });

  it('does not play on the first render unless asked to', () => {
    render(<Presence show>Hello</Presence>);
    expect(played).toHaveLength(0);
    render(
      <Presence show appear effect="scale">
        Hi
      </Presence>,
    );
    expect(played).toHaveLength(1);
    expect(last().keyframes).toEqual([
      { opacity: 0, transform: 'scale(0.96)' },
      { opacity: 1, transform: 'none' },
    ]);
  });

  it('arrives when shown, on the enter tokens', () => {
    const { rerender } = render(<Presence show={false}>Note</Presence>);
    expect(screen.queryByText('Note')).toBeNull();
    rerender(<Presence show>Note</Presence>);
    expect(screen.getByText('Note').dataset.state).toBe('open');
    expect(last().keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(last().options).toEqual({ duration: 250, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  });

  // jsdom does not inherit custom properties, so the tokens sit on the block itself.
  it('reads the brand motion tokens when it plays', () => {
    render(
      <Presence show appear style={{ '--duration-medium': '0.4s', '--ease-enter': 'linear' } as React.CSSProperties}>
        Tuned
      </Presence>,
    );
    expect(last().options).toEqual({ duration: 400, easing: 'linear' });
  });

  it('takes a token in milliseconds, and falls back when a token is not a time', () => {
    const first = render(
      <Presence show appear style={{ '--duration-medium': '320ms' } as React.CSSProperties}>
        Ms
      </Presence>,
    );
    expect(last().options).toMatchObject({ duration: 320 });
    first.unmount();
    render(
      <Presence show appear style={{ '--duration-medium': '2em' } as React.CSSProperties}>
        Em
      </Presence>,
    );
    expect(last().options).toMatchObject({ duration: 250 });
  });

  it('forgets an arrival once it has finished, so a later leave starts clean', () => {
    const { rerender } = render(
      <Presence show appear>
        Done
      </Presence>,
    );
    const arrival = last();
    arrival.finish();
    rerender(
      <Presence show={false} appear>
        Done
      </Presence>,
    );
    expect(arrival.cancel).not.toHaveBeenCalled();
    expect(last()).not.toBe(arrival);
  });

  it('ignores an arrival that ends after a leave took over', () => {
    const { rerender } = render(
      <Presence show appear>
        Late
      </Presence>,
    );
    const arrival = last();
    rerender(
      <Presence show={false} appear>
        Late
      </Presence>,
    );
    const leave = last();
    arrival.finish();
    expect(screen.getByText('Late').dataset.state).toBe('closed');
    leave.finish();
    expect(screen.queryByText('Late')).toBeNull();
  });

  it('stays, inert and hidden, while it leaves, then goes and reports it', () => {
    const onExited = vi.fn();
    const { rerender } = render(
      <Presence show onExited={onExited}>
        <button type="button">Undo</button>
      </Presence>,
    );
    rerender(
      <Presence show={false} onExited={onExited}>
        <button type="button">Undo</button>
      </Presence>,
    );
    const wrapper = document.querySelector<HTMLElement>('[data-slot="presence"]')!;
    expect(wrapper.dataset.state).toBe('closed');
    expect(wrapper.hasAttribute('inert')).toBe(true);
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
    expect(last().keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]);
    expect(last().options).toMatchObject({ duration: 150, fill: 'forwards' });
    expect(onExited).not.toHaveBeenCalled();
    last().finish();
    expect(document.querySelector('[data-slot="presence"]')).toBeNull();
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it('turns a leave around when shown again before it ends', () => {
    const { rerender } = render(<Presence show>Back</Presence>);
    rerender(<Presence show={false}>Back</Presence>);
    const leave = last();
    rerender(<Presence show>Back</Presence>);
    expect(leave.reverse).toHaveBeenCalledTimes(1);
    expect(leave.onfinish).toBeNull();
    expect(screen.getByText('Back').dataset.state).toBe('open');
  });

  it('appears and goes at once under reduced motion', () => {
    reduced.value = true;
    const onExited = vi.fn();
    const { rerender } = render(<Presence show={false}>Still</Presence>);
    rerender(<Presence show>Still</Presence>);
    expect(screen.getByText('Still')).toBeTruthy();
    rerender(
      <Presence show={false} onExited={onExited}>
        Still
      </Presence>,
    );
    expect(screen.queryByText('Still')).toBeNull();
    expect(onExited).toHaveBeenCalledTimes(1);
    expect(played).toHaveLength(0);
  });

  it('renders as the element it is given', () => {
    const html = renderToStaticMarkup(
      <ul>
        <Presence show render={<li />} className="row">
          One
        </Presence>
      </ul>,
    );
    expect(html).toContain('<li data-slot="presence" data-state="open" data-effect="fade" class="row">One</li>');
  });
});

describe('Swap', () => {
  it('renders one version on the server with no inline style', () => {
    const html = renderToStaticMarkup(
      <Swap swapKey="q1" effect="slide">
        Question one
      </Swap>,
    );
    expect(html).toBe('<div data-slot="swap" data-state="shown" data-effect="slide">Question one</div>');
  });

  it('keeps the old content, inert, until it has left, then shows the new one arriving', () => {
    const { rerender } = render(<Swap swapKey={1}>First</Swap>);
    rerender(<Swap swapKey={2}>Second</Swap>);
    const wrapper = document.querySelector<HTMLElement>('[data-slot="swap"]')!;
    expect(wrapper.textContent).toBe('First');
    expect(wrapper.dataset.state).toBe('leaving');
    expect(wrapper.hasAttribute('inert')).toBe(true);
    const leave = last();
    expect(leave.keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]);
    leave.finish();
    expect(wrapper.textContent).toBe('Second');
    expect(wrapper.dataset.state).toBe('shown');
    expect(wrapper.hasAttribute('inert')).toBe(false);
    expect(leave.cancel).toHaveBeenCalled();
    expect(last().keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
  });

  it('shows new children for the same key at once', () => {
    const { rerender } = render(<Swap swapKey="a">Score 1</Swap>);
    rerender(<Swap swapKey="a">Score 2</Swap>);
    expect(document.querySelector('[data-slot="swap"]')!.textContent).toBe('Score 2');
    expect(played).toHaveLength(0);
  });

  it('lands on the latest key when keys change during a leave', () => {
    const { rerender } = render(<Swap swapKey={1}>One</Swap>);
    rerender(<Swap swapKey={2}>Two</Swap>);
    const leave = last();
    rerender(<Swap swapKey={3}>Three</Swap>);
    expect(played).toHaveLength(1);
    leave.finish();
    expect(document.querySelector('[data-slot="swap"]')!.textContent).toBe('Three');
  });

  it('stays when the key comes back before the leave ends', () => {
    const { rerender } = render(<Swap swapKey={1}>One</Swap>);
    rerender(<Swap swapKey={2}>Two</Swap>);
    const leave = last();
    rerender(<Swap swapKey={1}>One again</Swap>);
    expect(leave.cancel).toHaveBeenCalled();
    expect(leave.onfinish).toBeNull();
    const wrapper = document.querySelector<HTMLElement>('[data-slot="swap"]')!;
    expect(wrapper.textContent).toBe('One again');
    expect(wrapper.dataset.state).toBe('shown');
  });

  it('slides along the reading direction, and the other way in a right-to-left page', () => {
    const { rerender } = render(
      <Swap swapKey={1} effect="slide">
        A
      </Swap>,
    );
    rerender(
      <Swap swapKey={2} effect="slide">
        B
      </Swap>,
    );
    expect(last().keyframes).toEqual([
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateX(-1.5rem)' },
    ]);
    last().finish();
    expect(last().keyframes[0]).toEqual({ opacity: 0, transform: 'translateX(1.5rem)' });

    played = [];
    const rtl = render(
      <div dir="rtl" style={{ direction: 'rtl' }}>
        <Swap swapKey={1} effect="slide" direction="back">
          A
        </Swap>
      </div>,
    );
    rtl.rerender(
      <div dir="rtl" style={{ direction: 'rtl' }}>
        <Swap swapKey={2} effect="slide" direction="back">
          B
        </Swap>
      </div>,
    );
    // Back in a right-to-left page: the old one leaves toward the inline end, which is the left.
    expect(last().keyframes[1]).toEqual({ opacity: 0, transform: 'translateX(-1.5rem)' });
    last().finish();
    expect(last().keyframes[0]).toEqual({ opacity: 0, transform: 'translateX(1.5rem)' });
  });

  it('hands focus to the new content when the old content held it', () => {
    const { rerender } = render(
      <Swap swapKey={1}>
        <button type="button">Next</button>
      </Swap>,
    );
    screen.getByRole('button', { name: 'Next' }).focus();
    rerender(
      <Swap swapKey={2}>
        <p>Question two</p>
      </Swap>,
    );
    last().finish();
    const wrapper = document.querySelector<HTMLElement>('[data-slot="swap"]')!;
    expect(document.activeElement).toBe(wrapper);
    expect(wrapper.tabIndex).toBe(-1);
    fireEvent.blur(wrapper);
    expect(wrapper.hasAttribute('tabindex')).toBe(false);
  });

  it('passes blur through to the app', () => {
    const onBlur = vi.fn();
    render(
      <Swap swapKey={1} onBlur={onBlur}>
        <button type="button">Inside</button>
      </Swap>,
    );
    fireEvent.blur(screen.getByRole('button', { name: 'Inside' }));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('leaves focus alone when it was elsewhere', () => {
    render(<button type="button">Outside</button>);
    const { rerender } = render(<Swap swapKey={1}>One</Swap>);
    screen.getByRole('button', { name: 'Outside' }).focus();
    rerender(<Swap swapKey={2}>Two</Swap>);
    last().finish();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Outside' }));
  });

  it('swaps at once under reduced motion', () => {
    reduced.value = true;
    const { rerender } = render(<Swap swapKey={1}>One</Swap>);
    rerender(<Swap swapKey={2}>Two</Swap>);
    expect(document.querySelector('[data-slot="swap"]')!.textContent).toBe('Two');
    expect(played).toHaveLength(0);
  });
});
