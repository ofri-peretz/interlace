/** SectionBoundary tells the app when a section crashes, so the app can report it. */
import { cleanup, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SectionBoundary } from '../src/primitives/section-boundary.js';
import { createErrorLog } from '../src/lib/error-report-model.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Boom(): React.ReactElement {
  throw new Error('section broke');
}

describe('SectionBoundary onError', () => {
  it('is called once with the error and the section name, and the fallback shows', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onError = vi.fn();
    render(
      <SectionBoundary name="related" onError={onError}>
        <Boom />
      </SectionBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatchObject({ message: 'section broke' });
    expect(onError.mock.calls[0][1]).toBe('related');
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('reaches the error log through the app’s one line', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = createErrorLog();
    log.setReporter(() => undefined);
    render(
      <SectionBoundary name="related" onError={(error, name) => log.report(error, `section: ${name}`)}>
        <Boom />
      </SectionBoundary>,
    );
    expect(log.recent().map((r) => [r.where, r.message])).toEqual([['section: related', 'section broke']]);
  });

  it('contains an onError that throws, so reporting is never the next crash', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <SectionBoundary
        name="related"
        onError={() => {
          throw new Error('reporter bug');
        }}
      >
        <Boom />
      </SectionBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('is optional', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <SectionBoundary name="related">
        <Boom />
      </SectionBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
