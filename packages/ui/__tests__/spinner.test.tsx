/**
 * Spinner: something is working.
 *
 * Locks that it is announced once as a status with a label the caller can
 * translate, that `decorative` hides it instead, that it only turns under
 * motion-safe, that sizes are a fixed enum, and that it stays a server
 * component.
 */
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { MIN_VIEWPORT, Spinner } from '../src/primitives/spinner.js';

afterEach(cleanup);

const svg = (ui: React.ReactElement) =>
  render(ui).container.querySelector('[data-slot="spinner"]') as SVGElement;

describe('Spinner', () => {
  it('is a server component', () => {
    const src = readFileSync(resolve(__dirname, '../src/primitives/spinner.tsx'), 'utf8');
    expect(src).not.toMatch(/^['"]use client['"]/m);
    expect(renderToStaticMarkup(<Spinner />)).toContain('data-slot="spinner"');
  });

  it('is a status named "Loading" by default, with its min viewport', () => {
    const el = svg(<Spinner />);
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-label')).toBe('Loading');
    expect(el.getAttribute('aria-hidden')).toBeNull();
    expect(el.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
  });

  it('takes a label in another language', () => {
    expect(svg(<Spinner label="Chargement" />).getAttribute('aria-label')).toBe('Chargement');
  });

  it('decorative hides it and drops the status role', () => {
    const el = svg(<Spinner decorative />);
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('role')).toBeNull();
    expect(el.getAttribute('aria-label')).toBeNull();
  });

  it('turns only under motion-safe', () => {
    const cls = svg(<Spinner />).getAttribute('class') ?? '';
    expect(cls).toContain('motion-safe:animate-spin');
    expect(cls.split(/\s+/)).not.toContain('animate-spin');
  });

  it('defaults to sm and accepts md and lg', () => {
    expect(svg(<Spinner />).getAttribute('class')).toContain('size-4');
    cleanup();
    expect(svg(<Spinner size="md" />).getAttribute('class')).toContain('size-6');
    cleanup();
    expect(svg(<Spinner size="lg" />).getAttribute('class')).toContain('size-8');
  });

  it('draws in currentColor and merges className and props', () => {
    const el = svg(<Spinner className="text-primary" id="s" />);
    expect(el.getAttribute('stroke')).toBe('currentColor');
    expect(el.getAttribute('class')).toContain('text-primary');
    expect(el.getAttribute('id')).toBe('s');
  });
});
