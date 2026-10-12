import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

export interface ProductCardProps {
  name: string;
  tagline: string;
  href: string;
  badge: string;
  icon: ReactNode;
  status: "shipping" | "beta" | "planned";
  /** The one command that gets a reader started — a real, published package. */
  install: string;
  github: string;
}

// Not a whole-card link: the card carries two actions (site + GitHub) and a
// selectable install command, which cannot live inside one <a>.
export function ProductCard({
  name,
  tagline,
  href,
  badge,
  icon,
  status,
  install,
  github,
}: ProductCardProps) {
  // Every card on the gateway is shipping, so a "Shipping" pill on all of
  // them is noise; only a card that is NOT shipping says so.
  const label =
    status === "beta" ? "Beta" : status === "planned" ? "Coming soon" : null;

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-fd-border bg-fd-card p-6 transition-colors hover:border-fd-primary/40">
      <div className="mb-4 flex items-center gap-3">
        <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-fd-primary/10 text-fd-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-fd-foreground">{name}</h3>
          <p className="font-mono text-xs text-fd-muted-foreground">{badge}</p>
        </div>
        {label && (
          <span className="ml-auto rounded-full border border-fd-border px-2.5 py-0.5 text-xs text-fd-muted-foreground">
            {label}
          </span>
        )}
      </div>

      <p className="mb-5 text-sm leading-relaxed text-fd-muted-foreground">
        {tagline}
      </p>

      <pre className="mb-5 overflow-x-auto rounded-lg border border-fd-border bg-fd-background px-3 py-2 font-mono text-xs text-fd-foreground">
        <span aria-hidden="true" className="select-none text-fd-muted-foreground">
          ${" "}
        </span>
        {install}
      </pre>

      <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
        <a
          href={href}
          className="inline-flex items-center gap-1.5 text-fd-primary hover:underline"
        >
          Go to {name}
          <ArrowRight className="size-4" />
        </a>
        <a
          href={github}
          className="text-fd-muted-foreground hover:text-fd-foreground"
        >
          GitHub
        </a>
      </div>
    </article>
  );
}
