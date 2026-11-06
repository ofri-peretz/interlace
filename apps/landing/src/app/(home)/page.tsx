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
  FlaskConical,
} from "lucide-react";
import { LandingHero } from "@/components/home/landing-hero";
import { ProductCard } from "@/components/home/product-card";
import { getDownloadsMilestone } from "@/lib/downloads";
import messages from "@/data/brand-messages.json";
import { renderBrand } from "@/lib/brand";

const ICONS: Record<string, React.ReactNode> = {
  eslint: <ShieldCheck className="size-5" />,
  oxmutate: <FlaskConical className="size-5" />,
  burgee: <Terminal className="size-5" />,
  serverless: <Server className="size-5" />,
  ui: <Palette className="size-5" />,
};

const utm = (url: string, medium: string) =>
  `${url}${url.includes("?") ? "&" : "?"}utm_source=interlace&utm_medium=${medium}`;

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
      sameAs: [messages.links.github, messages.links.linkedin],
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
    ...messages.products.map((product) => ({
      "@type": "SoftwareSourceCode",
      name: product.name,
      url: `https://${product.site}`,
      codeRepository: product.github,
      license: "https://opensource.org/licenses/MIT",
      programmingLanguage: "TypeScript",
      author: { "@id": "https://ofriperetz.dev/#person" },
      publisher: { "@id": "https://interlace.tools/#org" },
    })),
  ],
};

const FOOTER: { heading: string; links: [string, string][] }[] = [
  {
    heading: "Products",
    links: messages.products.map((p) => [
      p.name,
      utm(`https://${p.site}/`, "footer"),
    ]),
  },
  {
    heading: "Learn",
    links: [
      ["What is Interlace", "/docs/concepts/what-is-interlace"],
      ["Ecosystem map", "/docs/concepts/ecosystem-map"],
      ["How we measure", "/docs/concepts/how-we-measure"],
    ],
  },
  {
    heading: "Follow",
    links: [
      [messages.ctas.star, messages.links.github],
      [messages.ctas.followDevto, messages.links.devto],
      [messages.ctas.followLinkedin, messages.links.linkedin],
      ["Blog", utm(`${messages.links.author}/`, "footer")],
    ],
  },
];

export default async function HomePage() {
  const downloads = await getDownloadsMilestone();
  const brand = renderBrand(downloads);
  const core = brand.products.filter((p) => p.tier === "core");
  const also = brand.products.filter((p) => p.tier === "also");

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
      <LandingHero downloads={downloads} brand={brand} />

      {/* Products directory — straight under the hero, so a visitor sees
          where to go on the first screen. */}
      <section id="products" className="px-6 pt-10 pb-16 md:pt-16 md:pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center md:mb-10">
            <h2 className="text-3xl font-bold">Pick your tool</h2>
            <p className="mt-3 hidden text-fd-muted-foreground md:block">
              Each one answers one question about AI-written code. All free and
              MIT-licensed.
            </p>
          </div>

          {/* Install commands name real published packages; the ESLint
              plugins are UNSCOPED (`eslint-plugin-*`), locked by
              src/__tests__/package-naming-lock.test.ts. Copy lives in
              src/data/brand-messages.json. */}
          <div className="grid gap-6 md:grid-cols-3">
            {core.map((p) => (
              <ProductCard
                key={p.id}
                name={p.name}
                badge={p.site}
                question={p.question}
                tagline={p.line}
                proof={p.proof}
                href={utm(`https://${p.site}/`, "card")}
                icon={ICONS[p.id]}
                status="shipping"
                install={p.install}
                github={utm(p.github, "card")}
                ctas={brand.ctas}
              />
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-fd-muted-foreground">
            <span className="font-semibold text-fd-foreground">
              Coming next: {brand.next.name}.
            </span>{" "}
            {brand.next.question} {brand.next.line}
          </p>

          <h2 className="mt-14 mb-6 text-center font-mono text-xs uppercase tracking-widest text-fd-muted-foreground">
            Also from Interlace
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {also.map((p) => (
              <ProductCard
                key={p.id}
                name={p.name}
                badge={p.site}
                tagline={p.line}
                href={utm(`https://${p.site}/`, "card")}
                icon={ICONS[p.id]}
                status="shipping"
                install={p.install}
                github={utm(p.github, "card")}
                ctas={brand.ctas}
              />
            ))}
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
            I&apos;m Ofri Peretz, an engineering leader. I build these tools in
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

      {/* Footer: every page a visitor can go next, in one place. */}
      <footer className="mt-auto border-t border-fd-border px-6 pt-12 pb-8">
        <div className="mx-auto max-w-5xl">
          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-8 text-sm md:grid-cols-3"
          >
            {FOOTER.map(({ heading, links }) => (
              <div key={heading}>
                <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-fd-muted-foreground">
                  {heading}
                </h2>
                <ul className="space-y-2">
                  {links.map(([label, href]) => (
                    <li key={href}>
                      <a
                        href={href}
                        className="text-fd-foreground hover:text-fd-primary"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <p className="mt-10 border-t border-fd-border pt-6 text-sm text-fd-muted-foreground">
            {brand.footer}
          </p>
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
