import conceptsDoc from '../../public/data/concepts.json';

/**
 * The seven concept pages, DERIVED from the Storybook MDX by
 * `scripts/build-concepts.mjs` — see that script's header for why derived and
 * not forked, and for what deliberately stays behind in Storybook.
 */

export type ConceptBlock =
  | { type: 'heading'; depth: number; text: string; id: string }
  | { type: 'paragraph'; text: string }
  /** A pulled-out statement of the rule the section is about. */
  | { type: 'quote'; text: string }
  | { type: 'code'; lang: string | null; code: string }
  | {
      type: 'list';
      ordered: boolean;
      items: { depth: number; text: string }[];
    }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'rule' }
  /** A live JSX demo that stays in Storybook — one render, not two. */
  | { type: 'demo'; storybookId: string };

export type ConceptPage = {
  slug: string;
  title: string;
  /** The Storybook docs title, e.g. `Concepts/Color & Theming`. */
  storyTitle: string;
  storybookId: string;
  /** Repo-relative path of the MDX this page is derived from. */
  file: string;
  lead: string;
  blocks: ConceptBlock[];
  headings: { id: string; text: string }[];
};

export type ConceptsDoc = {
  generatedAt: string;
  source: string;
  pages: ConceptPage[];
};

const DOC = conceptsDoc as ConceptsDoc;

export const CONCEPTS_SOURCE = DOC.source;
export const listConcepts = (): ConceptPage[] => DOC.pages;
export const conceptBySlug = (slug: string): ConceptPage | null =>
  DOC.pages.find((p) => p.slug === slug) ?? null;
