/**
 * FileDrop and file-model. jsdom has no DataTransfer, so one test lends a
 * small one to pin that the input is given what the list shows; the rest
 * pin the rules, the words a screen reader hears, and where focus goes.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { acceptsFile, checkFiles, FileDrop, formatBytes, MIN_VIEWPORT } from '../src/primitives/file-drop.js';

const file = (name: string, size = 10, type = '') => new File([new Uint8Array(size)], name, { type });
const field = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
const area = () => document.querySelector<HTMLElement>('[data-slot="file-drop-area"]')!;
const pick = (...files: File[]) => fireEvent.change(field(), { target: { files } });
// jsdom has no DragEvent, so a leave is a mouse event that carries where the pointer went.
const leave = (to: Element | null) =>
  React.act(() => {
    area().dispatchEvent(new MouseEvent('dragleave', { bubbles: true, relatedTarget: to }));
  });
const drop = (...files: File[]) => fireEvent.drop(area(), { dataTransfer: { files } });

afterEach(() => vi.unstubAllGlobals());

describe('file-model', () => {
  it('reads accept like the attribute does', () => {
    expect(acceptsFile(file('a.PNG'), '.png')).toBe(true);
    expect(acceptsFile(file('a.png', 1, 'image/png'), 'image/*')).toBe(true);
    expect(acceptsFile(file('a.pdf', 1, 'application/pdf'), 'image/*, .txt')).toBe(false);
    expect(acceptsFile(file('a.pdf', 1, 'application/pdf'), 'application/pdf')).toBe(true);
    expect(acceptsFile(file('a'), undefined)).toBe(true);
    expect(acceptsFile(file('a'), ' , ')).toBe(true);
  });

  it('sorts files by type, then size, then room', () => {
    const files = [file('a.png', 5), file('b.gif', 5), file('c.png', 50), file('d.png', 5), file('e.png', 5)];
    const { accepted, rejected } = checkFiles(files, { accept: '.png', maxSize: 10, maxFiles: 2 }, 1);
    expect(accepted.map((f) => f.name)).toEqual(['a.png']);
    expect(rejected.map((r) => `${r.file.name}:${r.reason}`)).toEqual([
      'b.gif:type',
      'c.png:size',
      'd.png:count',
      'e.png:count',
    ]);
    expect(checkFiles([file('x')]).accepted).toHaveLength(1);
  });

  it('writes sizes as a person reads them', () => {
    expect(formatBytes(512, 'en')).toBe('512 bytes');
    expect(formatBytes(2_400_000, 'en')).toBe('2.4 MB');
    expect(formatBytes(150_000, 'en')).toBe('150 kB');
    expect(formatBytes(5e15, 'en')).toBe('5,000,000 GB');
    expect(formatBytes(-1, 'en')).toBe('0 bytes');
  });
});

describe('FileDrop', () => {
  it('renders a labelled file field on the server', () => {
    const html = renderToStaticMarkup(<FileDrop label="Add files" hint="PNG, up to 1 MB" name="docs" required />);
    expect(html).toContain('data-slot="file-drop"');
    expect(html).toContain(`data-min-viewport="${MIN_VIEWPORT}"`);
    expect(html).toMatch(/<label[^>]*data-slot="file-drop-area"/);
    expect(html).toMatch(/<input[^>]*type="file"[^>]*name="docs"/);
    expect(html).toContain('required=""');
    expect(html).not.toContain('data-slot="file-drop-list"');
  });

  it('is named by its label and described by its hint', () => {
    render(<FileDrop label="Add files" hint="PNG only" />);
    const input = screen.getByLabelText(/Add files/);
    expect(input.getAttribute('aria-describedby')).toBe(document.querySelector('[data-slot="file-drop-hint"]')!.id);
  });

  it('keeps one file at a time, replacing the last', () => {
    const onValueChange = vi.fn();
    render(<FileDrop label="Photo" onValueChange={onValueChange} locale="en" />);
    pick(file('one.png', 2000));
    pick(file('two.png'));
    expect(onValueChange).toHaveBeenLastCalledWith([expect.objectContaining({ name: 'two.png' })]);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Remove two.png' })).toBeTruthy();
  });

  it('adds to the list when it takes several, and turns away what breaks a rule, saying why', () => {
    const onReject = vi.fn();
    render(<FileDrop label="Photos" multiple accept="image/*" maxSize={100} maxFiles={2} onReject={onReject} />);
    pick(file('a.png', 10, 'image/png'));
    drop(
      file('notes.txt', 10, 'text/plain'),
      file('big.png', 500, 'image/png'),
      file('b.png', 10, 'image/png'),
      file('c.png', 10, 'image/png'),
    );
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('a.png'),
      expect.stringContaining('b.png'),
    ]);
    const status = document.querySelector('[data-slot="file-drop-status"]')!;
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe(
      "notes.txt isn't a type this field takes. big.png is larger than 100 bytes. c.png wasn't added: this field takes 2 files.",
    );
    expect(field().getAttribute('aria-describedby')).toContain(status.id);
    expect(onReject).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ reason: 'count' })]));
    pick(file('d.png', 1, 'image/png'));
    expect(status.textContent).toBe("d.png wasn't added: this field takes 2 files.");
  });

  it('says one file in the singular, in words the app can replace', () => {
    render(
      <FileDrop
        label="Doc"
        multiple
        maxFiles={1}
        messages={{
          count: (f, n) => `${f.name}: max ${n}`,
          remove: (f) => `Drop ${f.name}`,
        }}
      />,
    );
    pick(file('a'), file('b'));
    expect(document.querySelector('[data-slot="file-drop-status"]')!.textContent).toBe('b: max 1');
    expect(screen.getByRole('button', { name: 'Drop a' })).toBeTruthy();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('uses the default singular sentence', () => {
    render(<FileDrop label="Doc" multiple maxFiles={1} />);
    pick(file('a'), file('b'));
    expect(document.querySelector('[data-slot="file-drop-status"]')!.textContent).toBe(
      "b wasn't added: this field takes 1 file.",
    );
  });

  it('moves focus to the next Remove button, then back to the field', () => {
    render(<FileDrop label="Files" multiple defaultValue={[file('a'), file('b')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove a' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove b' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove b' }));
    expect(document.activeElement).toBe(field());
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('follows a controlled value', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<FileDrop label="Files" multiple value={[]} onValueChange={onValueChange} />);
    pick(file('a'));
    expect(onValueChange).toHaveBeenCalledWith([expect.objectContaining({ name: 'a' })]);
    expect(screen.queryByRole('list')).toBeNull();
    rerender(<FileDrop label="Files" multiple value={[file('a')]} onValueChange={onValueChange} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('marks a drag over the area, and ignores leaving into its own children', () => {
    render(<FileDrop label="Files" />);
    fireEvent.dragEnter(area());
    expect(area().hasAttribute('data-dragging')).toBe(true);
    fireEvent.dragOver(area());
    leave(area().querySelector('span'));
    expect(area().hasAttribute('data-dragging')).toBe(true);
    leave(document.body);
    expect(area().hasAttribute('data-dragging')).toBe(false);
  });

  it('takes nothing while disabled', () => {
    const onValueChange = vi.fn();
    render(<FileDrop label="Files" disabled onValueChange={onValueChange} defaultValue={[file('a')]} />);
    fireEvent.dragEnter(area());
    fireEvent.dragOver(area());
    drop(file('b'));
    expect(area().hasAttribute('data-dragging')).toBe(false);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(field().disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Remove a' })).toHaveProperty('disabled', true);
  });

  it('gives the input what the list shows, so a form posts it', () => {
    const given: File[][] = [];
    class FakeTransfer {
      list: File[] = [];
      items = { add: (f: File) => this.list.push(f) };
      get files() {
        given.push(this.list);
        return this.list;
      }
    }
    vi.stubGlobal('DataTransfer', FakeTransfer);
    const set = vi.spyOn(HTMLInputElement.prototype, 'files', 'set').mockImplementation(() => {});
    render(<FileDrop label="Files" multiple />);
    drop(file('a'));
    // A cancelled picker hands over no files; the list keeps what it had.
    fireEvent.change(field(), { target: { files: [] } });
    fireEvent.change(field(), { target: { files: null } });
    expect(given.map((g) => g.map((f) => f.name))).toEqual([['a'], ['a'], ['a']]);
    expect(set).toHaveBeenCalled();
    set.mockRestore();
  });

  it('passes props and classes through', () => {
    render(<FileDrop label="Files" className="mt-4" data-testid="drop" />);
    expect(screen.getByTestId('drop').className).toContain('mt-4');
    expect(React.isValidElement(<FileDrop label="x" />)).toBe(true);
  });
});
