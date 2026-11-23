/**
 * DialogueStepper: a Dialogue the reader steps through. These lock the
 * progressive-enhancement contract (the server renders every step, and a
 * no-JS reader gets all of them), the path rules (reveal, branch, back,
 * reset, show all), and the focus and live-region behaviour.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  DialogueChoice,
  DialogueChoices,
  DialogueStep,
  DialogueStepper,
  MIN_VIEWPORT,
} from '../src/patterns/dialogue-stepper.js';
import { Dialogue } from '../src/patterns/dialogue.js';

function Talk(props: { defaultMode?: 'step' | 'all' }) {
  return (
    <DialogueStepper start="open" {...props}>
      <DialogueStepper.Step id="open" aria-label="Opening">
        <Dialogue.Turn speaker="Resident">Why was the bridge closed?</Dialogue.Turn>
        <DialogueStepper.Choices>
          <DialogueStepper.Choice next="answer">What do I say?</DialogueStepper.Choice>
          <DialogueStepper.Choice next="aside">They might ask why it took so long</DialogueStepper.Choice>
        </DialogueStepper.Choices>
      </DialogueStepper.Step>
      <DialogueStepper.Step id="answer">
        <Dialogue.Turn speaker="Engineer">The deck needed new bearings.</Dialogue.Turn>
        <DialogueStepper.Choices>
          <DialogueStepper.Choice next="close">And now?</DialogueStepper.Choice>
        </DialogueStepper.Choices>
      </DialogueStepper.Step>
      <DialogueStepper.Step id="aside">
        <Dialogue.Turn speaker="Engineer">The parts came from abroad.</Dialogue.Turn>
        <DialogueStepper.Choices>
          <DialogueStepper.Choice next="open">Back to the start</DialogueStepper.Choice>
        </DialogueStepper.Choices>
      </DialogueStepper.Step>
      <DialogueStepper.Step id="close">
        <Dialogue.Turn speaker="Engineer">It reopened in April.</Dialogue.Turn>
      </DialogueStepper.Step>
    </DialogueStepper>
  );
}

const step = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-step="${id}"]`)!;
/** Pending steps hide by class; the hidden attribute would beat the no-JS style. */
const isHidden = (el: HTMLElement) => {
  expect(el.hasAttribute('hidden')).toBe(false);
  return el.classList.contains('hidden');
};

describe('DialogueStepper', () => {
  it('server-renders every step, and a no-JS style that shows them all', () => {
    const html = renderToStaticMarkup(<Talk />);
    for (const text of ['closed?', 'bearings', 'abroad', 'April']) expect(html).toContain(text);
    expect(html).toContain('<noscript>');
    expect(html).toMatch(/dialogue-step"\]\{display:flex!important\}/);
    // Every rule is scoped to the stepper, so no-JS never hides anything else.
    const css = html.match(/<noscript><style>(.*?)<\/style>/)![1]!;
    for (const selector of css.split(/[{}]/).filter((_, i) => i % 2 === 0 && _).flatMap((s) => s.split(','))) {
      expect(selector.startsWith('[data-slot="dialogue-stepper"] ')).toBe(true);
    }
    expect(html).toContain('data-min-viewport="320"');
    expect(MIN_VIEWPORT).toBe(320);
  });

  it('opens on the start step with the rest hidden', () => {
    const { container } = render(<Talk />);
    expect(step(container, 'open').dataset.state).toBe('current');
    expect(isHidden(step(container, 'open'))).toBe(false);
    for (const id of ['answer', 'aside', 'close']) {
      expect(step(container, id).dataset.state).toBe('pending');
      expect(isHidden(step(container, id))).toBe(true);
    }
    expect(screen.getByRole('button', { name: 'Back' })).toHaveProperty('disabled', true);
  });

  it('a choice reveals its step, announces it, and moves focus to its first choice', () => {
    const { container } = render(<Talk />);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'What do I say?' })));
    expect(step(container, 'answer').dataset.state).toBe('current');
    expect(step(container, 'open').dataset.state).toBe('past');
    // Past steps drop their choices: only the last step's are live.
    expect(screen.queryByRole('button', { name: 'What do I say?' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Engineer: The deck needed new bearings.');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'And now?' }));
  });

  it('focuses Back when the new step ends the talk', () => {
    render(<Talk />);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'What do I say?' })));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'And now?' })));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Back' }));
  });

  it('branches, and a choice of a step already on the path goes back to it', () => {
    const { container } = render(<Talk />);
    act(() => fireEvent.click(screen.getByRole('button', { name: /why it took so long/ })));
    expect(step(container, 'aside').dataset.state).toBe('current');
    expect(isHidden(step(container, 'answer'))).toBe(true);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Back to the start' })));
    expect(step(container, 'open').dataset.state).toBe('current');
    expect(isHidden(step(container, 'aside'))).toBe(true);
  });

  it('shows steps in the order they were taken', () => {
    const { container } = render(<Talk />);
    act(() => fireEvent.click(screen.getByRole('button', { name: /why it took so long/ })));
    const shown = [...container.querySelectorAll<HTMLElement>('[data-slot="dialogue-step"]')]
      .filter((el) => !isHidden(el))
      .map((el) => el.dataset.step);
    expect(shown).toEqual(['open', 'aside']);
  });

  it('Back steps one back, and Start over returns to the start', () => {
    const { container } = render(<Talk />);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'What do I say?' })));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'And now?' })));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    expect(step(container, 'answer').dataset.state).toBe('current');
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Start over' })));
    expect(step(container, 'open').dataset.state).toBe('current');
    expect(isHidden(step(container, 'answer'))).toBe(true);
  });

  it('Show the whole conversation shows every step without choices, and toggles back', () => {
    const { container } = render(<Talk />);
    const toggle = screen.getByRole('button', { name: 'Show the whole conversation' });
    act(() => fireEvent.click(toggle));
    expect(container.querySelector('[data-slot="dialogue-stepper"]')!.getAttribute('data-mode')).toBe('all');
    for (const id of ['open', 'answer', 'aside', 'close']) expect(isHidden(step(container, id))).toBe(false);
    expect(container.querySelector('[data-slot="dialogue-choice"]')).toBeNull();
    const back = screen.getByRole('button', { name: 'Step through' });
    expect(back.getAttribute('aria-pressed')).toBe('true');
    act(() => fireEvent.click(back));
    expect(isHidden(step(container, 'answer'))).toBe(true);
  });

  it('can open in all mode, and takes translated labels', () => {
    const { container } = render(
      <DialogueStepper start="a" defaultMode="all" labels={{ back: 'Zurück', reset: 'Neu' }}>
        <DialogueStepper.Step id="a">
          <Dialogue.Turn speaker="A">Hallo</Dialogue.Turn>
        </DialogueStepper.Step>
      </DialogueStepper>,
    );
    expect(container.querySelector('[data-mode="all"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Zurück' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Neu' })).toBeTruthy();
  });

  it('a choice whose onClick prevents default does not move', () => {
    const { container } = render(
      <DialogueStepper start="a">
        <DialogueStepper.Step id="a">
          <Dialogue.Turn speaker="A">One</Dialogue.Turn>
          <DialogueStepper.Choices>
            <DialogueStepper.Choice next="b" onClick={(e) => e.preventDefault()}>
              Next
            </DialogueStepper.Choice>
          </DialogueStepper.Choices>
        </DialogueStepper.Step>
        <DialogueStepper.Step id="b">
          <Dialogue.Turn speaker="B">Two</Dialogue.Turn>
        </DialogueStepper.Step>
      </DialogueStepper>,
    );
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next' })));
    expect(isHidden(step(container, 'b'))).toBe(true);
  });

  it('takes choices through a prop, as a server component must pass them', () => {
    const { container } = render(
      <DialogueStepper start="a">
        <DialogueStep
          id="a"
          choices={
            <DialogueChoices>
              <DialogueChoice next="b">Next</DialogueChoice>
            </DialogueChoices>
          }
        >
          <Dialogue.Turn speaker="A">One</Dialogue.Turn>
        </DialogueStep>
        <DialogueStep id="b">
          <Dialogue.Turn speaker="B">Two</Dialogue.Turn>
        </DialogueStep>
      </DialogueStepper>,
    );
    // The choices sit beside the list of turns, never inside it.
    expect(container.querySelector('[data-slot="dialogue"] [data-slot="dialogue-choices"]')).toBeNull();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next' })));
    expect(isHidden(step(container, 'b'))).toBe(false);
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('choices it cannot recognise still hide once past, and warn where they landed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Stands in for a server component's client reference: not DialogueChoices by identity.
    const Opaque = () => (
      <DialogueChoices>
        <DialogueChoice next="b">Next</DialogueChoice>
      </DialogueChoices>
    );
    render(
      <DialogueStepper start="a">
        <DialogueStep id="a">
          <Dialogue.Turn speaker="A">One</Dialogue.Turn>
          <Opaque />
        </DialogueStep>
        <DialogueStep id="b">
          <Dialogue.Turn speaker="B">Two</Dialogue.Turn>
        </DialogueStep>
      </DialogueStepper>,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('choices={'));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next' })));
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    warn.mockRestore();
  });

  it('throws outside a stepper', () => {
    expect(() => render(<DialogueStepper.Choice next="x">x</DialogueStepper.Choice>)).toThrow(/inside <DialogueStepper>/);
  });
});
