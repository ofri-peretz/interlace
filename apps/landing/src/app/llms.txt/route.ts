import { source } from "#interlace/lib/source";
import { renderBrand } from "@/lib/brand";

export const revalidate = false;

// llms.txt format (https://llmstxt.org): H1, a one-line summary, then link
// lists. An assistant asked "what is interlace.tools?" should get the product
// list first, not only the concept pages. Copy comes from brand-messages.json.
export async function GET() {
  const brand = renderBrand(null);
  const lines = [
    "# Interlace",
    "",
    `> ${brand.tagline} MIT-licensed, built by Ofri Peretz.`,
    "",
    "## Products",
    "",
    ...brand.products.map(
      (p) => `- [${p.name}](https://${p.site}/llms.txt): ${p.line}`,
    ),
    "",
    "## Docs",
    "",
    ...source
      .getPages()
      .map(
        (page) =>
          `- [${page.data.title}](${page.url}): ${page.data.description}`,
      ),
  ];
  return new Response(lines.join("\n"));
}
