/**
 * ReflectionCard: private by default, shared only by choice and only past
 * the room's checks, and saved either way.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MIN_VIEWPORT, ReflectionCard } from '../src/games/reflection-card.js';

if (typeof window.PointerEvent === 'undefined') {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
}

afterEach(cleanup);

const write = (text: string) => fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));

describe('ReflectionCard', () => {
  it('is private by default and saves trimmed text', () => {
    const onSave = vi.fn();
    const { container } = render(<ReflectionCard prompt="What surprised you today?" meta="1 of 3" onSave={onSave} />);
    const root = container.querySelector('[data-slot="reflection-card"]') as HTMLElement;
    expect(root.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    const field = screen.getByRole('textbox', { name: 'What surprised you today?' });
    expect(field.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2);
    expect(screen.getByText('Only you see this.')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Write something first.')).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    write('  How much I already knew.  ');
    expect(screen.queryByText('Write something first.')).toBeNull();
    expect(screen.getByText('472 characters left')).toBeTruthy();
    save();
    expect(onSave).toHaveBeenCalledWith('How much I already knew.', { shared: false });
    expect(screen.getByText('Saved.')).toBeTruthy();
    expect(root.getAttribute('data-state')).toBe('saved');
    // Private text is never refused, even with an address in it.
    write('Write to me at someone@example.com');
    save();
    expect(onSave).toHaveBeenLastCalledWith('Write to me at someone@example.com', { shared: false });
  });

  it('shares only by choice, and only past the room checks', () => {
    const onSave = vi.fn();
    render(<ReflectionCard prompt="Q" shareable blocklist={['nope']} onSave={onSave} />);
    const box = screen.getByRole('checkbox', { name: 'Share it with the room, without my name' });
    fireEvent.click(box);
    write('Mail me: someone@example.com');
    save();
    expect(onSave).toHaveBeenLastCalledWith('Mail me: someone@example.com', { shared: false });
    expect(screen.getByText('Saved, not shared: email addresses and phone numbers cannot be shared.')).toBeTruthy();
    write('nope');
    save();
    expect(screen.getByText('Saved, not shared: try other words to share it.')).toBeTruthy();
    write('The  maps   changed how I saw it.');
    save();
    expect(onSave).toHaveBeenLastCalledWith('The maps changed how I saw it.', { shared: true });
    expect(screen.getByText('Saved, and shared without your name.')).toBeTruthy();
    // Unticking clears the message and saves privately again.
    fireEvent.click(box);
    expect(screen.queryByText('Saved, and shared without your name.')).toBeNull();
    save();
    expect(onSave).toHaveBeenLastCalledWith('The  maps   changed how I saw it.', { shared: false });
  });

  it('is controlled and takes labels', () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    render(
      <ReflectionCard
        prompt="Q"
        value="Fest"
        maxLength={3}
        shareable
        onChange={onChange}
        onSave={onSave}
        labels={{ save: 'Sichern', left: (n) => `${n} übrig`, refused: { 'too-long': 'Zu lang.' } }}
      />,
    );
    expect(screen.getByText('-1 übrig')).toBeTruthy();
    write('Fester');
    expect(onChange).toHaveBeenCalledWith('Fester');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Fest');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Sichern' }));
    expect(screen.getByText('Zu lang.')).toBeTruthy();
    expect(onSave).toHaveBeenCalledWith('Fest', { shared: false });
  });
});
