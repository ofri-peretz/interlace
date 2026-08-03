import type { Metadata } from "next";
import Link from "next/link";

// This app has no `.interlace` baseline — it consumes the design system directly,
// where BrandMark is the same two-bar mark on the same --brand-mark-bar-* tokens.
import { BrandMark } from "@interlace/ui/patterns/brand-logo";
import { buttonVariants } from "@interlace/ui/button-variants";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page does not exist on ds.interlace.tools.",
  // noindex: a 404 has no content worth ranking, and indexing it competes with
  // the real pages. follow stays TRUE so crawlers still traverse the recovery
  // links below — noindex,nofollow would strand them on a dead end.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main
      id="main"
      data-slot="not-found-page"
      className="mx-auto flex min-h-[70vh] w-full max-w-prose flex-col items-center justify-center px-6 py-24 text-center"
    >
      <BrandMark size={56} />

      <p className="mt-8 font-mono text-sm tracking-widest text-muted-foreground">
        404
      </p>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        That page wandered off
      </h1>

      <p className="mt-4 text-muted-foreground">
        The URL does not match anything published here. It may have been moved,
        renamed, or never existed in the first place.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonVariants({ variant: "default" })}>
          Go home
        </Link>
        <Link
          href="/getting-started"
          className={buttonVariants({ variant: "outline" })}
        >
          Getting started
        </Link>
      </div>
    </main>
  );
}
