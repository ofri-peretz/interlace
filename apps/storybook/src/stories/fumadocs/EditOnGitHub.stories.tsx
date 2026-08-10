import type { Meta, StoryObj } from '@storybook/react-vite';
import { EditOnGitHub } from '@interlace/ui/fumadocs/edit-on-github';

const meta: Meta<typeof EditOnGitHub> = {
  title: 'Fumadocs/EditOnGitHub',
  component: EditOnGitHub,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The per-page "fix this" affordance for documentation whose source of truth is a file in a repo. It is a plain external link with a pencil — no editor, no auth, no round trip: the reader lands in GitHub\'s web editor already forked and already on the right file.\n\n' +
          'Reach for it at the foot (or in the meta row) of any page rendered from remote markdown. Skip it where the page is generated rather than authored — pointing a reader at a file that a build step overwrites converts a willing contributor into a closed PR.\n\n' +
          'It takes a fully-formed `url` rather than owner/repo/path parts, because the `blob/…` → `edit/…` rewrite is the caller\'s knowledge; `RemoteSourceCallout` does exactly that derivation before handing it over.',
      },
    },
  },
  argTypes: {
    url: {
      control: 'text',
      description:
        'Full URL to the source file on GitHub. Use the `edit/` form (`…/edit/main/README.md`), not `blob/` — `blob/` opens the viewer and makes the reader hunt for the pencil themselves.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    label: {
      control: 'text',
      description:
        'Link text. Override it where "edit" overstates what a reader can do — "Suggest a change" is the honest wording when they will be opening a PR against a repo they cannot push to.',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'Edit on GitHub' },
        category: 'Data',
      },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the `<a>`. The component ships intentionally quiet (muted foreground, `text-xs`) and brightens on hover — it is a footnote, not a call to action.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof EditOnGitHub>;

export const Default: Story = {
  args: {
    url: 'https://github.com/ofri-peretz/eslint/edit/main/README.md',
    label: 'Edit on GitHub',
  },
};

export const CustomLabel: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The wording is the contract with the reader. "Suggest a change" promises less than "Edit" and is the accurate promise for anyone without write access.',
      },
    },
  },
  args: {
    url: 'https://github.com/ofri-peretz/eslint/edit/main/README.md',
    label: 'Suggest a change',
  },
};

export const InPageFooter: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Where it actually lives. A 14px link alone on a 1200px canvas says nothing about the component; its whole design brief is to sit at the end of a doc page, next to the "last updated" line, quiet enough to ignore and close enough to find.',
      },
    },
  },
  render: (args) => (
    <article className="mx-auto flex max-w-prose flex-col gap-4">
      <h2 className="text-foreground text-xl font-semibold">no-sha1-hash</h2>
      <p className="text-muted-foreground text-sm leading-relaxed">
        SHA-1 is broken for collision resistance. This rule reports it wherever the digest is used
        to authenticate rather than to key a cache, and leaves the cache-key case alone.
      </p>
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <span className="text-muted-foreground text-xs">Last updated 6 hours ago</span>
        <EditOnGitHub {...args} />
      </div>
    </article>
  ),
  args: {
    url: 'https://github.com/ofri-peretz/eslint/edit/main/packages/eslint-plugin-node-security/docs/rules/no-sha1-hash.md',
    label: 'Edit on GitHub',
  },
};
