/**
 * ChoiceCard. Base UI owns the radio and checkbox behaviour; these tests pin
 * what this file adds on top: the role each `type` gives a tile, the name and
 * description a screen reader hears, picking by pointer and keyboard, the
 * values reported and posted with a form, and the markup a server renders.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ChoiceCard, ChoiceCardGroup, MIN_VIEWPORT } from '../src/primitives/choice-card.js';

// jsdom has no PointerEvent; Base UI's radio and checkbox build one on click.
if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = class extends MouseEvent {} as unknown as typeof PointerEvent;
}

const Single = (props: Partial<React.ComponentProps<typeof ChoiceCardGroup>>) => (
  <ChoiceCardGroup aria-label="Shape" {...(props as object)}>
    <ChoiceCard value="triangle" title="Triangle" description="Three sides" />
    <ChoiceCard value="square" title="Square" description="Four sides" />
    <ChoiceCard value="circle" title="Circle" disabled />
  </ChoiceCardGroup>
);

describe('ChoiceCard, one pick', () => {
  it('is a radio group whose tiles are named by their title and described by their line', () => {
    render(<Single />);
    expect(screen.getByRole('radiogroup', { name: 'Shape' })).toBeTruthy();
    const triangle = screen.getByRole('radio', { name: 'Triangle' });
    expect(triangle.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(triangle.getAttribute('aria-describedby')!)!.textContent).toBe('Three sides');
    expect(screen.getByRole('radio', { name: 'Circle' }).hasAttribute('aria-describedby')).toBe(false);
    expect(triangle.hasAttribute('aria-readonly')).toBe(false);
  });

  it('picks by click and reports the value', async () => {
    const onValueChange = vi.fn();
    render(<Single onValueChange={onValueChange} />);
    await userEvent.click(screen.getByText('Square'));
    expect(onValueChange).toHaveBeenCalledWith('square');
    const square = screen.getByRole('radio', { name: 'Square' });
    expect(square.getAttribute('aria-checked')).toBe('true');
    expect(square.hasAttribute('data-checked')).toBe(true);
  });

  it('moves the pick with the arrow keys and skips a disabled tile', async () => {
    const onValueChange = vi.fn();
    render(<Single defaultValue="triangle" onValueChange={onValueChange} />);
    screen.getByRole('radio', { name: 'Triangle' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onValueChange).toHaveBeenLastCalledWith('square');
    await userEvent.keyboard('{ArrowDown}');
    expect(onValueChange).toHaveBeenLastCalledWith('triangle');
  });

  it('shows a round indicator, hidden from assistive technology', () => {
    render(<Single />);
    const indicator = document.querySelector('[data-slot="choice-card-indicator"]')!;
    expect(indicator.getAttribute('aria-hidden')).toBe('true');
    expect(indicator.className).toContain('rounded-full');
  });

  it('renders valid markup on the server, every part a span, with its layout and viewport', () => {
    const html = renderToStaticMarkup(
      <ChoiceCardGroup aria-label="Size" layout="list">
        <ChoiceCard value="s" title="Small" media={<svg aria-hidden="true" />} />
      </ChoiceCardGroup>,
    );
    expect(html).toContain('data-slot="choice-card-group"');
    expect(html).toContain('data-type="single"');
    expect(html).toContain('data-layout="list"');
    expect(html).toContain(`data-min-viewport="${MIN_VIEWPORT}"`);
    expect(html).toContain('grid-cols-1');
    expect(html).toMatch(/<span[^>]*data-slot="choice-card-media"/);
    expect(html).not.toMatch(/<(div|p|h\d)[^>]*data-slot="choice-card-(title|description|media)/);
  });

  it('fills the row with tiles by default, at least --choice-card-min wide', () => {
    const html = renderToStaticMarkup(<Single />);
    expect(html).toContain('data-layout="grid"');
    expect(html).toContain('var(--choice-card-min,12rem)');
  });
});

describe('ChoiceCard, several picks', () => {
  const Multiple = (props: { onValueChange?: (v: string[]) => void; defaultValue?: string[] }) => (
    <form data-testid="form">
      <ChoiceCardGroup type="multiple" aria-label="Topics" name="topics" {...props}>
        <ChoiceCard value="history" title="History" />
        <ChoiceCard value="maps" title="Maps" />
        <ChoiceCard value="food" title="Food" />
      </ChoiceCardGroup>
    </form>
  );

  it('is a group of checkboxes with a square indicator', () => {
    render(<Multiple />);
    expect(screen.getByRole('group', { name: 'Topics' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    const indicator = document.querySelector('[data-slot="choice-card-indicator"]')!;
    expect(indicator.className).toContain('rounded-md');
    expect(document.querySelector('[data-slot="choice-card-group"]')!.getAttribute('data-type')).toBe('multiple');
  });

  it('toggles each tile by click and Space and reports every pick', async () => {
    const onValueChange = vi.fn();
    render(<Multiple onValueChange={onValueChange} />);
    await userEvent.click(screen.getByText('History'));
    expect(onValueChange).toHaveBeenLastCalledWith(['history']);
    screen.getByRole('checkbox', { name: 'Food' }).focus();
    await userEvent.keyboard(' ');
    expect(onValueChange).toHaveBeenLastCalledWith(['history', 'food']);
    await userEvent.click(screen.getByText('History'));
    expect(onValueChange).toHaveBeenLastCalledWith(['food']);
  });

  it('posts each pick under its name with the form', () => {
    render(<Multiple defaultValue={['maps', 'food']} />);
    const data = new FormData(screen.getByTestId('form') as HTMLFormElement);
    expect(data.getAll('topics')).toEqual(['maps', 'food']);
  });
});
