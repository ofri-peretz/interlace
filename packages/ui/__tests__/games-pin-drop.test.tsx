/**
 * PinDrop and PinMap: a pin on a picture, "Where is it?" with an answer and
 * "Where are you?" without one.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

if (typeof window.PointerEvent === 'undefined') {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
}

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

const { cleanPins, nudgePin, pinDistance, pinPoints, pinSpread, regionOf } =
  await import('../src/games/pin-drop-model.js');
const { PinDrop, PinMap, MIN_VIEWPORT } = await import('../src/games/pin-drop.js');

afterEach(() => {
  cleanup();
  reduced.value = false;
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
  delete (SVGElement.prototype as { animate?: unknown }).animate;
});

const REGIONS = [
  { label: 'the harbour', box: [0, 50, 45, 100] as const },
  { label: 'the hill', box: [60, 0, 100, 40] as const },
];
const SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E';

describe('pin-drop-model', () => {
  it('keeps pins that make sense, held to the picture', () => {
    expect(
      cleanPins([
        { x: 10, y: 20 },
        { x: -5, y: 120 },
        { x: Number.NaN, y: 1 },
        null as unknown as { x: number; y: number },
      ]),
    ).toEqual([
      { x: 10, y: 20 },
      { x: 0, y: 100 },
    ]);
  });

  it('measures distance in widths, correcting for the picture’s shape', () => {
    expect(pinDistance({ x: 0, y: 0 }, { x: 30, y: 40 })).toBe(50);
    // On a 2:1 picture, 40% of the height is 20% of the width.
    expect(pinDistance({ x: 0, y: 0 }, { x: 0, y: 40 }, 2)).toBe(20);
    expect(pinDistance({ x: 0, y: 0 }, { x: 0, y: 40 }, 0)).toBe(40);
  });

  it('pays all on the spot, nothing far away, and a straight line between', () => {
    expect(pinPoints(2)).toBe(1000);
    expect(pinPoints(40)).toBe(0);
    expect(pinPoints(21.5)).toBe(500);
    expect(pinPoints(Number.NaN)).toBe(0);
    expect(pinPoints(1, { max: 0 })).toBe(0);
    expect(pinPoints(5, { exact: 10, radius: 10 })).toBe(1000);
    expect(pinPoints(12, { exact: 10, radius: 10 })).toBe(0);
  });

  it('names the region a pin is in', () => {
    expect(regionOf({ x: 10, y: 80 }, REGIONS)?.label).toBe('the harbour');
    expect(regionOf({ x: 50, y: 50 }, REGIONS)).toBeNull();
    expect(regionOf({ x: 50, y: 50 })).toBeNull();
  });

  it('moves a pin by keys, physically, never off the picture', () => {
    const p = { x: 50, y: 50 };
    expect(nudgePin(p, 'ArrowRight')).toEqual({ x: 55, y: 50 });
    expect(nudgePin(p, 'ArrowLeft', 1)).toEqual({ x: 49, y: 50 });
    expect(nudgePin(p, 'ArrowUp')).toEqual({ x: 50, y: 45 });
    expect(nudgePin(p, 'ArrowDown')).toEqual({ x: 50, y: 55 });
    expect(nudgePin(p, 'Home')).toEqual({ x: 0, y: 50 });
    expect(nudgePin(p, 'End')).toEqual({ x: 100, y: 50 });
    expect(nudgePin(p, 'PageUp')).toEqual({ x: 50, y: 0 });
    expect(nudgePin(p, 'PageDown')).toEqual({ x: 50, y: 100 });
    expect(nudgePin({ x: 98, y: 0 }, 'ArrowRight')).toEqual({ x: 100, y: 0 });
    expect(nudgePin(p, 'a')).toBeNull();
  });

  it('finds the middle and how close the room came', () => {
    const pins = [
      { x: 10, y: 10 },
      { x: 20, y: 30 },
      { x: 90, y: 20 },
      { x: 21, y: 31 },
    ];
    expect(pinSpread(pins)).toEqual({ count: 4, middle: { x: 20.5, y: 25 }, medianDistance: null, onSpot: 0 });
    const s = pinSpread(pins.slice(0, 3), { answer: { x: 20, y: 30 } });
    expect(s.onSpot).toBe(1);
    expect(s.medianDistance).toBeCloseTo(Math.hypot(10, 20));
    expect(pinSpread([])).toEqual({ count: 0, middle: null, medianDistance: null, onSpot: 0 });
    expect(pinSpread(pins, { answer: { x: Number.NaN, y: 0 } }).medianDistance).toBeNull();
  });
});

describe('PinDrop', () => {
  it('moves the pin by keys, says where it is in words, and places it once', () => {
    const onPlace = vi.fn();
    const { container } = render(
      <PinDrop prompt="Where is the lighthouse?" src={SRC} alt="An island" regions={REGIONS} onPlace={onPlace} />,
    );
    const root = container.querySelector('[data-slot="pin-drop"]') as HTMLElement;
    expect(root.dataset.state).toBe('placing');
    expect(root.dataset.minViewport).toBe(String(MIN_VIEWPORT));
    expect(screen.getByRole('group', { name: 'Where is the lighthouse?' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'An island' })).toBeTruthy();
    const pin = screen.getByRole('button', { name: '50% across, 50% down' });
    fireEvent.keyDown(pin, { key: 'ArrowLeft' });
    fireEvent.keyDown(pin, { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(pin, { key: 'PageDown' });
    fireEvent.keyDown(pin, { key: 'x' });
    expect(pin.getAttribute('aria-label')).toBe('In the harbour');
    expect(container.querySelector('[data-slot="pin-drop-announce"]')?.textContent).toBe('In the harbour');
    fireEvent.click(screen.getByRole('button', { name: 'Place my pin' }));
    expect(onPlace).toHaveBeenCalledWith({ x: 44, y: 100 });
    expect(root.dataset.state).toBe('placed');
    const result = container.querySelector('[data-slot="pin-drop-result"]') as HTMLElement;
    expect(result.textContent).toBe('Placed: In the harbour. 1 pin so far.');
    expect(document.activeElement).toBe(result);
  });

  it('follows a tap and a drag on the picture', () => {
    const { container } = render(<PinDrop prompt="Q" src={SRC} alt="A" />);
    const pad = container.querySelector('[data-slot="pin-drop-pad"]') as HTMLElement;
    pad.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;
    fireEvent.pointerDown(pad, { clientX: 50, clientY: 25, pointerId: 1 });
    expect(screen.getByRole('button', { name: '25% across, 25% down' })).toBeTruthy();
    fireEvent.pointerMove(pad, { clientX: 300, clientY: 50, pointerId: 1 });
    expect(screen.getByRole('button', { name: '100% across, 50% down' })).toBeTruthy();
    fireEvent.pointerUp(pad, { pointerId: 1 });
    fireEvent.pointerMove(pad, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(screen.getByRole('button', { name: '100% across, 50% down' })).toBeTruthy();
    fireEvent.pointerCancel(pad, { pointerId: 1 });
    expect(screen.getByRole('button', { name: '100% across, 50% down' })).toBeTruthy();
    pad.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect;
    fireEvent.pointerDown(pad, { clientX: 5, clientY: 5, pointerId: 1 });
    expect(screen.getByRole('button', { name: '100% across, 50% down' })).toBeTruthy();
  });

  it('waits for the answer, then reveals it with the distance, points and motion', () => {
    const animate = vi.fn();
    (HTMLElement.prototype as { animate?: unknown }).animate = animate;
    (SVGElement.prototype as { animate?: unknown }).animate = animate;
    const answer = { x: 80, y: 20 };
    const props = { prompt: 'Q', src: SRC, alt: 'A', aspect: 1, regions: REGIONS, answer, pins: [{ x: 10, y: 10 }] };
    const { container, rerender } = render(<PinDrop {...props} />);
    const pin = screen.getByRole('button', { name: '50% across, 50% down' });
    fireEvent.keyDown(pin, { key: 'End' });
    fireEvent.keyDown(pin, { key: 'PageUp' });
    fireEvent.click(screen.getByRole('button', { name: 'Place my pin' }));
    const result = container.querySelector('[data-slot="pin-drop-result"]') as HTMLElement;
    expect(result.textContent).toBe('Placed. Waiting for the answer.');
    // Before the reveal, nobody's pins are drawn and the answer is not in the page.
    expect(container.querySelectorAll('[data-slot="pin-drop-room"]')).toHaveLength(0);
    expect(container.querySelector('[data-slot="pin-drop-answer"]')).toBeNull();
    // The pin dropped in.
    expect(animate).toHaveBeenCalledTimes(1);
    rerender(<PinDrop {...props} revealed />);
    expect((container.querySelector('[data-slot="pin-drop"]') as HTMLElement).dataset.state).toBe('revealed');
    // From (100, 0) to (80, 20): about 28% of the width away.
    expect(result.textContent).toBe('It was in the hill. You were 28% of the picture away. +317 points.');
    expect(document.activeElement).toBe(result);
    expect(container.querySelector('[data-slot="pin-drop-gap"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="pin-drop-room"]')).toHaveLength(2);
    // Room fade (2), answer scale, gap fade, on top of the drop.
    expect(animate.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it('says on the spot, and keeps a restored reveal still and unfocused', () => {
    reduced.value = true;
    const animate = vi.fn();
    (HTMLElement.prototype as { animate?: unknown }).animate = animate;
    const { container } = render(
      <PinDrop
        prompt="Q"
        src={SRC}
        alt="A"
        value={{ x: 80, y: 21 }}
        answer={{ x: 80, y: 20 }}
        revealed
        pins={[{ x: 80, y: 21 }]}
        pinsIncludeOwn
      />,
    );
    expect(container.querySelector('[data-slot="pin-drop-result"]')?.textContent).toBe(
      'It was at 80% across, 20% down. You were on the spot. +1,000 points.',
    );
    expect(document.activeElement).toBe(document.body);
    expect(animate).not.toHaveBeenCalled();
  });

  it('counts the room without an answer, and ignores a pin that makes no sense', () => {
    const { container, rerender } = render(
      <PinDrop
        prompt="Q"
        src={SRC}
        alt="A"
        value={{ x: 10, y: 10 }}
        pins={[{ x: 1, y: 1 }]}
        labels={{ placed: (w, n) => `${w}|${n}` }}
      />,
    );
    expect(container.querySelector('[data-slot="pin-drop-result"]')?.textContent).toBe('10% across, 10% down|2');
    rerender(<PinDrop prompt="Q" src={SRC} alt="A" value={{ x: Number.NaN, y: 0 }} />);
    expect((container.querySelector('[data-slot="pin-drop"]') as HTMLElement).dataset.state).toBe('placing');
  });

  it('leaves focus elsewhere on the page alone on the reveal', () => {
    const props = {
      prompt: 'Q',
      src: SRC,
      alt: 'A',
      value: { x: 1, y: 1 },
      answer: { x: 99, y: 99 },
      aspect: Number.NaN,
    };
    const { rerender } = render(
      <>
        <button type="button">Elsewhere</button>
        <PinDrop {...props} />
      </>,
    );
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    elsewhere.focus();
    rerender(
      <>
        <button type="button">Elsewhere</button>
        <PinDrop {...props} revealed />
      </>,
    );
    expect(document.activeElement).toBe(elsewhere);
    expect(screen.getByText(/\+0 points/)).toBeTruthy();
  });
});

describe('PinMap', () => {
  it('shows every pin and, once revealed, the answer and how many were on the spot', () => {
    const pins = [
      { x: 10, y: 10 },
      { x: 50, y: 50 },
      { x: 51, y: 50 },
    ];
    const { container, rerender } = render(<PinMap src={SRC} pins={pins} answer={{ x: 50, y: 50 }} locale="en-US" />);
    const map = container.querySelector('[data-slot="pin-map"]') as HTMLElement;
    expect(map.dataset.state).toBe('open');
    expect(container.querySelectorAll('[data-slot="pin-drop-room"]')).toHaveLength(3);
    expect(container.querySelector('[data-slot="pin-drop-answer"]')).toBeNull();
    expect(screen.getByText('3 pins.')).toBeTruthy();
    rerender(<PinMap src={SRC} pins={pins} answer={{ x: 50, y: 50 }} revealed size="stage" aspect={-1} />);
    expect(map.dataset.state).toBe('revealed');
    expect(screen.getByText('3 pins. 2 on the spot.')).toBeTruthy();
    rerender(<PinMap src={SRC} pins={[{ x: 1, y: 1 }]} labels={{ summary: (n) => `n=${n}` }} />);
    expect(screen.getByText('n=1')).toBeTruthy();
    rerender(<PinMap src={SRC} pins={[{ x: 1, y: 1 }]} />);
    expect(screen.getByText('1 pin.')).toBeTruthy();
  });
});
