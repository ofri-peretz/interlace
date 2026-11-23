import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@interlace/ui/badge';
import { Citation } from '@interlace/ui/patterns/citation';
import { ClaimCard } from '@interlace/ui/patterns/claim-card';

// Placeholder content: a made-up bridge in a made-up city, sources on
// example.com. The story shows the shape, not a claim about the world.
const SOURCES = [
  {
    publisher: 'The Example Gazette',
    url: 'https://example.com/gazette/report',
    kind: 'news report',
    quote: 'The bridge reopened to traffic on Monday morning after six weeks of repairs.',
  },
  {
    publisher: 'City Transport Office',
    url: 'https://example.com/transport/notice-14',
    kind: 'official record',
    quote: 'All lanes of the bridge are open from 06:00 on 3 March.',
  },
];

const meta = {
  title: 'Blocks/ClaimCard',
  component: ClaimCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One claim, examined. A status row of badges, the claim quoted in serif, a short ' +
          'answer (which can carry `Citation` markers), collapsible sections for the evidence, ' +
          'and a footer. Every part is a slot. Sections are native `<details>`, so the card ' +
          'renders on the server and opens with no JavaScript.',
      },
    },
  },
  argTypes: {
    className: {
      control: 'text',
      description: 'Merged onto the `<article>`. Width belongs on a wrapper.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  render: (args) => (
    <div className="max-w-prose">
      <ClaimCard {...args}>
        <ClaimCard.Status>
          <Badge variant="success">Checked by a second reader</Badge>
          <Badge variant="outline">Updated 3 March</Badge>
        </ClaimCard.Status>
        <ClaimCard.Claim>The bridge has been closed for months</ClaimCard.Claim>
        <ClaimCard.Answer>
          It was closed for six weeks of repairs and{' '}
          <Citation sources={SOURCES} status="enough">
            reopened on 3 March.
          </Citation>
        </ClaimCard.Answer>
        <ClaimCard.Section title="Facts and sources" meta="2 of 2 fully sourced">
          <ol className="list-decimal space-y-2 ps-4">
            <li>Repairs began on 20 January.</li>
            <li>All lanes reopened on 3 March.</li>
          </ol>
        </ClaimCard.Section>
        <ClaimCard.Section title="Who says this" meta="1">
          <p>A post shared in a local group, quoted in full in the source.</p>
        </ClaimCard.Section>
        <ClaimCard.Section title="Where the record is contested" meta="0">
          <p>Nothing recorded.</p>
        </ClaimCard.Section>
        <ClaimCard.Section title="What this card does not claim">
          <p>It says nothing about the cost of the repairs.</p>
        </ClaimCard.Section>
        <ClaimCard.Section title="What we could not verify" meta="0">
          <p>Nothing recorded.</p>
        </ClaimCard.Section>
        <ClaimCard.Footer>
          Card <code className="font-mono">bridge-reopened</code>
        </ClaimCard.Footer>
      </ClaimCard>
    </div>
  ),
} satisfies Meta<typeof ClaimCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const StillBeingChecked: Story = {
  render: () => (
    <div className="max-w-prose">
      <ClaimCard>
        <ClaimCard.Status>
          <Badge variant="outline">Still being checked</Badge>
          <Badge variant="warning">Short of sources</Badge>
        </ClaimCard.Status>
        <ClaimCard.Claim>The bridge was built in a year</ClaimCard.Claim>
        <ClaimCard.Answer>
          The record is thin.{' '}
          <Citation sources={SOURCES.slice(0, 1)} status="short" marker="underline">
            One report gives a date
          </Citation>
          , and no second source confirms it yet.
        </ClaimCard.Answer>
        <ClaimCard.Section title="What we could not verify" meta="1" open>
          <p>The construction start date.</p>
        </ClaimCard.Section>
      </ClaimCard>
    </div>
  ),
};
