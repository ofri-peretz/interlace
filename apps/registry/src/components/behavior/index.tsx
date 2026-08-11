import {
  COVERAGE,
  DATA_STATES,
  MATRIX,
  SOURCES,
  type ComponentBehavior,
} from '@/lib/behavior';

import { ContrastTableSection } from './contrast-table';
import { KeyboardPathSection } from './keyboard-path';
import { RuntimeContractSection } from './runtime-contract';
import { StateUnionSection } from './state-union';
import { TextEquivalentSection } from './text-equivalent';

/**
 * The Behavior section of `/c/<name>` — composed of five independent
 * subsections, each of which renders nothing when the component has nothing to
 * say on that axis.
 *
 * Composition rather than one component with twenty props: the page hands over
 * the behaviour record and the two contract facts that live on the registry
 * item, and each subsection owns its own typed surface. Adding "hover/focus
 * parity" later is a new file plus one line here, not a sixth boolean.
 *
 * Why this section exists at all: of the nine registries studied in
 * DESIGN-SYSTEM-PLAN.md §5.x, exactly one documents behaviour, and none
 * publishes a keyboard path, a measured contrast table, an sr-only data
 * equivalent or a coverage number. We had all four — locked in tests, invisible
 * on the site.
 */
export function BehaviorSection({
  behavior,
  isClient,
  minViewport,
  sourcePath,
  storybookUrl,
}: {
  behavior: ComponentBehavior;
  isClient: boolean;
  minViewport: number | null;
  /** Repo-relative path of the component's own source. */
  sourcePath: string;
  storybookUrl: string;
}) {
  return (
    <section id="behavior" className="mt-12 scroll-mt-20">
      <h2 className="text-xl font-semibold">Behavior</h2>
      <p className="text-muted-foreground mt-2 max-w-prose text-sm">
        What this component <em>does</em> — the keyboard path, the measured
        colour, the text equivalent and the states it can be in. Every figure
        below is read out of the test or the source that enforces it by{' '}
        <code className="text-foreground font-mono">
          scripts/build-behavior-map.mjs
        </code>
        , so nothing here can outlive the gate that keeps it true.
      </p>

      {behavior.keyboard ? (
        <KeyboardPathSection
          path={behavior.keyboard}
          storybookUrl={storybookUrl}
        />
      ) : null}

      {behavior.states.length > 0 ? (
        <StateUnionSection
          states={behavior.states}
          facets={DATA_STATES}
          source={SOURCES.dataStates}
        />
      ) : null}

      {behavior.contrast.length > 0 ? (
        <ContrastTableSection
          rows={behavior.contrast}
          matrix={MATRIX}
          source={SOURCES.contrast}
        />
      ) : null}

      <TextEquivalentSection
        alternative={behavior.textAlternative}
        sourcePath={sourcePath}
      />

      <RuntimeContractSection
        isClient={isClient}
        minViewport={minViewport}
        coverage={COVERAGE}
        inCoverageGate={behavior.coverage.inGate}
      />
    </section>
  );
}
