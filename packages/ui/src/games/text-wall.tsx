'use client';

/**
 * @interlace/ui — TextWall
 *
 * The room's short answers on a shared screen: "what would you ask someone
 * your age who lives there?". New posts rise in at the top; the presenter
 * can put one in the spotlight, large, above the rest. Phones send with
 * `QuestionAsk` (relabelled: "Your answer", "Post"); posts go through the
 * same checks and moderation queue as the Q&A board (`question-board-model`
 * with `QuestionQueue`), so nothing unreviewed reaches the screen.
 *
 * ## Anatomy
 *
 *   TextWall                     (section — data-slot="text-wall")
 *     ├─ figure                  (data-slot="text-wall-spotlight": the featured post, large)
 *     ├─ p                       (data-slot="text-wall-count": "24 answers")
 *     └─ ul                      (FlipGroup — data-slot="text-wall-list": newest first, row by row)
 *          └─ li × n             (data-slot="text-wall-post")
 *
 * The wall is not a live region: a screen reader user reads it at their
 * pace, and the count says how many there are.
 *
 * ## Motion
 *
 * A new post rises in at the top (200ms) and the others glide one place
 * along (FlipGroup, 250ms); a post moving into the spotlight scales in
 * (250ms). Under reduced motion they
 * simply appear.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                               |
 * | ---- | ------------------------- | ------------------------------------------------ |
 * | R4   | Extends native el         | `section` props                                  |
 * | R6   | data-slot per part        | text-wall / -spotlight / -count / -list / -post  |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                |
 * | R8   | Enums, not booleans       | `size`                                           |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const             |
 * | R26  | A11y                      | a list in reading order; count as text; not live  |
 */

import * as React from 'react';

import { FlipGroup } from '../effects/flip-group.js';
import { cn } from '../lib/cn.js';
import { motionEase } from '../lib/motion-token.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

export const MIN_VIEWPORT = 320 as const;

interface WallPost {
  id: string;
  text: string;
  /** When it was posted, ms; newest show first. */
  at: number;
}

interface TextWallLabels {
  /** @default (n, f) => `${f} ${n === 1 ? 'answer' : 'answers'}` */
  count?: (n: number, formatted: string) => string;
  /** @default 'Nothing here yet.' */
  empty?: string;
}

type TextWallProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  posts: readonly WallPost[];
  /** A post to feature, large, above the wall. */
  spotlight?: string | null;
  /** The most posts on the wall; older ones leave. @default 40 */
  max?: number;
  /** `stage` for a shared screen. @default 'default' */
  size?: 'default' | 'stage';
  locale?: string;
  labels?: TextWallLabels;
};

function Post({ id, text, enter }: { id: string; text: string; enter: boolean }) {
  const ref = React.useRef<HTMLLIElement>(null);
  // Runs once, on mount: only a post that arrives after the wall loaded rises in.
  const enterOnMount = React.useRef(enter);
  React.useEffect(() => {
    const el = ref.current;
    if (!enterOnMount.current || !el || typeof el.animate !== 'function') return;
    el.animate(
      [
        { transform: 'translateY(12px)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ],
      {
        duration: 200,
        easing: motionEase(el, 'enter'),
      },
    );
  }, []);
  return (
    <li data-slot="text-wall-post" data-flip-id={id} ref={ref} className="bg-card rounded-lg border p-4 text-pretty">
      {text}
    </li>
  );
}

function TextWall({
  posts,
  spotlight = null,
  max = 40,
  size = 'default',
  locale,
  labels,
  className,
  ...props
}: TextWallProps) {
  const reduced = useReducedMotion();
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const stage = size === 'stage';
  const featured = spotlight ? posts.find((p) => p.id === spotlight) : undefined;
  const shown = [...posts]
    .filter((p) => p.id !== featured?.id)
    .sort((a, b) => b.at - a.at)
    .slice(0, Math.max(0, max));
  const loaded = React.useRef<Set<string> | null>(null);
  if (loaded.current === null) loaded.current = new Set(posts.map((p) => p.id));
  const spotRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const el = spotRef.current;
    if (!el || !featured || reduced || typeof el.animate !== 'function') return;
    el.animate(
      [
        { transform: 'scale(0.96)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      {
        duration: 250,
        easing: motionEase(el, 'enter'),
      },
    );
  }, [featured?.id, reduced]);

  const count = (labels?.count ?? ((n: number, f: string) => `${f} ${n === 1 ? 'answer' : 'answers'}`))(
    posts.length,
    nf.format(posts.length),
  );

  return (
    <section
      data-slot="text-wall"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container grid gap-4', className)}
      {...props}
    >
      {featured ? (
        <figure
          ref={spotRef}
          data-slot="text-wall-spotlight"
          className={cn(
            'border-primary bg-primary/5 font-heading rounded-xl border-2 p-6 font-semibold text-balance',
            stage ? 'text-section' : 'text-2xl',
          )}
        >
          <blockquote>{featured.text}</blockquote>
        </figure>
      ) : null}
      <p data-slot="text-wall-count" className={cn('text-muted-foreground', stage ? 'text-lg' : 'text-sm')}>
        {posts.length === 0 ? (labels?.empty ?? 'Nothing here yet.') : count}
      </p>
      <FlipGroup
        render={<ul />}
        duration={250}
        data-slot="text-wall-list"
        className={cn('grid items-start gap-3 @md:grid-cols-2 @4xl:grid-cols-3', stage ? 'text-lg' : 'text-base')}
      >
        {shown.map((p) => (
          <Post key={p.id} id={p.id} text={p.text} enter={!reduced && !(loaded.current?.has(p.id) ?? false)} />
        ))}
      </FlipGroup>
    </section>
  );
}
TextWall.displayName = 'TextWall';

export { TextWall };
export type { TextWallProps, TextWallLabels, WallPost };
