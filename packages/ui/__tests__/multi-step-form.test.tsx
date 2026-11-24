/**
 * MultiStepForm: steps that check before they move, focus that follows,
 * a summary that links back, and one submit with every field.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MultiStepForm,
  MultiStepFormStep,
  MultiStepFormSummary,
  MIN_VIEWPORT,
  useMultiStepForm,
} from '../src/patterns/multi-step-form.js';

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.matchMedia = originalMatchMedia;
  delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
});

function reduceMotion() {
  window.matchMedia = ((q: string) => ({
    matches: q.includes('reduce'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function Flow(props: Partial<React.ComponentProps<typeof MultiStepForm>> & { validate?: () => string | null }) {
  const { validate, ...rest } = props;
  return (
    <MultiStepForm {...rest}>
      <MultiStepFormStep id="a" title="First" description="The first step">
        <label>
          Name
          <input name="name" required defaultValue="" />
        </label>
      </MultiStepFormStep>
      <MultiStepFormStep id="b" title={<em>Second</em>} text="Second" validate={validate}>
        <label>
          Note
          <input name="note" defaultValue="hello" />
        </label>
      </MultiStepFormStep>
      <MultiStepFormStep id="c" title="Check">
        <MultiStepFormSummary
          items={[
            { label: 'Name', value: 'Sam', step: 'a' },
            { label: <b>Note</b>, value: '', step: 'b' },
            { label: 'Kind', value: null },
          ]}
        />
      </MultiStepFormStep>
      {/* Not a step: ignored by the progress, rendered as is. */}
      <p>Footnote</p>
    </MultiStepForm>
  );
}

const heading = (name: RegExp) => screen.getByRole('heading', { name });

describe('MultiStepForm', () => {
  it('is a form with one step showing, the others hidden, and a named progress list', () => {
    render(<Flow />);
    expect(MIN_VIEWPORT).toBe(320);
    expect(document.querySelector('form[data-slot="multi-step-form"]')).toBeTruthy();
    expect(heading(/Step 1 of 3, First/)).toBeTruthy();
    const steps = document.querySelectorAll('[data-slot="multi-step-form-step"]');
    expect([...steps].map((s) => (s as HTMLElement).hidden)).toEqual([false, true, true]);
    const nav = screen.getByRole('navigation', { name: 'Progress' });
    const items = nav.querySelectorAll('li');
    expect(items).toHaveLength(3);
    expect(items[0]!.getAttribute('aria-current')).toBe('step');
    expect(items[1]!.textContent).toContain('Second');
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByText('Footnote')).toBeTruthy();
  });

  it('stays on a step until its native checks pass, focusing the problem', () => {
    render(<Flow />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(heading(/Step 1 of 3/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Name' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Sam' } });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    expect(document.activeElement).toBe(heading(/Step 2 of 3/));
    expect(document.querySelectorAll('li')[0]!.dataset.state).toBe('complete');
  });

  it("shows the step's own message, reads it out, and clears it once fixed", () => {
    let message: string | null = 'Say more';
    render(<Flow defaultStep="b" validate={() => message} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert').textContent).toBe('Say more');
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Note' }));
    message = null;
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    expect(heading(/Step 3 of 3, Check/)).toBeTruthy();
  });

  it('goes back without checking, and jumps to a done step from the progress', () => {
    const onStepChange = vi.fn();
    render(<Flow defaultStep="c" onStepChange={onStepChange} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    });
    expect(onStepChange).toHaveBeenLastCalledWith('b');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /First.*Done/ }));
    });
    expect(onStepChange).toHaveBeenLastCalledWith('a');
    expect(heading(/Step 1 of 3/)).toBeTruthy();
  });

  it('lists answers with a Change button back to the step that asked', () => {
    render(<Flow defaultStep="c" />);
    const summary = document.querySelector('[data-slot="multi-step-form-summary"]')!;
    expect(summary.tagName).toBe('DL');
    expect(summary.textContent).toContain('Not given');
    // A label that is not text still names its button, through the <dt>.
    expect(screen.getByRole('button', { name: 'Change Note' })).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Change: Name' }));
    });
    expect(heading(/Step 1 of 3/)).toBeTruthy();
  });

  it('submits every field of every step on the last one', () => {
    const onSubmit = vi.fn();
    render(<Flow defaultStep="c" onSubmit={onSubmit} labels={{ submit: 'Book it' }} />);
    fireEvent.change(document.querySelector('input[name="name"]')!, { target: { value: 'Sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Book it' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const data = onSubmit.mock.calls[0]![0] as FormData;
    expect(data.get('name')).toBe('Sam');
    expect(data.get('note')).toBe('hello');
  });

  it('checks the last step\'s own fields before submitting', () => {
    const onSubmit = vi.fn();
    render(
      <MultiStepForm onSubmit={onSubmit}>
        <MultiStepFormStep id="only" title="Only">
          <input aria-label="Must" required />
        </MultiStepFormStep>
      </MultiStepForm>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('holds the buttons while submitting', () => {
    const onSubmit = vi.fn();
    render(<Flow defaultStep="c" submitting onSubmit={onSubmit} />);
    const send = screen.getByRole('button', { name: 'Sending…' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.submit(send.closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('follows a controlled step', () => {
    const onStepChange = vi.fn();
    const { rerender } = render(<Flow step="b" onStepChange={onStepChange} />);
    expect(heading(/Step 2 of 3/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onStepChange).toHaveBeenCalledWith('c');
    expect(heading(/Step 2 of 3/)).toBeTruthy();
    rerender(<Flow step="c" onStepChange={onStepChange} />);
    expect(heading(/Step 3 of 3/)).toBeTruthy();
    rerender(<Flow step="nope" />);
    expect(heading(/Step 1 of 3/)).toBeTruthy();
  });

  it('focuses a radio group, not its hidden value, when it fails the check', () => {
    render(
      <MultiStepForm>
        <MultiStepFormStep id="a" title="A">
          <div>
            <input type="hidden" required name="x" value="" aria-hidden="true" readOnly />
            <button type="button" role="radio" aria-checked="false">
              One
            </button>
          </div>
        </MultiStepFormStep>
        <MultiStepFormStep id="b" title="B" />
      </MultiStepForm>,
    );
    const hidden = document.querySelector<HTMLInputElement>('input[name="x"]')!;
    // jsdom treats hidden inputs as always valid; make this one fail.
    hidden.checkValidity = () => false;
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'One' }));
  });

  it('slides the new step in from its side, and not under reduced motion', () => {
    const animate = vi.fn();
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
    render(
      <div dir="rtl">
        <Flow defaultStep="b" />
      </div>,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    });
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0]![0][0].transform).toBe('translateX(1rem)');
    cleanup();
    render(<Flow defaultStep="b" />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    expect(animate.mock.calls[1]![0][0].transform).toBe('translateX(1rem)');
    cleanup();
    reduceMotion();
    render(<Flow defaultStep="b" />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    });
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it('gives steps the form state through useMultiStepForm, and refuses use outside', () => {
    function Skip() {
      const { goTo, index, steps } = useMultiStepForm();
      return (
        <button type="button" onClick={() => goTo('c')}>
          Skip from {index + 1} of {steps.length}
        </button>
      );
    }
    render(
      <MultiStepForm>
        <MultiStepFormStep id="a" title="A">
          <Skip />
        </MultiStepFormStep>
        <MultiStepFormStep id="c" title="C" />
      </MultiStepForm>,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Skip from 1 of 2' }));
    });
    expect(heading(/Step 2 of 2, C/)).toBeTruthy();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Skip />)).toThrow(/inside a MultiStepForm/);
    expect(() => render(<MultiStepFormStep id="x" title="X" />)).toThrow(/inside a MultiStepForm/);
  });

  it('ignores a jump to the current step or an unknown one', () => {
    const onStepChange = vi.fn();
    function Jump({ to }: { to: string }) {
      const { goTo } = useMultiStepForm();
      return (
        <button type="button" onClick={() => goTo(to)}>
          Jump {to}
        </button>
      );
    }
    render(
      <MultiStepForm onStepChange={onStepChange}>
        <MultiStepFormStep id="a" title="A">
          <Jump to="a" />
          <Jump to="zzz" />
        </MultiStepFormStep>
      </MultiStepForm>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Jump a' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jump zzz' }));
    expect(onStepChange).not.toHaveBeenCalled();
  });

  it('names a step by its id when its title is not text, and forwards the ref', () => {
    const ref = React.createRef<HTMLFormElement>();
    const calls: (HTMLFormElement | null)[] = [];
    const { rerender } = render(
      <MultiStepForm ref={ref}>
        <MultiStepFormStep id="pick" title={<em>Pick</em>} />
        <MultiStepFormStep id="done" title="Done" />
      </MultiStepForm>,
    );
    expect(ref.current?.tagName).toBe('FORM');
    expect(screen.getByRole('navigation').textContent).toContain('pick');
    rerender(
      <MultiStepForm
        ref={(el) => {
          calls.push(el);
        }}
      >
        <MultiStepFormStep id="pick" title="Pick" />
      </MultiStepForm>,
    );
    expect(calls.at(-1)?.tagName).toBe('FORM');
  });

  it('survives having no steps at all', () => {
    const onSubmit = vi.fn();
    render(<MultiStepForm onSubmit={onSubmit}>{null}</MultiStepForm>);
    fireEvent.submit(document.querySelector('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('focuses the failing control itself when no radio stands for it', () => {
    render(
      <MultiStepForm>
        <MultiStepFormStep id="a" title="A">
          <input type="hidden" required name="y" value="" readOnly />
        </MultiStepFormStep>
        <MultiStepFormStep id="b" title="B" />
      </MultiStepForm>,
    );
    const hidden = document.querySelector<HTMLInputElement>('input[name="y"]')!;
    hidden.checkValidity = () => false;
    const focus = vi.spyOn(hidden, 'focus');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(focus).toHaveBeenCalled();
  });

  it('renders a summary outside a form without Change buttons', () => {
    render(<MultiStepFormSummary items={[{ label: 'Day', value: 'Monday', step: 'a' }]} emptyText="-" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Monday')).toBeTruthy();
  });
});
