import { source } from "#interlace/lib/source";

export const revalidate = false;

// llms.txt format (https://llmstxt.org): H1, a one-line summary, then link
// lists. An assistant asked "what is interlace.tools?" should get the product
// list first, not only the concept pages.
const PRODUCTS = [
  [
    "ESLint plugins",
    "https://eslint.interlace.tools/llms.txt",
    "ESLint plugins that find security bugs and mistakes in JavaScript and TypeScript, including AI-written code",
  ],
  [
    "burgee",
    "https://burgee.interlace.tools/llms.txt",
    "A CLI framework for Node.js: one declaration gives help, --json, --schema, MCP, completions and types",
  ],
  [
    "Serverless plugins",
    "https://serverless.interlace.tools/llms.txt",
    "Serverless Framework plugins for AWS that clean up what they create",
  ],
  [
    "Interlace UI",
    "https://ds.interlace.tools/llms.txt",
    "The React design system these sites are built with, installed through the shadcn CLI",
  ],
] as const;

export async function GET() {
  const lines = [
    "# Interlace",
    "",
    "> Open-source, MIT-licensed tools for JavaScript and TypeScript developers, built by Ofri Peretz.",
    "",
    "## Products",
    "",
    ...PRODUCTS.map(([name, url, what]) => `- [${name}](${url}): ${what}`),
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
