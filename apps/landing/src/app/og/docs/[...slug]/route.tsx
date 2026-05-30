import { source } from "#interlace/lib/source";
import { createDocsOGRoute } from "#interlace/lib/og-image";

export const revalidate = false;
export const { GET, generateStaticParams } = createDocsOGRoute({
  source,
  site: "Interlace",
});
