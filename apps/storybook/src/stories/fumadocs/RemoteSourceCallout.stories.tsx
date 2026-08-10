import type { Meta, StoryObj } from '@storybook/react-vite';
import { RemoteSourceCallout } from '@interlace/ui/fumadocs/remote-source-callout';

const meta: Meta<typeof RemoteSourceCallout> = {
  title: 'Fumadocs/RemoteSourceCallout',
  component: RemoteSourceCallout,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The banner at the top of a page whose body was fetched from a repo rather than authored in the site. It answers the two questions a reader has about content that is not where they are reading it: where did this come from, and how stale might it be — then hands them the edit link so the answer to "this is wrong" is a PR instead of an issue.\n\n' +
          'Use it on every remote-rendered page (README, rule doc, changelog). Do not use it as a generic info callout: it makes a specific claim about provenance and caching, and using it for anything else teaches readers to stop believing it.\n\n' +
          '`variant` only picks the copy — the layout, tone and affordances are identical across all four, because the reader is being told the same thing about a different kind of file.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['readme', 'rule', 'changelog', 'markdown'],
      description:
        'Picks the leading sentence: "Live README from GitHub" / "Live rule documentation" / "Live changelog" / "Live content from GitHub". `markdown` is the generic fallback.',
      table: {
        type: { summary: "'readme' | 'rule' | 'changelog' | 'markdown'" },
        defaultValue: { summary: 'markdown' },
        category: 'Appearance',
      },
    },
    label: {
      control: 'text',
      description:
        'The visible link text — the file name or rule slug. Name the actual file, not the repo: "the source" is not something a reader can verify, `no-sha1-hash.md` is.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    sourceUrl: {
      control: 'text',
      description:
        'The GitHub `blob/…` URL of the file. Doubles as the input the edit URL is derived from when `editUrl` is omitted.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    editUrl: {
      control: 'text',
      description:
        'Override for the "Edit on GitHub" target. Left empty on purpose in these stories: the component rewrites `/blob/` to `/edit/` itself, and seeing that derivation work is more useful than seeing it bypassed. Pass it explicitly when the editable file is not the fetched one — a generated rule page whose real source is a plugin fixture, for example.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    cacheWindowLabel: {
      control: 'text',
      description:
        'Formatted into "cached for X". Say the real ISR window — a reader who has just pushed a fix needs to know whether to wait a minute or an hour before deciding the site is broken. Omit it and the clause disappears entirely rather than defaulting to a number nobody checked.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the wrapper. It ships with `mb-6` because it is always the first thing in the article flow.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RemoteSourceCallout>;

export const RuleVariant: Story = {
  args: {
    variant: 'rule',
    label: 'no-sha1-hash.md',
    sourceUrl:
      'https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-node-security/docs/rules/no-sha1-hash.md',
    cacheWindowLabel: '6 hours',
  },
};

export const ReadmeVariant: Story = {
  args: {
    variant: 'readme',
    label: 'eslint-plugin-node-security/README.md',
    sourceUrl:
      'https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-node-security/README.md',
    cacheWindowLabel: '1 hour',
  },
};

export const ChangelogVariant: Story = {
  args: {
    variant: 'changelog',
    label: 'eslint-plugin-node-security/CHANGELOG.md',
    sourceUrl:
      'https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-node-security/CHANGELOG.md',
    cacheWindowLabel: '2 hours',
  },
};

export const GenericNoCacheWindow: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The `markdown` fallback, with `cacheWindowLabel` omitted. The "cached for X" clause disappears rather than falling back to a number nobody verified — a staleness claim is only worth making when it is true.',
      },
    },
  },
  args: {
    variant: 'markdown',
    label: 'VISUALIZATION_PHILOSOPHY.md',
    sourceUrl:
      'https://github.com/ofri-peretz/eslint/blob/main/docs/VISUALIZATION_PHILOSOPHY.md',
  },
};
