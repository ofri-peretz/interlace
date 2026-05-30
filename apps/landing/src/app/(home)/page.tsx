import Link from "next/link";
import { ArrowRight, ShieldCheck, Server, Gauge, Layers } from "lucide-react";
import { LandingHero } from "@/components/home/landing-hero";
import { ProductCard } from "@/components/home/product-card";

export default function HomePage() {
  // Fumadocs `HomeLayout` already wraps children in `<main id="nd-home-layout">`,
  // so this page must NOT add its own `<main>` — duplicate landmarks fail
  // axe's `landmark-no-duplicate-main` and `landmark-main-is-top-level`.
  // Use a plain `<div>` for layout flow.
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHero />

      {/* Principles. Full-opacity bg only — `/50` darkens the composite
          surface enough that `text-fd-muted-foreground` drops below AA in
          dark mode (verified by the live-page axe sweep). */}
      <section className="border-t border-fd-border bg-fd-card px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-3xl font-bold">
            What every Interlace tool gets right
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-fd-muted-foreground">
            Three rules that apply to every product in the family.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            <PrincipleCard
              icon={<Gauge className="size-5" />}
              title="Every claim is measured"
              description="No 'blazingly fast' without a benchmark file. Every comparative claim cites a versioned result you can reproduce."
              href="/docs/concepts/evidence-philosophy"
            />
            <PrincipleCard
              icon={<Layers className="size-5" />}
              title="Same baseline everywhere"
              description="One docs theme, one navigation, one set of components — synced across every product site so they cannot drift."
              href="/docs/concepts/ecosystem-map"
            />
            <PrincipleCard
              icon={<ShieldCheck className="size-5" />}
              title="Zero ghost dependencies"
              description="Every runtime dep is one we can defend. TypeScript-native, no lodash micro-packages, no prototype pollution."
              href="/docs/concepts/what-is-interlace"
            />
          </div>
        </div>
      </section>

      {/* Products directory */}
      <section id="products" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-3xl font-bold">The products</h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-fd-muted-foreground">
            Each product has its own subdomain, its own release cadence, and its
            own evidence files — but they all share this brand and this docs
            experience.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <ProductCard
              name="@interlace/eslint-*"
              badge="eslint.interlace.tools"
              tagline="A suite of ~24 ESLint plugins for security, accessibility, and modern framework correctness — each with a measured corpus and explicit comparison set."
              href="https://eslint.interlace.tools"
              icon={<ShieldCheck className="size-5" />}
              tags={["ESLint", "Security", "a11y", "TypeScript"]}
              status="shipping"
            />
            <ProductCard
              name="@interlace/serverless-*"
              badge="serverless.interlace.tools"
              tagline="TypeScript-native replacements for community Serverless Framework plugins. Cleanup on removal, CLI commands, no ghost billing."
              href="https://serverless.interlace.tools"
              icon={<Server className="size-5" />}
              tags={["Serverless", "AWS", "API Gateway", "TypeScript"]}
              status="shipping"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-fd-border px-6 py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h2 className="text-3xl font-bold">Read the philosophy</h2>
          <p className="max-w-xl text-fd-muted-foreground">
            The shortest path to understanding why Interlace exists is the
            concepts section. Five minutes for the topology, the evidence
            contract, and the rubric.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/docs/concepts/what-is-interlace"
              className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-6 py-3 text-sm font-medium text-fd-primary-foreground transition-all hover:bg-fd-primary/90 hover:shadow-lg hover:shadow-fd-primary/25"
            >
              Read the concepts
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="#products"
              className="inline-flex items-center gap-2 rounded-lg border border-fd-border bg-fd-card px-6 py-3 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
            >
              <Layers className="size-4" />
              Browse the products
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-fd-border px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-sm text-fd-muted-foreground md:flex-row">
          <span>
            Built by{" "}
            <a
              href="https://ofriperetz.dev"
              className="font-medium text-fd-foreground hover:text-fd-primary"
            >
              Ofri Peretz
            </a>
          </span>
          <span>MIT License · Independent · Built in the open</span>
        </div>
      </footer>
    </div>
  );
}

function PrincipleCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group relative rounded-xl border border-fd-border bg-fd-card p-6 transition-all duration-300 hover:border-fd-primary/30 hover:bg-fd-accent/5 hover:shadow-lg hover:shadow-fd-primary/5"
    >
      <div className="mb-3 inline-flex rounded-lg bg-fd-primary/10 p-2.5 text-fd-primary transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-fd-muted-foreground">
        {description}
      </p>
      <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-fd-primary opacity-0 transition-opacity group-hover:opacity-100">
        Read more
        <ArrowRight className="size-3" />
      </div>
    </Link>
  );
}
