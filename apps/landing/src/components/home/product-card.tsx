import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { BorderBeam } from "#interlace/components/ui/border-beam";

export interface ProductCardProps {
  name: string;
  tagline: string;
  href: string;
  badge: string;
  icon: ReactNode;
  tags: string[];
  status: "shipping" | "beta" | "planned";
}

const statusLabel: Record<ProductCardProps["status"], string> = {
  shipping: "Shipping",
  beta: "Beta",
  planned: "Planned",
};

const statusClasses: Record<ProductCardProps["status"], string> = {
  shipping:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  beta: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  planned: "bg-fd-muted text-fd-muted-foreground border-fd-border",
};

export function ProductCard({
  name,
  tagline,
  href,
  badge,
  icon,
  tags,
  status,
}: ProductCardProps) {
  const isExternal = href.startsWith("http");
  const Wrapper = ({ children }: { children: ReactNode }) =>
    isExternal ? (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="group relative block overflow-hidden rounded-xl border border-fd-border bg-fd-card p-6 transition-all duration-300 hover:border-fd-primary/40 hover:shadow-xl hover:shadow-fd-primary/10"
      >
        {children}
      </a>
    ) : (
      <Link
        href={href}
        className="group relative block overflow-hidden rounded-xl border border-fd-border bg-fd-card p-6 transition-all duration-300 hover:border-fd-primary/40 hover:shadow-xl hover:shadow-fd-primary/10"
      >
        {children}
      </Link>
    );

  return (
    <Wrapper>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="inline-flex size-10 items-center justify-center rounded-lg bg-fd-primary/10 text-fd-primary transition-transform duration-300 group-hover:scale-110">
          {icon}
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses[status]}`}
        >
          {statusLabel[status]}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-mono text-lg font-semibold text-fd-foreground transition-colors group-hover:text-fd-primary">
          {name}
        </h3>
        {isExternal && (
          <ExternalLink className="size-3.5 text-fd-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        )}
      </div>

      <p className="mb-3 text-xs uppercase tracking-wider text-fd-muted-foreground">
        {badge}
      </p>

      <p className="mb-4 text-sm leading-relaxed text-fd-muted-foreground">
        {tagline}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-fd-accent px-2 py-0.5 text-xs text-fd-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>

      {status !== "planned" && (
        <BorderBeam
          size={60}
          duration={10}
          colorFrom="hsl(263 80% 60%)"
          colorTo="hsl(280 80% 60%)"
          borderWidth={1}
          delay={Math.random() * 5}
        />
      )}
    </Wrapper>
  );
}
