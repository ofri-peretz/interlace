import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AnswerPad, choiceKey } from '../src/games/answer-pad.js';

const CHOICES = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: <em>Gamma</em>, text: 'Gamma' },
];

function Live({ onPick }: { onPick?: (id: string) => void }) {
  const [value, setValue] = React.useState<string | null>(null);
  return (
    <AnswerPad
      choices={CHOICES}
      value={value}
      onPick={(id) => {
        onPick?.(id);
        setValue(id);
      }}
    />
  );
}

const pad = (c: HTMLElement) => c.querySelector('[data-slot="answer-pad"]') as HTMLElement;

afterEach(cleanup);

describe('AnswerPad', () => {
  it('gives the big screen and the pad the same letters', () => {
    expect([0, 1, 25, 26].map(choiceKey)).toEqual(['A', 'B', 'Z', '27']);
  });

  it('takes one pick, then says the answer is in', () => {
    const onPick = vi.fn();
    const { container } = render(<Live onPick={onPick} />);
    expect(pad(container).dataset.state).toBe('open');
    fireEvent.click(screen.getByRole('button', { name: /Beta/ }));
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('b');
    expect(pad(container).dataset.state).toBe('sent');
    expect(screen.getByRole('button', { name: /Beta/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Answer in. Watch the screen.')).toBeTruthy();
  });

  it('picks with letters and numbers, and ignores other keys', () => {
    const onPick = vi.fn();
    const { container, unmount } = render(<Live onPick={onPick} />);
    fireEvent.keyDown(pad(container), { key: 'Enter' });
    fireEvent.keyDown(pad(container), { key: 'q' });
    fireEvent.keyDown(pad(container), { key: 'c', ctrlKey: true });
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.keyDown(pad(container), { key: 'c' });
    expect(onPick).toHaveBeenCalledWith('c');
    unmount();
    const second = render(<Live onPick={onPick} />);
    fireEvent.keyDown(pad(second.container), { key: '1' });
    expect(onPick).toHaveBeenLastCalledWith('a');
  });

  it('lets a parent handle a key first', () => {
    const onPick = vi.fn();
    const { container } = render(
      <AnswerPad choices={CHOICES} value={null} onPick={onPick} onKeyDown={(e) => e.preventDefault()} />,
    );
    fireEvent.keyDown(pad(container), { key: 'a' });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('stops taking picks when the round closes', () => {
    const onPick = vi.fn();
    const { container } = render(<AnswerPad choices={CHOICES} value={null} closed onPick={onPick} />);
    expect(pad(container).dataset.state).toBe('closed');
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByText("Time's up.")).toBeTruthy();
  });

  it('says how the player did at the reveal', () => {
    const { container, rerender } = render(
      <AnswerPad choices={CHOICES} value="b" correct="b" points={1250} locale="en-US" />,
    );
    expect(pad(container).dataset.outcome).toBe('correct');
    expect(screen.getByText('Right. +1,250 points.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Beta.*right answer/ })).toBeTruthy();
    rerender(<AnswerPad choices={CHOICES} value="b" correct="b" />);
    expect(screen.getByText('Right.')).toBeTruthy();
    rerender(<AnswerPad choices={CHOICES} value="a" correct="c" points={0} />);
    expect(pad(container).dataset.outcome).toBe('wrong');
    expect(screen.getByText('Not this time. It was Gamma.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Alpha.*your answer/ })).toBeTruthy();
    rerender(<AnswerPad choices={CHOICES} value={null} correct="zz" />);
    expect(pad(container).dataset.outcome).toBe('missed');
    expect(screen.getByText('No answer this time. It was zz.')).toBeTruthy();
  });

  it('shows letters only, and names the group', () => {
    render(
      <AnswerPad choices={CHOICES} value={null} display="keys" labels={{ group: 'Pick one', result: () => 'x' }} />,
    );
    expect(screen.getByRole('group', { name: 'Pick one' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'C: Gamma' })).toBeTruthy();
  });

  it('labels the tiles by the prompt when it shows one, and resets after a new round', () => {
    const { rerender } = render(<AnswerPad choices={CHOICES} value="a" prompt="Pick a letter" />);
    expect(screen.getByRole('group', { name: 'Pick a letter' })).toBeTruthy();
    const onPick = vi.fn();
    rerender(<AnswerPad choices={CHOICES} value={null} prompt="Next" onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /Beta/ }));
    expect(onPick).toHaveBeenCalledWith('b');
  });
});
