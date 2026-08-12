import type { KeyboardPath } from '@/lib/behavior';

import { BehaviorSubsection, repoHref } from './section';

/**
 * The keyboard path, step by step, exactly as the interaction test drives it.
 *
 * Of the nine registries benchmarked in DESIGN-SYSTEM-PLAN.md §5.x, none
 * publishes one of these. The reason it is cheap for us and expensive for them
 * is that we are not writing it: `scripts/build-behavior-map.mjs` reads the
 * `step()` titles and the `userEvent.keyboard()` calls out of the Storybook
 * `play` function CI runs. A step that stops running stops being printed.
 */

function Kbd({ combo }: { combo: string }) {
  // `Shift+F10` renders as two caps with a joiner, because that is how a
  // reader has to press it.
  const keys = combo.split('+');
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 ? (
            <span className="text-muted-foreground text-xs" aria-hidden>
              +
            </span>
          ) : null}
          <kbd className="border-border bg-background text-foreground rounded-md border px-1.5 py-0.5 font-mono text-xs shadow-xs">
            {key}
          </kbd>
        </span>
      ))}
    </span>
  );
}

export function KeyboardPathSection({
  path,
  storybookUrl,
}: {
  path: KeyboardPath;
  storybookUrl: string;
}) {
  const pressed = path.steps.reduce((n, s) => n + s.keys.length, 0);

  return (
    <BehaviorSubsection
      title="Keyboard path"
      source={path.storyFile}
      sourceHref={repoHref(path.storyFile)}
      summary={
        <>
          {path.steps.length} step{path.steps.length === 1 ? '' : 's'},{' '}
          {pressed} key press{pressed === 1 ? '' : 'es'} — replayed on every PR
          by the <code className="text-foreground font-mono">play</code>{' '}
          function of{' '}
          <a
            href={`${storybookUrl}/?path=/story/${path.storyId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {path.storyExport}
          </a>
          . Axe cannot press a key, so this — not the a11y scan — is what proves
          the component is operable without a mouse.
        </>
      }
    >
      <ol className="space-y-3">
        {path.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="border-border text-muted-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm">{step.title}</span>
              {step.keys.length > 0 ? (
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {step.keys.map((key, k) => (
                    <Kbd key={k} combo={key} />
                  ))}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      {path.escapeLocked ? (
        <p className="border-border text-muted-foreground mt-4 border-t pt-4 text-xs">
          <span className="text-foreground font-semibold">
            Escape is locked, not merely exercised.
          </span>{' '}
          This primitive is in{' '}
          <code className="text-foreground font-mono">KEYBOARD_DRIVEN</code> +{' '}
          <code className="text-foreground font-mono">MUST_ASSERT_ESCAPE</code>{' '}
          — deleting the dismissal assertion from the story fails{' '}
          <code className="text-foreground font-mono">
            overlay-nav-keyboard-lock
          </code>
          , so the path above cannot quietly stop being tested.
        </p>
      ) : null}
    </BehaviorSubsection>
  );
}
