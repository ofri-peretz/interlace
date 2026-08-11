import Link from 'next/link';

import { ClientServerBadge } from '@/components/client-server-badge';
import { InstallProofLine } from '@/components/install-proof';
import { MinViewportBadge } from '@/components/min-viewport-badge';
import { RegistrySearch } from '@/components/registry-search';
import { SiteNav } from '@/components/site-nav';
import { CATEGORIES, groupByCategory, TIER_CATEGORIES } from '@/lib/categories';
import { loadInstallProof } from '@/lib/install-proof';
import { loadIndex } from '@/lib/registry';

const PRIMARY_INSTALL =
  'npx shadcn@latest add https://ds.interlace.tools/r/button.json';
const ALIAS_INSTALL = 'npx shadcn@latest add @interlace/button';

const STYLE_INSTALL =
  'npx shadcn@latest add https://ds.interlace.tools/r/theme.json';

export default async function HomePage() {
  const [index, proof] = await Promise.all([loadIndex(), loadInstallProof()]);
  const styleItem = index.items.find((i) => i.name === 'theme');
  // Every installable item, not just the primitives — patterns, templates and
  // the vendored effects are 60% of the registry and used to be unbrowsable.
  const components = index.items.filter((i) => i.type !== 'registry:style');
  const grouped = groupByCategory(components);
  const nonEmptyCategories = CATEGORIES.filter(
    (c) => (grouped.get(c.id) ?? []).length > 0,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      {/* ─── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-br from-primary/15 via-background to-background"
        />
        <div
          aria-hidden
          className="absolute -top-32 -right-32 size-112 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-32 size-112 rounded-full bg-primary/15 blur-3xl"
        />

        <div className="relative mx-auto max-w-wide px-6 py-20 sm:py-28">
          <div className="text-muted-foreground inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {components.length} components · 1 theme bundle · WCAG 2.2 AA floor
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            Production-grade React primitives
            <span className="bg-linear-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              {' '}
              for shadcn
            </span>
            .
          </h1>

          <p className="text-muted-foreground mt-5 max-w-prose text-lg sm:text-xl">
            Drop the <code className="font-mono text-foreground">@interlace/ui</code>{' '}
            primitives into any React project with one command. Brand tokens,
            theme bridge, animation keyframes, and a portable 26-rule
            component-modeling floor — installed alongside.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CodeBlock label="Install a primitive" code={PRIMARY_INSTALL} />
          </div>

          <p className="text-muted-foreground mt-4 text-sm">
            Or, after configuring this registry as{' '}
            <code className="font-mono">@interlace</code> in your{' '}
            <code className="font-mono">components.json</code>:{' '}
            <code className="font-mono text-foreground">{ALIAS_INSTALL}</code>
          </p>

          {/*
            The command above is a promise; this is the receipt. Kept to one
            sentence in the hero — the run itself is on /getting-started, where
            a reader who cares about it is already standing.
          */}
          {proof ? (
            <div className="mt-4">
              <InstallProofLine proof={proof} />
            </div>
          ) : null}
        </div>
      </section>

      {/* ─── Theme / CSS modules — the headline section ───────────── */}
      <section className="mx-auto max-w-wide px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div className="min-w-0">
            <div className="text-primary text-xs font-semibold uppercase tracking-wider">
              CSS module export
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              Theme + tokens, installed alongside.
            </h2>
            <p className="text-muted-foreground mt-4">
              Every primitive ships with{' '}
              <code className="text-foreground font-mono">theme</code> as a
              registry dependency. The shadcn CLI bundles the three Interlace
              stylesheets into your project — brand palette, shadcn-bare token
              bridge, animation keyframes — so primitives render the moment
              you import them.
            </p>
            {styleItem ? (
              <p className="text-muted-foreground mt-3 text-sm">
                Install separately:{' '}
                <code className="text-foreground font-mono">
                  npx shadcn@latest add @interlace/theme
                </code>
              </p>
            ) : null}
          </div>
          <div className="min-w-0 space-y-3">
            <CodeBlock label="Install the theme bundle" code={STYLE_INSTALL} />
            <div className="grid gap-3 sm:grid-cols-3">
              <StyleFileCard
                name="tokens.css"
                description="Animation + motion tokens (marquee, shimmer, scale-in)."
              />
              <StyleFileCard
                name="theme.css"
                description="shadcn-bare ↔ fumadocs token bridge; Shiki AAA boosts."
              />
              <StyleFileCard
                name="interlace-theme.css"
                description="Brand burnt-orange palette (light + dark), AAA contrast."
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Or fetch raw:{' '}
              <code className="font-mono break-all">
                /r/styles/&lt;tokens|theme|interlace-theme&gt;.css
              </code>
            </p>
          </div>
        </div>
      </section>

      {/* ─── Three pillars ────────────────────────────────────────── */}
      <section className="border-y border-border bg-card/30">
        <div className="mx-auto max-w-wide px-6 py-16">
          <div className="grid gap-8 sm:grid-cols-3">
            <Pillar
              title="Portable floor"
              body="26-rule component-modeling floor — Tailwind + tokens, mobile-first, locked invariants, zero axe suppressions."
            />
            <Pillar
              title="Engine-agnostic"
              body="Same rules run under ESLint and Oxlint with parity gates; Biome + TSC native on the roadmap."
            />
            <Pillar
              title="Headless behavior"
              body="Built on @base-ui/react primitives. shadcn-canon-compatible source, drop-in via the shadcn CLI."
            />
          </div>
        </div>
      </section>

      {/* ─── Categorized components ──────────────────────────────── */}
      <section className="mx-auto max-w-wide px-6 py-20">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-primary text-xs font-semibold uppercase tracking-wider">
              Everything in the registry
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              {components.length} items, {nonEmptyCategories.length} categories
            </h2>
            <p className="text-muted-foreground mt-2">
              Grouped by intent — what you reach for, not by implementation
              lineage. Visual previews + interactive variants live on{' '}
              <a
                href="https://storybook.interlace.tools"
                className="text-foreground underline-offset-4 hover:underline"
              >
                storybook.interlace.tools
              </a>
              .
            </p>
          </div>
        </div>

        {/* Search across every item — ⌘K focuses it */}
        <div className="mt-8">
          <RegistrySearch
            items={components}
            tiers={TIER_CATEGORIES.filter((tier) =>
              components.some((item) => item.meta?.tier === tier.id),
            ).map((tier) => [tier.id, tier.title] as [string, string])}
          />
        </div>

        {/* Category jump-links */}
        <nav
          aria-label="Component categories"
          className="mt-8 flex flex-wrap gap-2"
        >
          {nonEmptyCategories.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              className="border-border hover:border-primary/60 hover:bg-card rounded-full border bg-card/40 px-3 py-1 text-xs transition-colors"
            >
              {c.title}{' '}
              <span className="text-muted-foreground">
                · {(grouped.get(c.id) ?? []).length}
              </span>
            </a>
          ))}
        </nav>

        {nonEmptyCategories.map((category) => {
          const items = grouped.get(category.id) ?? [];
          return (
            <div key={category.id} id={category.id} className="mt-12 scroll-mt-20">
              <div className="flex items-baseline gap-3">
                <h3 className="text-xl font-semibold tracking-tight">
                  {category.title}
                </h3>
                <span className="text-muted-foreground font-mono text-xs">
                  {items.length}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 max-w-prose text-sm">
                {category.description}
              </p>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={`/c/${item.name}`}
                      className="group border-border hover:border-primary/60 hover:bg-card flex h-full flex-col justify-between gap-3 rounded-lg border bg-card/40 p-4 transition-all"
                    >
                      <div>
                        <h4 className="font-semibold">{item.title}</h4>
                        <p className="text-muted-foreground mt-1 font-mono text-xs">
                          @interlace/{item.name}
                        </p>
                      </div>
                      {item.meta ? (
                        <div className="flex flex-wrap gap-1.5">
                          <ClientServerBadge isClient={item.meta.client} />
                          {item.meta.minViewport !== null ? (
                            <MinViewportBadge value={item.meta.minViewport} />
                          ) : null}
                        </div>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {/* ─── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="text-muted-foreground mx-auto flex max-w-wide flex-col gap-2 px-6 py-10 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            Source of truth:{' '}
            <a
              href="https://github.com/ofri-peretz/interlace/tree/main/packages/ui/src/primitives"
              className="text-foreground underline-offset-4 hover:underline"
            >
              packages/ui/src/primitives
            </a>
          </div>
          <div className="flex gap-5">
            <a
              href="https://storybook.interlace.tools"
              className="hover:text-foreground transition-colors"
            >
              Storybook
            </a>
            <a
              href="https://eslint.interlace.tools"
              className="hover:text-foreground transition-colors"
            >
              Plugin docs
            </a>
            <a
              href="/r/index.json"
              className="hover:text-foreground transition-colors"
            >
              Registry index
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="text-muted-foreground border-border border-b px-4 py-2 text-xs font-medium">
        {label}
      </div>
      <pre className="overflow-x-auto px-4 py-3">
        <code className="font-mono text-sm">{code}</code>
      </pre>
    </div>
  );
}

function StyleFileCard({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <div className="border-border bg-background rounded-lg border p-3">
      <div className="font-mono text-sm font-semibold">{name}</div>
      <p className="text-muted-foreground mt-1 text-xs leading-snug">
        {description}
      </p>
    </div>
  );
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {body}
      </p>
    </div>
  );
}
