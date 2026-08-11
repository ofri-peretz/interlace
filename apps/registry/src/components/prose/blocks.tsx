import type { ConceptBlock } from '@/lib/concepts';

import { Inline } from './inline';

/**
 * Render the block list `scripts/build-concepts.mjs` derives from the concept
 * MDX, in this site's own type and token vocabulary.
 *
 * Composable by block type rather than one switch with twenty props: a page
 * passes its blocks and nothing else, and a new block kind is a new component
 * plus one case — not another boolean on a growing signature.
 */

const STORYBOOK_URL =
  process.env.NEXT_PUBLIC_STORYBOOK_URL ?? 'https://storybook.interlace.tools';

function Heading({
  depth,
  text,
  id,
}: {
  depth: number;
  text: string;
  id: string;
}) {
  // Depth 1 is the page title, rendered by the route; everything the block list
  // carries is a section heading or below.
  if (depth <= 2) {
    return (
      <h2
        id={id}
        className="mt-12 scroll-mt-20 text-2xl font-semibold tracking-tight text-balance"
      >
        <Inline text={text} />
      </h2>
    );
  }
  if (depth === 3) {
    return (
      <h3 id={id} className="mt-8 scroll-mt-20 text-lg font-semibold">
        <Inline text={text} />
      </h3>
    );
  }
  return (
    <h4
      id={id}
      className="text-muted-foreground mt-6 scroll-mt-20 text-sm font-semibold tracking-wider uppercase"
    >
      <Inline text={text} />
    </h4>
  );
}

function CodeBlock({ lang, code }: { lang: string | null; code: string }) {
  return (
    <div className="border-border bg-card mt-4 overflow-hidden rounded-lg border">
      {lang ? (
        <div className="text-muted-foreground border-border border-b px-4 py-1.5 font-mono text-xs">
          {lang}
        </div>
      ) : null}
      <pre className="overflow-x-auto px-4 py-3">
        <code className="font-mono text-sm leading-relaxed">{code}</code>
      </pre>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="border-border bg-card mt-4 overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-background/60 text-muted-foreground text-xs tracking-wider uppercase">
          <tr>
            {head.map((cell, i) => (
              <th
                key={i}
                scope="col"
                className="border-border border-b px-4 py-2 text-left font-semibold"
              >
                <Inline text={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-border border-b align-top last:border-b-0">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2">
                  <Inline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The one thing `/concepts` does not derive: a demo that mounts real
 * components. Copying the JSX here would fork the render — two demos that can
 * disagree about what the DS does — so the page links to the one that runs.
 */
function Demo({ storybookId }: { storybookId: string }) {
  return (
    <a
      href={`${STORYBOOK_URL}/?path=/docs/${storybookId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="border-border hover:border-primary/60 bg-card/40 hover:bg-card group mt-4 flex items-center justify-between gap-4 rounded-lg border border-dashed p-4 transition-colors"
    >
      <span>
        <span className="text-primary text-xs font-semibold tracking-wider uppercase">
          Live demo
        </span>
        <span className="mt-1 block text-sm">
          This spot mounts real{' '}
          <code className="font-mono text-xs">@interlace/ui</code> components.
          It runs in Storybook — one render, not a copy of it.
        </span>
      </span>
      <span
        aria-hidden
        className="text-muted-foreground group-hover:text-primary text-xl transition-colors"
      >
        →
      </span>
    </a>
  );
}

export function ConceptBlocks({ blocks }: { blocks: ConceptBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <Heading
                key={i}
                depth={block.depth}
                text={block.text}
                id={block.id}
              />
            );
          case 'paragraph':
            return (
              <p key={i} className="text-muted-foreground mt-4 leading-relaxed">
                <Inline text={block.text} />
              </p>
            );
          case 'quote':
            return (
              <blockquote
                key={i}
                className="border-primary/50 text-foreground mt-4 border-l-2 pl-4 leading-relaxed"
              >
                <Inline text={block.text} />
              </blockquote>
            );
          case 'code':
            return <CodeBlock key={i} lang={block.lang} code={block.code} />;
          case 'table':
            return <Table key={i} head={block.head} rows={block.rows} />;
          case 'list':
            return block.ordered ? (
              <ol
                key={i}
                className="text-muted-foreground mt-4 ml-6 list-decimal space-y-2 leading-relaxed"
              >
                {block.items.map((item, j) => (
                  <li key={j} className={item.depth > 0 ? 'ml-6' : undefined}>
                    <Inline text={item.text} />
                  </li>
                ))}
              </ol>
            ) : (
              <ul
                key={i}
                className="text-muted-foreground mt-4 ml-6 list-disc space-y-2 leading-relaxed"
              >
                {block.items.map((item, j) => (
                  <li key={j} className={item.depth > 0 ? 'ml-6' : undefined}>
                    <Inline text={item.text} />
                  </li>
                ))}
              </ul>
            );
          case 'rule':
            return <hr key={i} className="border-border mt-10" />;
          case 'demo':
            return <Demo key={i} storybookId={block.storybookId} />;
        }
      })}
    </>
  );
}
