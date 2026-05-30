import type { Meta, StoryObj } from '@storybook/react-vite';
import { Prose, MIN_VIEWPORT } from '@interlace/ui/prose';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Primitives/Prose',
  component: Prose,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Typographic article-body wrapper. Renders `<article>` (override via `as`) and styles descendant `h1`–`h6`, `p`, `a`, `ul`/`ol`/`li`, `blockquote`, `code`/`pre`, `table`, `img` through a single DS-token cascade. Measure bound to `--container-prose` (65ch); `variant="long"` switches to the long-form reading contract (17px / 1.7). Server component; MIN_VIEWPORT = 320px.',
      },
    },
  },
  argTypes: {
    variant: { control: 'select', options: ['default', 'long'] },
    as: { control: 'select', options: ['article', 'div', 'main', 'section'] },
  },
} satisfies Meta<typeof Prose>;

export default meta;
type Story = StoryObj<typeof meta>;

const SampleArticle = () => (
  <>
    <h1>The article wrapper, in practice</h1>
    <p>
      The <code>Prose</code> primitive is the surface every MDX page lands
      on. It bounds the measure to <code>--container-prose</code> (65ch) and
      maps every descendant element to a DS token so the article reads the
      same in docs, the blog, and the registry — no per-page typography
      drift.
    </p>

    <h2>Headings carry scroll-margin</h2>
    <p>
      Deep links to <code>#headings-carry-scroll-margin</code> clear a
      sticky header thanks to <code>scroll-margin-top</code> set on every
      heading (xl ≈ 64px). Try clicking{' '}
      <a href="#headings-carry-scroll-margin">this anchor</a> and notice the
      heading does not slide under a fixed top bar.
    </p>

    <h3>Lists and inline marks</h3>
    <p>The cascade covers the long tail of Markdown:</p>
    <ul>
      <li>
        Unordered lists like this one — <strong>bold</strong>,{' '}
        <em>italic</em>, and{' '}
        <a href="#lists-and-inline-marks">inline links</a> all inherit the
        token contract.
      </li>
      <li>
        Inline code reads as a chip: install <code>@interlace/ui</code> and
        import <code>{`import { Prose } from '@interlace/ui/prose'`}</code>.
      </li>
      <li>Nested items keep the same rhythm and tone.</li>
    </ul>

    <ol>
      <li>Ordered lists pair with the same spacing scale.</li>
      <li>Decimal markers come from the platform.</li>
      <li>No bespoke counter styling needed.</li>
    </ol>

    <h3>Block quotes</h3>
    <blockquote>
      The product is the proof. The article wrapper is just the stage that
      lets the proof read like a published article.
    </blockquote>

    <h3>Code blocks</h3>
    <p>
      Fenced code lives inside <code>pre &gt; code</code>; the chip styles
      on inline <code>code</code> are cleared inside <code>pre</code> so the
      block renders flat:
    </p>
    <pre>
      <code>{`import { Prose } from '@interlace/ui/prose';

export default function Article() {
  return (
    <Prose as="main" variant="long">
      <h1>Hello, world</h1>
      <p>A typographic article-body wrapper.</p>
    </Prose>
  );
}`}</code>
    </pre>

    <h3>GFM tables — zebra rows + horizontal overflow</h3>
    <table>
      <thead>
        <tr>
          <th>Token</th>
          <th>Value</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <code>--text-body</code>
          </td>
          <td>16px / 1.6</td>
          <td>Default reading contract.</td>
        </tr>
        <tr>
          <td>
            <code>--text-long</code>
          </td>
          <td>17px / 1.7</td>
          <td>
            Long-form reading contract — used by{' '}
            <code>variant="long"</code>.
          </td>
        </tr>
        <tr>
          <td>
            <code>--container-prose</code>
          </td>
          <td>65ch</td>
          <td>Measure ceiling per TYPOGRAPHY_PHILOSOPHY.</td>
        </tr>
        <tr>
          <td>
            <code>--spacing-xl</code>
          </td>
          <td>64px</td>
          <td>
            <code>scroll-margin-top</code> for heading anchors.
          </td>
        </tr>
      </tbody>
    </table>

    <h3>Images</h3>
    <p>
      Images get a sensible default: block layout, bounded radius, and a
      width that respects the measure so figures never blow out the column.
    </p>

    <h4>Smaller subsections still get rhythm</h4>
    <p>
      Right down to <code>h6</code>, every heading has its own spacing slot
      so the document outline reads cleanly even at depth.
    </p>
  </>
);

export const Default: Story = {
  render: (args) => (
    <Prose {...args}>
      <SampleArticle />
    </Prose>
  ),
};

/**
 * Side-by-side render of both `variant` values so the difference between
 * the body contract (16px / 1.6) and the long-form contract (17px / 1.7)
 * is visually obvious.
 */
export const Variants: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-xl lg:grid-cols-2">
      <section>
        <h3 className="mb-sm text-ui-sm font-mono uppercase text-muted-foreground">
          variant="default"
        </h3>
        <Prose variant="default">
          <h2>Body reading contract</h2>
          <p>
            16px body at 1.6 line-height. The everyday reading default for
            short-to-medium articles, doc pages, and changelogs.
          </p>
          <p>
            A second paragraph to show paragraph rhythm and the underline
            offset on <a href="#">an inline link</a>.
          </p>
        </Prose>
      </section>
      <section>
        <h3 className="mb-sm text-ui-sm font-mono uppercase text-muted-foreground">
          variant="long"
        </h3>
        <Prose variant="long">
          <h2>Long-form reading contract</h2>
          <p>
            17px body at 1.7 line-height. Switch to this on long-form
            articles and blog posts — the extra leading reduces fatigue
            over multi-screen reads.
          </p>
          <p>
            A second paragraph to compare the rhythm against the default
            contract on the left.
          </p>
        </Prose>
      </section>
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

/**
 * Below-min-viewport demo — wrap in a (MIN_VIEWPORT - 1)px container with
 * the `data-interlace-dev` flag so preflight's dashed warning outline
 * appears. The article still renders; tables fall back to horizontal
 * scroll so wide GFM tables don't break the page.
 */
export const BelowMinViewport: Story = {
  render: () => (
    <div
      data-interlace-dev
      style={{ width: MIN_VIEWPORT - 1 }}
      className="border-2 border-dashed border-muted"
    >
      <Prose>
        <h1>Narrow viewport</h1>
        <p>
          Below <code>{MIN_VIEWPORT}</code>px the preflight outline appears
          but the article keeps reading. Tables scroll horizontally so
          wide rows don't blow out the column:
        </p>
        <table>
          <thead>
            <tr>
              <th>Column A</th>
              <th>Column B</th>
              <th>Column C</th>
              <th>Column D</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>row 1 a</td>
              <td>row 1 b</td>
              <td>row 1 c</td>
              <td>row 1 d</td>
            </tr>
            <tr>
              <td>row 2 a</td>
              <td>row 2 b</td>
              <td>row 2 c</td>
              <td>row 2 d</td>
            </tr>
          </tbody>
        </table>
      </Prose>
    </div>
  ),
  decorators: [
    (Story) => (
      // Promote the body flag for this story so the preflight selector matches.
      <div
        ref={(node) => {
          if (node && typeof document !== 'undefined') {
            document.body.setAttribute('data-interlace-dev', '');
          }
        }}
      >
        <Story />
      </div>
    ),
  ],
};
