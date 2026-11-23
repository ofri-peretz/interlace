/**
 * Field surfaces: a form control paints its own opaque face and its own text
 * colour, so it reads on any band a consumer drops it on (a brand-coloured
 * section, an image, a dark hero). A translucent face (`bg-transparent`,
 * `dark:bg-input/30`) let the band show through, and an inherited text
 * colour put white-on-white text into a field on a dark band.
 *
 * Also: ComboboxCompose names duplicate item values instead of failing
 * silently.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ComboboxCompose } from '../src/primitives/combobox.js';

const src = (name: string) => readFileSync(join(__dirname, '../src/primitives', `${name}.tsx`), 'utf8');

describe('field surfaces are opaque', () => {
  it.each(['input', 'textarea', 'combobox', 'checkbox', 'radio-group', 'number-field'])(
    '%s paints bg-background and never a translucent field face',
    (name) => {
      const text = src(name);
      expect(text).toMatch(/\bbg-background\b/);
      expect(text, 'a translucent dark face lets the band through').not.toMatch(/dark:bg-input\/\d+/);
    },
  );

  it.each(['input', 'textarea', 'combobox'])('%s sets its own text colour on the field', (name) => {
    const text = src(name);
    expect(text).toMatch(/bg-background text-foreground/);
  });

  it('the input element has no transparent face', () => {
    expect(src('input')).not.toMatch(/border bg-transparent/);
    expect(src('textarea')).not.toMatch(/border-input bg-transparent/);
  });
});

describe('ComboboxCompose duplicate values', () => {
  afterEach(() => vi.restoreAllMocks());

  it('warns once, naming the duplicates', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const items = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
      { value: 'a', label: 'Alpha again' },
    ];
    const { rerender } = render(<ComboboxCompose items={items} aria-label="Pick" />);
    rerender(<ComboboxCompose items={[...items]} aria-label="Pick" />);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/share a value \(a\)/);
  });

  it('stays quiet when every value is unique', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<ComboboxCompose items={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]} aria-label="Pick" />);
    expect(warn).not.toHaveBeenCalled();
  });
});
