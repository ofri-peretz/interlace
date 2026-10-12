import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Server,
  Gauge,
  Layers,
  Palette,
  Terminal,
} from "lucide-react";
import { LandingHero } from "@/components/home/landing-hero";
import { ProductCard } from "@/components/home/product-card";
import numbers from "@/data/interlace-numbers.json";
import { getDownloadsMilestone } from "@/lib/downloads";

export default async function HomePage() {
  const downloads = await getDownloadsMilestone();

  // Fumadocs `HomeLayout` already wraps children in `<main id="nd-home-layout">`,
  // so this page must NOT add its own `<main>` — duplicate landmarks fail
  // axe's `landmark-no-duplicate-main` and `landmark-main-is-top-level`.
  // Use a plain `<div>` for layout flow.
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHero downloads={downloads} />

      {/* Principles. Full-opacity bg only — `/50` darkens the composite
          surface enough that `text-fd-muted-foreground` drops below AA in
          dark mode (verified by the live-page axe sweep). */}
      <section className="border-t border-fd-border bg-fd-card px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold">
            Three rules every tool follows
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            <PrincipleCard
              icon={<Gauge className="size-5" />}
              title="Numbers you can check"
              description="Every claim on our sites comes from a test or a benchmark you can run yourself."
              href="/docs/concepts/evidence-philosophy"
            />
            <PrincipleCard
              icon={<Layers className="size-5" />}
              title="One way to read the docs"
              description="Every product site looks and works the same, so once you know one, you know them all."
              href="/docs/concepts/ecosystem-map"
            />
            <PrincipleCard
              icon={<ShieldCheck className="size-5" />}
              title="Few dependencies"
              description="We add a dependency only when we can explain why. Less to install, less to audit."
              href="/docs/concepts/what-is-interlace"
            />
          </div>
        </div>
      </section>

      {/* Products directory */}
      <section id="products" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold">What we build</h2>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Names are the real npm identifiers. The ESLint plugins are
                UNSCOPED (`eslint-plugin-*`) — ESLint's own resolution
                convention — so prefixing them with the org scope would send
                readers to packages that do not exist. Locked by
                src/__tests__/package-naming-lock.test.ts. */}
            <ProductCard
              name="eslint-plugin-*"
              badge="eslint.interlace.tools"
              tagline={`${numbers.plugins.total} ESLint plugins that find security bugs and mistakes in JavaScript and TypeScript, including code written by AI.`}
              href="https://eslint.interlace.tools/?utm_source=interlace&utm_medium=card"
              icon={<ShieldCheck className="size-5" />}
              tags={["ESLint", "Security", "a11y", "TypeScript"]}
              status="shipping"
            />
            {/* The pitch is burgee's canonical one, locked in its own repo by
                scripts/pitch-lock.test.ts — say it the same way here. */}
            <ProductCard
              name="burgee"
              badge="burgee.interlace.tools"
              tagline="A CLI framework for Node.js. Everything a CLI needs that isn't your CLI. Written once, served to humans and agents alike."
              href="https://burgee.interlace.tools/?utm_source=interlace&utm_medium=card"
              icon={<Terminal className="size-5" />}
              tags={["CLI", "Node.js", "Agents", "MCP"]}
              status="shipping"
            />
            <ProductCard
              name="@interlace/serverless-*"
              badge="serverless.interlace.tools"
              tagline="Plugins for the Serverless Framework on AWS: API Gateway caching and per-function IAM roles, cleaned up when you remove them."
              href="https://serverless.interlace.tools/?utm_source=interlace&utm_medium=card"
              icon={<Server className="size-5" />}
              tags={["Serverless", "AWS", "API Gateway", "TypeScript"]}
              status="shipping"
            />
            <ProductCard
              name="@interlace/ui"
              badge="ds.interlace.tools"
              tagline="The design system these sites are built with. React components you install with the shadcn CLI."
              href="https://ds.interlace.tools/?utm_source=interlace&utm_medium=card"
              icon={<Palette className="size-5" />}
              tags={["React", "Tailwind", "shadcn", "a11y"]}
              status="shipping"
            />
          </div>
        </div>
      </section>

      {/* Who builds this: a person behind the tools reads as more
          trustworthy than a brand name alone. */}
      <section className="border-t border-fd-border px-6 py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h2 className="text-3xl font-bold">Who builds this</h2>
          <p className="max-w-xl text-fd-muted-foreground">
            I&apos;m Ofri Peretz, an engineering manager. I build these tools in
            the open and write about what they find.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://ofriperetz.dev/?utm_source=interlace&utm_medium=about"
              className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-6 py-3 text-sm font-medium text-fd-primary-foreground transition-all hover:bg-fd-primary/90 hover:shadow-lg hover:shadow-fd-primary/25"
            >
              Read the blog
              <ArrowRight className="size-4" />
            </a>
            <a
              href="https://github.com/ofri-peretz?utm_source=interlace&utm_medium=about"
              className="inline-flex items-center gap-2 rounded-lg border border-fd-border bg-fd-card px-6 py-3 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
            >
              GitHub
            </a>
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
