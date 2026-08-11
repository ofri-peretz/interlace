import { source } from "#interlace/lib/source";
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";
// Aliased on import, deliberately. `useMDXComponents` is NOT a hook — it is a
// plain function returning a component map, and the `use` prefix is a Next.js
// naming convention for the `mdx-components` module export, which is why the
// export itself must keep that name. But this file is an async server
// component, and `react-hooks/rules-of-hooks` correctly reads a `use*` call
// there as a violation. Renaming at the call site tells the truth to both: the
// framework keeps its convention, the linter stops seeing a hook that is not
// one, and nobody has to write a suppression comment that would also hide a
// real violation later.
import { useMDXComponents as getMDXComponents } from "@/mdx-components";

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;
  const page = source.getPage(resolvedParams.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const components = getMDXComponents();

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={components} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;
  const page = source.getPage(resolvedParams.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
