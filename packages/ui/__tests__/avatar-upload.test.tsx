/**
 * AvatarUpload. jsdom has no object URLs and no DataTransfer, so the tests
 * lend small ones and pin what the reader sees and hears: which photo shows,
 * what each choice reports, why a file is turned away, and that previews are
 * revoked.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AvatarUpload, MIN_VIEWPORT } from '../src/patterns/avatar-upload.js';

const image = (name = 'me.png', size = 10, type = 'image/png') => new File([new Uint8Array(size)], name, { type });
const field = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
const photo = () => document.querySelector<HTMLElement>('[data-slot="avatar-upload-photo"]')!;
const status = () => document.querySelector('[data-slot="avatar-upload-status"]')!;
const pick = (...files: File[]) => fireEvent.change(field(), { target: { files } });
const drop = (...files: File[]) => fireEvent.drop(photo(), { dataTransfer: { files } });
const leave = (to: Element | null) =>
  React.act(() => {
    photo().dispatchEvent(new MouseEvent('dragleave', { bubbles: true, relatedTarget: to }));
  });

const revoke = vi.fn();
let made = 0;

beforeEach(() => {
  made = 0;
  revoke.mockClear();
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: () => `blob:${++made}`,
      revokeObjectURL: revoke,
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
  delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
});

/** The image Base UI would show once loaded; jsdom never loads, so read the src it was given. */
const shownSrc = () => {
  const img = document.querySelector('img');
  return img?.getAttribute('src') ?? null;
};

describe('AvatarUpload', () => {
  it('renders a named file field and the fallback on the server', () => {
    const html = renderToStaticMarkup(<AvatarUpload fallback="AB" name="photo" hint="JPG or PNG" />);
    expect(html).toContain('data-slot="avatar-upload"');
    expect(html).toContain(`data-min-viewport="${MIN_VIEWPORT}"`);
    expect(html).toMatch(/<label[^>]*data-slot="avatar-upload-choose"/);
    const input = html.match(/<input[^>]*>/)![0];
    expect(input).toContain('type="file"');
    expect(input).toContain('name="photo"');
    expect(input).toContain('accept="image/*"');
    expect(html).toContain('AB');
    expect(html).toContain('Choose photo');
    expect(html).not.toContain('data-slot="avatar-upload-remove"');
  });

  it('is named "Choose photo", described by its hint, and offers Remove when there is a photo', () => {
    render(<AvatarUpload src="/me.jpg" fallback="AB" hint="JPG or PNG" />);
    const input = screen.getByLabelText('Choose photo');
    expect(input.getAttribute('aria-describedby')).toBe(document.querySelector('[data-slot="avatar-upload-hint"]')!.id);
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('previews a chosen photo, reports it, and revokes the preview when it is replaced', async () => {
    const onValueChange = vi.fn();
    const { unmount } = render(<AvatarUpload src="/me.jpg" fallback="AB" onValueChange={onValueChange} />);
    const first = image('one.png');
    pick(first);
    expect(onValueChange).toHaveBeenLastCalledWith(first);
    pick(image('two.png'));
    expect(revoke).toHaveBeenCalledWith('blob:1');
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:2');
  });

  it('removes the photo, reports null, shows the fallback and returns focus to the field', () => {
    const onValueChange = vi.fn();
    render(<AvatarUpload src="/me.jpg" fallback="AB" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(shownSrc()).toBeNull();
    expect(screen.getByText('AB')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(document.activeElement).toBe(field());
  });

  it('turns away a file that is not an image, or too large, and says why', () => {
    const onReject = vi.fn();
    const onValueChange = vi.fn();
    render(<AvatarUpload fallback="AB" maxSize={100} onReject={onReject} onValueChange={onValueChange} />);
    pick(image('notes.txt', 10, 'text/plain'));
    expect(status().textContent).toBe("notes.txt isn't an image this field takes.");
    expect(status().getAttribute('aria-live')).toBe('polite');
    expect(field().getAttribute('aria-describedby')).toBe(status().id);
    drop(image('big.png', 500));
    expect(status().textContent).toBe('big.png is larger than 100 bytes.');
    expect(onReject).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'size' }));
    expect(onValueChange).not.toHaveBeenCalled();
    drop(image('ok.png'));
    expect(status().textContent).toBe('');
  });

  it('says it in the words the app gives', () => {
    render(
      <AvatarUpload
        messages={{
          type: (f) => `No: ${f.name}`,
          size: (f, n) => `${f.name} > ${n}`,
        }}
        maxSize={1}
      />,
    );
    pick(image('a.txt', 1, 'text/plain'));
    expect(status().textContent).toBe('No: a.txt');
    pick(image('b.png', 5));
    expect(status().textContent).toBe('b.png > 1');
  });

  it('ignores a cancelled picker', () => {
    const onValueChange = vi.fn();
    render(<AvatarUpload onValueChange={onValueChange} />);
    pick();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('follows a controlled value, where undefined still means unchanged', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <AvatarUpload src="/me.jpg" fallback="AB" value={undefined} onValueChange={onValueChange} />,
    );
    pick(image());
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(made).toBe(0);
    rerender(<AvatarUpload src="/me.jpg" fallback="AB" value={null} onValueChange={onValueChange} />);
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    rerender(<AvatarUpload src="/me.jpg" fallback="AB" value={image()} onValueChange={onValueChange} />);
    expect(made).toBe(1);
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('marks a drag over the photo, and ignores leaving into its own children', () => {
    render(<AvatarUpload fallback="AB" />);
    fireEvent.dragEnter(photo());
    fireEvent.dragOver(photo());
    expect(photo().hasAttribute('data-dragging')).toBe(true);
    leave(photo().querySelector('span'));
    expect(photo().hasAttribute('data-dragging')).toBe(true);
    leave(document.body);
    expect(photo().hasAttribute('data-dragging')).toBe(false);
  });

  it('takes nothing while disabled', () => {
    const onValueChange = vi.fn();
    render(<AvatarUpload src="/me.jpg" disabled onValueChange={onValueChange} />);
    fireEvent.dragEnter(photo());
    fireEvent.dragOver(photo());
    drop(image());
    expect(photo().hasAttribute('data-dragging')).toBe(false);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(field().disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Remove' })).toHaveProperty('disabled', true);
    expect(document.querySelector('[data-slot="avatar-upload-choose"]')!.hasAttribute('data-disabled')).toBe(true);
  });

  it('gives the input the chosen file, and empties it on remove, so a form posts what shows', () => {
    const given: string[][] = [];
    class FakeTransfer {
      list: File[] = [];
      items = { add: (f: File) => this.list.push(f) };
      get files() {
        given.push(this.list.map((f) => f.name));
        return this.list;
      }
    }
    vi.stubGlobal('DataTransfer', FakeTransfer);
    const set = vi.spyOn(HTMLInputElement.prototype, 'files', 'set').mockImplementation(() => {});
    render(<AvatarUpload src="/me.jpg" maxSize={1} />);
    drop(image('a.png', 1));
    drop(image('big.png', 9));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(given).toEqual([['a.png'], ['a.png'], []]);
    set.mockRestore();
  });

  it('shows no preview where object URLs are missing', () => {
    (URL as unknown as { createObjectURL?: unknown }).createObjectURL = undefined;
    render(<AvatarUpload fallback="AB" />);
    pick(image());
    expect(shownSrc()).toBeNull();
  });

  it('passes props and classes through, and takes its own words', () => {
    render(<AvatarUpload className="mt-4" data-testid="up" chooseLabel="Upload" removeLabel="Clear" src="/x.jpg" />);
    expect(screen.getByTestId('up').className).toContain('mt-4');
    expect(screen.getByLabelText('Upload')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
  });
});
