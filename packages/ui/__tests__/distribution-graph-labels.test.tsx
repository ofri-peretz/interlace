/**
 * Distribution and NetworkGraph words: every fixed word can be replaced and
 * numbers follow a locale. The English defaults are held by the other suites.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Distribution, type DistributionBin } from '../src/charts/distribution.js';
import { describeGraph, graphSentence, type GraphEdge, type GraphNode } from '../src/charts/graph.js';
import { NetworkGraph } from '../src/charts/network-graph.js';
import { describeDistribution, distributionSentence } from '../src/charts/scale.js';

afterEach(cleanup);

const BINS: DistributionBin[] = [
  { label: 'Mo', v: 1200, reference: 900 },
  { label: 'Di', v: null, reference: 1000 },
  { label: 'Mi', v: 3400, reference: null },
];

describe('describeDistribution', () => {
  it('builds its sentence from a summary, in a locale', () => {
    expect(
      describeDistribution(BINS, 'Leser', 'x', {
        summary: (s) => `${s.name}:${s.measured}/${s.bins}:${s.number(s.total)}:${s.peak?.label}`,
      }),
    ).toBe('Leser:2/3:4,600:Mi');
    expect(describeDistribution(BINS, 'A', undefined, { locale: 'de-DE' })).toBe(
      'A: 3 bins, 4.600 in total, highest in Mi at 3.400, 1 bin not measured.',
    );
    expect(distributionSentence({ bins: 1, measured: 0, total: 0, peak: null, number: String })).toBe(
      'Distribution: no data',
    );
  });
});

describe('Distribution labels', () => {
  const LABELS = {
    value: 'Wert',
    reference: 'Bezug',
    empty: 'Keine Klassen',
    notMeasured: 'nicht gemessen',
    instructions: 'Pfeiltasten.',
    tableCaption: (names: readonly string[], unit?: string) => `Tabelle ${names.join('+')}${unit ? ` ${unit}` : ''}`,
    noData: 'Keine Daten',
    summary: () => 'Satz.',
  };

  it('replaces every fixed word, and formats in a locale', () => {
    const { container, rerender } = render(<Distribution bins={BINS} labels={LABELS} locale="de-DE" showTable />);
    const plot = screen.getByRole('img');
    expect(plot.getAttribute('aria-label')).toBe('Satz. Satz. Pfeiltasten.');
    expect(container.querySelector('caption')!.textContent).toBe('Tabelle Wert+Bezug');
    expect(screen.getAllByText('Keine Daten').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3.400').length).toBeGreaterThan(0);

    plot.focus();
    fireEvent.keyDown(plot, { key: 'Home' });
    fireEvent.keyDown(plot, { key: 'ArrowRight' });
    const readout = document.querySelector('output')!.textContent;
    expect(readout).toContain('Wert nicht gemessen');
    expect(readout).toContain('Bezug 1.000');

    rerender(<Distribution bins={[{ label: 'A', v: 1 }]} unit="h" labels={LABELS} />);
    expect(container.querySelector('caption')!.textContent).toBe('Tabelle Wert h');
    rerender(<Distribution bins={[]} labels={LABELS} />);
    expect(screen.getByText('Keine Klassen')).toBeTruthy();
  });
});

const NODES: GraphNode[] = [
  { id: 'a', label: 'Ada', weight: 1200, group: 'x' },
  { id: 'b', weight: 3 },
  { id: 'c', weight: 2 },
];
const EDGES: GraphEdge[] = [
  { from: 'a', to: 'b' },
  { from: 'a', to: 'c' },
];

describe('describeGraph', () => {
  it('builds its sentence from a summary, in a locale', () => {
    expect(
      describeGraph(NODES, EDGES, 2, {
        summary: (s) => `${s.nodes}/${s.edges}/${s.shown}/${s.hidden}/${s.top?.label}/${s.number(s.top!.weight)}`,
        locale: 'de-DE',
      }),
    ).toBe('3/2/2/1/Ada/1.200');
    expect(graphSentence({ nodes: 0, edges: 0, shown: 0, hidden: 0, top: null, number: String })).toBe(
      'Network graph: no nodes',
    );
  });
});

describe('NetworkGraph labels', () => {
  const LABELS = {
    unknown: 'Unbekannt.',
    empty: 'Leer.',
    counts: (n: string, c: string) => `${n} Knoten, ${c} Kanten`,
    top: (limit: string) => `beste ${limit}`,
    instructions: 'Pfeiltasten.',
    selectHint: 'Knoten wählen.',
    tableCaption: 'Knotentabelle',
    node: 'Knoten',
    connections: 'Kanten',
    group: 'Gruppe',
    noGroup: 'Keine',
    belowCap: (hidden: string, limit: string) => `${hidden} unter ${limit}`,
    nodeTitle: (node: string, count: string) => `${node}: ${count} Kanten`,
    summary: () => 'Netz.',
  };

  it('replaces every fixed word, and formats in a locale', () => {
    const { rerender } = render(
      <NetworkGraph
        nodes={NODES}
        edges={EDGES}
        limit={2}
        limitOptions={[2, 1000]}
        labels={LABELS}
        locale="de-DE"
        renderDetail={() => null}
      />,
    );
    expect(screen.getByText('3 Knoten, 2 Kanten')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'beste 1.000' })).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Netz. Pfeiltasten.');
    expect(screen.getByText('Knoten wählen.')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Knotentabelle' })).toBeTruthy();
    expect(screen.getByText('Ada: 1.200 Kanten', { selector: 'title' })).toBeTruthy();
    for (const word of ['Knoten', 'Kanten', 'Gruppe', 'Keine', '1.200', '1 unter 2']) {
      expect(screen.getAllByText(word).length).toBeGreaterThan(0);
    }
    rerender(<NetworkGraph nodes={[]} edges={[]} labels={LABELS} />);
    expect(screen.getByText('Leer.')).toBeTruthy();
    rerender(<NetworkGraph nodes={[]} edges={[]} labels={LABELS} error="x" />);
    expect(screen.getByRole('alert').textContent).toContain('Unbekannt.');
  });
});

describe('Distribution cursor', () => {
  it('reads nothing when new, shorter data leaves the cursor past the end', () => {
    const { rerender } = render(<Distribution bins={BINS} />);
    const plot = screen.getByRole('img');
    plot.focus();
    fireEvent.keyDown(plot, { key: 'End' });
    expect(document.querySelector('output')!.textContent).toContain('Mi');
    rerender(<Distribution bins={BINS.slice(0, 1)} />);
    expect(document.querySelector('output')!.textContent).toBe('');
  });
});
