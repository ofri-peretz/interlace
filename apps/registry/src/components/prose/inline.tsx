import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The inline marks the concept MDX actually uses: code spans (single and
 * double-backtick), links, strong and emphasis.
 *
 * Not a markdown library, and not `dangerouslySetInnerHTML`. The input is
 * repo-authored prose that has already been through a generator, and every
 * branch below produces React elements — so there is no path from a stray
 * angle bracket in a doc to markup in the page.
 *
 * ─── Why earliest-match and not fixed precedence ────────────────────
 *
 * The first version ran the marks in a fixed order, code first. That is
 * subtly wrong in both directions and the corpus contains both failures:
 *
 *   **`cols` is still passed to `Grid`**    → strong wrapping code
 *   `` `sm:grid-cols-${n}` ``               → code containing backticks
 *
 * Splitting on code first cut the `**` pair into two fragments that could
 * never match each other, and the page rendered a literal `** … **`.
 * Splitting on strong first would have mangled any code span containing an
 * asterisk. So this scans for whichever mark opens EARLIEST and recurses into
 * its content — except for code, whose content is literal by definition.
 */

type Mark = {
  name: 'code2' | 'code' | 'link' | 'strong' | 'em';
  re: RegExp;
};

/**
 * Order matters only for ties at the same index: a double-backtick span has to
 * be tried before the single-backtick one, or ``` ``a`b`` ``` matches as an
 * empty code span.
 */
const MARKS: Mark[] = [
  { name: 'code2', re: /``([\s\S]+?)``/ },
  { name: 'code', re: /`([^`\n]+)`/ },
  { name: 'link', re: /\[([^\]]+)\]\(([^)\s]+)\)/ },
  { name: 'strong', re: /\*\*([\s\S]+?)\*\*/ },
  { name: 'em', re: /(?<![*\w])[*_]([^*_\n]+)[*_](?![*\w])/ },
];

const isInternal = (href: string) =>
  href.startsWith('/') || href.startsWith('#');

const CODE_CLASS =
  'bg-muted text-foreground rounded-sm px-1 py-0.5 font-mono text-[0.9em]';
const LINK_CLASS = 'text-primary underline-offset-4 hover:underline';

const parse = (text: string, key: string): ReactNode[] => {
  if (text === '') return [];

  let earliest: { mark: Mark; match: RegExpExecArray } | null = null;
  for (const mark of MARKS) {
    const match = mark.re.exec(text);
    if (!match) continue;
    if (!earliest || match.index < earliest.match.index) {
      earliest = { mark, match };
    }
  }
  if (!earliest) return [text];

  const { mark, match } = earliest;
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  const id = `${key}-${mark.name}-${match.index}`;

  let node: ReactNode;
  switch (mark.name) {
    case 'code':
    case 'code2':
      // Literal by definition — never recursed into.
      node = (
        <code key={id} className={CODE_CLASS}>
          {match[1].trim()}
        </code>
      );
      break;
    case 'link': {
      const href = match[2];
      node = isInternal(href) ? (
        <Link key={id} href={href} className={LINK_CLASS}>
          {parse(match[1], id)}
        </Link>
      ) : (
        <a
          key={id}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          {parse(match[1], id)} ↗
        </a>
      );
      break;
    }
    case 'strong':
      node = (
        <strong key={id} className="text-foreground font-semibold">
          {parse(match[1], id)}
        </strong>
      );
      break;
    case 'em':
      node = <em key={id}>{parse(match[1], id)}</em>;
      break;
  }

  return [...parse(before, `${key}b`), node, ...parse(after, `${key}a`)];
};

export function Inline({ text }: { text: string }) {
  return <>{parse(text, 'i')}</>;
}
