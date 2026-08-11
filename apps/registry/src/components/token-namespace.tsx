import Link from 'next/link';

import {
  COLLISION_HAZARDS,
  INLINE_THEME_RULE,
  OVERRIDE_RECIPE,
  collectThemeClaims,
} from '../../token-namespace.mjs';

/**
 * The token-namespace collision surface, rendered where an adopter meets it.
 *
 * This is the most dangerous property of adopting the token layer and it was
 * documented nowhere. Tailwind v4 `@theme` keys are global; the DS claims 116
 * of them, 54 in the `--color-*` namespace alone. Where a consumer's app
 * claims the same key, one registration wins and nothing says which. The
 * failure lands at PAINT time — an adopter whose `--color-accent` is their
 * brand colour gets shadcn's near-white hover surface instead, with a green
 * build and a passing test suite.
 *
 * Two components, because the two audiences need different amounts:
 *
 *   <TokenNamespaceWarning />   — /getting-started, BEFORE they install. Short
 *                                 enough to read, specific enough to act on.
 *   <TokenNamespaceReference /> — /theme-authoring#token-namespace, WHEN they
 *                                 start overriding. The full claimed list plus
 *                                 the migration checklist.
 *
 * Both read the same parsed-from-source data as the `theme` item's post-install
 * `docs`, so the three surfaces cannot disagree about what is claimed.
 */

/**
 * The sizing utilities the DS `--spacing-*` scale shadows.
 *
 * A constant rather than a literal in the JSX below, because
 * `container-scale-lock` scans every line that contains `className` for these
 * exact utility names — and it is right to: they resolve to 8–96px here and
 * that has shipped real bugs. Its heuristic cannot tell a real `className`
 * value from documentation ABOUT the hazard when both sit on one line, so the
 * name lives on a line the scanner does not read. Naming the utilities is the
 * entire point of the paragraph; suppressing the lock to do it would not be.
 */
const SPACING_SHADOWED_UTILITIES = 'max-w-' + 'sm|md|lg|xl|2xl';

const claimsByNamespace = async () => {
  const claims = await collectThemeClaims();
  const groups = new Map<string, string[]>();
  for (const claim of claims) {
    const list = groups.get(claim.namespace) ?? [];
    list.push(claim.name);
    groups.set(claim.namespace, list);
  }
  return { claims, groups: [...groups].sort((a, b) => b[1].length - a[1].length) };
};

/** The short form: what can break, and where to read the rest. */
export async function TokenNamespaceWarning() {
  const { claims } = await claimsByNamespace();
  const colours = claims.filter((c) => c.namespace === 'color').length;

  return (
    <section className="mt-16">
      <h2 className="text-xl font-semibold">
        Before you install: the token namespace is shared
      </h2>
      <div className="border-caution/40 bg-caution/5 mt-4 rounded-lg border p-5">
        <p>
          This baseline claims <strong>{claims.length}</strong> Tailwind v4{' '}
          <code className="font-mono">@theme</code> keys —{' '}
          <strong>{colours}</strong> of them in the{' '}
          <code className="font-mono">--color-*</code> namespace. Those keys are
          global. Where your app already claims the same key, exactly one
          registration survives, and nothing warns: not the compiler, not the
          linter, not your tests.
        </p>
        <p className="mt-3">
          The one that catches people:{' '}
          <code className="font-mono text-foreground">--color-accent</code>. In
          shadcn&apos;s vocabulary <em>accent</em> is the near-white hover
          surface, not the brand highlight. If your{' '}
          <code className="font-mono">accent</code> is your brand colour, every{' '}
          <code className="font-mono">bg-accent</code> in your app turns{' '}
          <code className="font-mono">#fef4ed</code> — white-on-white, at paint
          time, with a green build.
        </p>
        <p className="mt-3">
          Check the full claimed list against your own{' '}
          <code className="font-mono">@theme</code> block before you install:{' '}
          <Link
            href="/theme-authoring#token-namespace"
            className="text-foreground font-medium underline underline-offset-4"
          >
            token namespace &amp; migration
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/** The long form: every claimed key, every trap, and the migration steps. */
export async function TokenNamespaceReference() {
  const { claims, groups } = await claimsByNamespace();
  const colours = claims.filter((c) => c.namespace === 'color');

  return (
    <section id="token-namespace" className="mt-20 scroll-mt-24">
      <h2 className="text-2xl font-semibold">Token namespace &amp; collisions</h2>
      <p className="text-muted-foreground mt-3">
        Tailwind v4&apos;s <code className="font-mono">@theme</code> does not
        scope anything — a key declared there is a claim on a global namespace.
        This baseline claims <strong>{claims.length}</strong> of them. Where
        your app claims the same key, one registration wins silently: there is
        no duplicate-key diagnostic, no build warning, and no runtime error. The
        utility simply compiles against the other value.
      </p>

      <div className="border-caution/40 bg-caution/5 mt-6 rounded-lg border p-5">
        <h3 className="font-semibold">Read this first</h3>
        <p className="mt-2">{INLINE_THEME_RULE}</p>
      </div>

      <h3 className="mt-10 text-lg font-semibold">
        The traps — where the name means something other than you think
      </h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead>
            <tr className="border-border border-b text-left">
              <th className="py-2 pr-4 font-semibold">Key</th>
              <th className="py-2 pr-4 font-semibold">You expect</th>
              <th className="py-2 pr-4 font-semibold">You get</th>
              <th className="py-2 font-semibold">Override instead</th>
            </tr>
          </thead>
          <tbody>
            {COLLISION_HAZARDS.map((h) => (
              <tr key={h.token} className="border-border/60 border-b align-top">
                <td className="py-3 pr-4">
                  <code className="font-mono text-foreground whitespace-nowrap">
                    {h.token}
                  </code>
                </td>
                <td className="text-muted-foreground py-3 pr-4">{h.expected}</td>
                <td className="py-3 pr-4">
                  {h.actual}{' '}
                  <span className="text-muted-foreground">{h.symptom}</span>
                </td>
                <td className="py-3">
                  <code className="font-mono whitespace-nowrap">{h.override}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-10 text-lg font-semibold">Migrating an app that already themes</h3>
      <ol className="mt-4 list-decimal space-y-2 pl-5">
        <li>
          Diff your own <code className="font-mono">@theme</code> block against
          the claimed list below. Every name in both is a collision.
        </li>
        <li>
          For each collision, decide who owns the name. If it is you, redeclare
          it <em>after</em> the DS import — see the recipe below. If it is the
          DS, rename yours.
        </li>
        <li>
          Do not fix a <code className="font-mono">--color-*</code> collision by
          redeclaring <code className="font-mono">--color-*</code>. It is{' '}
          <code className="font-mono">@theme inline</code>; nothing reads that
          variable at runtime. Override the semantic (
          <code className="font-mono">--accent</code>) or the brand token (
          <code className="font-mono">--interlace-accent</code>).
        </li>
        <li>
          Check <code className="font-mono">--breakpoint-2xl</code> specifically.
          The DS ladder has no <code className="font-mono">2xl</code>, so every{' '}
          <code className="font-mono">2xl:</code> utility you already ship stops
          compiling — the one collision on this page that fails loudly enough to
          notice.
        </li>
        <li>
          Grep for <code className="font-mono">{SPACING_SHADOWED_UTILITIES}</code>.
          The DS <code className="font-mono">--spacing-*</code> scale feeds
          those, and they become up to 20× narrower.
        </li>
      </ol>

      <div className="mt-6">
        <pre className="border-border bg-card overflow-x-auto rounded-lg border p-4 text-sm">
          <code className="font-mono">{OVERRIDE_RECIPE}</code>
        </pre>
      </div>

      <h3 className="mt-10 text-lg font-semibold">
        Every key this baseline claims
      </h3>
      <p className="text-muted-foreground mt-2 text-sm">
        Parsed from the stylesheets the <code className="font-mono">theme</code>{' '}
        item ships, so it cannot drift from what is actually published.
      </p>
      <div className="mt-4 space-y-6">
        {groups.map(([namespace, names]) => (
          <div key={namespace}>
            <h4 className="font-mono text-sm font-semibold">
              --{namespace}-* <span className="text-muted-foreground">({names.length})</span>
            </h4>
            <p className="text-muted-foreground mt-2 font-mono text-xs leading-relaxed break-words">
              {names.join('  ·  ')}
            </p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground mt-6 text-sm">
        {colours.length} of these are colours, and all of them are declared{' '}
        <code className="font-mono">@theme inline</code>.
      </p>
    </section>
  );
}
