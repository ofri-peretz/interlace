import Image from "next/image";
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

// Structured data so search engines connect the brand, its author and the
// product sites (Google sent 0 visits in the 30 days to 2026-10-11). Static
// constants only, so JSON.stringify output is safe to inline.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://interlace.tools/#org",
      name: "Interlace",
      url: "https://interlace.tools",
      logo: "https://interlace.tools/icon-512.png",
      founder: { "@id": "https://ofriperetz.dev/#person" },
      sameAs: ["https://github.com/ofri-peretz"],
    },
    {
      "@type": "Person",
      "@id": "https://ofriperetz.dev/#person",
      name: "Ofri Peretz",
      url: "https://ofriperetz.dev",
      sameAs: [
        "https://github.com/ofri-peretz",
        "https://www.linkedin.com/in/ofri-peretz",
      ],
    },
    ...[
      ["Interlace ESLint plugins", "https://eslint.interlace.tools"],
      ["burgee", "https://burgee.interlace.tools"],
      ["Interlace Serverless plugins", "https://serverless.interlace.tools"],
      ["Interlace UI", "https://ds.interlace.tools"],
    ].map(([name, url]) => ({
      "@type": "SoftwareSourceCode",
      name,
      url,
      license: "https://opensource.org/licenses/MIT",
      programmingLanguage: "TypeScript",
      author: { "@id": "https://ofriperetz.dev/#person" },
      publisher: { "@id": "https://interlace.tools/#org" },
    })),
  ],
};

export default async function HomePage() {
  const downloads = await getDownloadsMilestone();

  // Fumadocs `HomeLayout` already wraps children in `<main id="nd-home-layout">`,
  // so this page must NOT add its own `<main>` — duplicate landmarks fail
  // axe's `landmark-no-duplicate-main` and `landmark-main-is-top-level`.
  // Use a plain `<div>` for layout flow.
  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react-features/no-danger -- static constants, see JSON_LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <LandingHero downloads={downloads} />

      {/* Products directory — straight under the hero, so a visitor sees
          where to go on the first screen. */}
      <section id="products" className="px-6 pt-12 pb-16 md:pt-16 md:pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold">Pick your tool</h2>
            <p className="mt-3 text-fd-muted-foreground">
              Each one has its own site, docs and release schedule. All free
              and MIT-licensed.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Install commands name real published packages. The ESLint
                plugins are UNSCOPED (`eslint-plugin-*`), ESLint's own
                resolution convention; locked by
                src/__tests__/package-naming-lock.test.ts. */}
            <ProductCard
              name="ESLint plugins"
              badge="eslint.interlace.tools"
              tagline={`${numbers.plugins.total} ESLint plugins and ${numbers.rules.total} rules that find security bugs and mistakes in JavaScript and TypeScript, including code written by AI. Error messages tell you how to fix the problem.`}
              href="https://eslint.interlace.tools/?utm_source=interlace&utm_medium=card"
              icon={<ShieldCheck className="size-5" />}
              status="shipping"
              install="npm i -D eslint-plugin-secure-coding"
              github="https://github.com/ofri-peretz/eslint?utm_source=interlace&utm_medium=card"
            />
            {/* The pitch is burgee's canonical one, locked in its own repo by
                scripts/pitch-lock.test.ts — say it the same way here. */}
            <ProductCard
              name="burgee"
              badge="burgee.interlace.tools"
              tagline="A CLI framework for Node.js. Everything a CLI needs that isn't your CLI. Written once, served to humans and agents alike."
              href="https://burgee.interlace.tools/?utm_source=interlace&utm_medium=card"
              icon={<Terminal className="size-5" />}
              status="shipping"
              install="npm i burgee"
              github="https://github.com/ofri-peretz/burgee?utm_source=interlace&utm_medium=card"
            />
            <ProductCard
              name="Serverless plugins"
              badge="serverless.interlace.tools"
              tagline="Plugins for the Serverless Framework on AWS: API Gateway caching and per-function IAM roles. Remove a plugin and it cleans up what it created, so nothing keeps billing you."
              href="https://serverless.interlace.tools/?utm_source=interlace&utm_medium=card"
              icon={<Server className="size-5" />}
              status="shipping"
              install="npm i -D @interlace/serverless-api-gateway-caching"
              github="https://github.com/ofri-peretz/serverless?utm_source=interlace&utm_medium=card"
            />
            {/* Not on npm: components install through the shadcn CLI. The
                URL form, because `@interlace` is not in shadcn's public
                registry index, so `add @interlace/button` fails on a fresh
                project. */}
            <ProductCard
              name="Interlace UI"
              badge="ds.interlace.tools"
              tagline="The design system these sites are built with. Accessible React components, tested in dark mode and right-to-left, that you copy into your app."
              href="https://ds.interlace.tools/?utm_source=interlace&utm_medium=card"
              icon={<Palette className="size-5" />}
              status="shipping"
              install="npx shadcn@latest add https://ds.interlace.tools/r/button.json"
              github="https://github.com/ofri-peretz/interlace?utm_source=interlace&utm_medium=card"
            />
          </div>
        </div>
      </section>

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

      {/* Who builds this: a person behind the tools reads as more
          trustworthy than a brand name alone. */}
      <section className="border-t border-fd-border px-6 py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <Image
            src="/ofri-profile.webp"
            alt="Ofri Peretz"
            width={96}
            height={96}
            className="size-24 rounded-full border border-fd-border object-cover"
          />
          <h2 className="text-3xl font-bold">Who builds this</h2>
          <p className="max-w-xl text-fd-muted-foreground">
            I&apos;m Ofri Peretz, an engineering manager. I build these tools in
            the open, measure what they catch, and write about it, so you can
            check the work before you trust it.
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
              href="https://www.linkedin.com/in/ofri-peretz"
              className="inline-flex items-center gap-2 rounded-lg border border-fd-border bg-fd-card px-6 py-3 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
            >
              LinkedIn
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
      <div className="mb-3 inline-flex rounded-lg bg-fd-primary/10 p-2.5 text-fd-primary">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-fd-muted-foreground">
        {description}
      </p>
      <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-fd-primary">
        Read more
        <ArrowRight className="size-3" />
      </div>
    </Link>
  );
}
