import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AccountMenu, type AccountMenuProps } from '@interlace/ui/patterns/account-menu';
import type { Account, AccountState } from '@interlace/ui/patterns/account-menu-model';
import { useAccount, type AccountAdapter } from '@interlace/ui/patterns/use-account';
import { Topbar } from '@interlace/ui/patterns/topbar';
import { withRtl } from '@/decorators';

/** A small grey face, as a data URI, so the story never reaches for the network. */
const PHOTO =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><rect width='72' height='72' fill='%23c9bfb4'/><circle cx='36' cy='28' r='13' fill='%23f3eee8'/><ellipse cx='36' cy='68' rx='24' ry='22' fill='%23f3eee8'/></svg>";

const dana: Account = {
  id: 'a1',
  firstName: 'Dana',
  lastName: 'Levi',
  email: 'dana@example.com',
  imageUrl: PHOTO,
};

const signedIn = (account: Account = dana): AccountState => ({ status: 'signed-in', account });
const signedOut: AccountState = { status: 'signed-out' };
const unknown: AccountState = { status: 'unknown' };

const links = [{ label: 'Your account', href: '/account' }];

const meta = {
  title: 'Blocks/AccountMenu',
  component: AccountMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The account control at the right end of a `Topbar`\'s `actions` slot, in the three states every app with accounts has: **unknown** (the browser has not read the session yet), **signed out** (a Sign in link that carries the page) and **signed in** (a photo or initials, and a menu). ' +
          'It reserves the room the answer will take, so the bar does not move when the session is read, and the unknown state is inert: not visible, not announced, not focusable.\n\n' +
          '**Any sign-in service.** The component takes `state`. `useAccount(adapter)` builds it from your service through `{ read, subscribe }`, ten lines of your own code; the kit never reads or writes a session, a cookie or a storage key. ' +
          'Keep the adapter stable (module scope or `useMemo`), and import the service lazily, so its script is not in the first load.\n\n' +
          '```tsx\n' +
          '// Your code. A client that has getSession() and onAuthStateChange():\n' +
          'const adapter: AccountAdapter = {\n' +
          '  read: async () => toAccount((await auth.getSession()).data.session),\n' +
          '  subscribe: (onChange) => {\n' +
          '    const { data } = auth.onAuthStateChange((_event, session) => onChange(toAccount(session)));\n' +
          '    return () => data.subscription.unsubscribe();\n' +
          '  },\n' +
          '};\n\n' +
          '// Your code. A library with getSession() and a session event:\n' +
          'const adapter: AccountAdapter = {\n' +
          '  read: async () => toAccount(await getSession()),\n' +
          '  subscribe: (onChange) => onSessionEvent(async () => onChange(toAccount(await getSession()))),\n' +
          '};\n\n' +
          '// Your code. Only a cookie your server sets, readable by the page:\n' +
          'const adapter: AccountAdapter = { read: () => readProfileCookie() };\n' +
          '```\n\n' +
          '**A better profile later.** `subscribe` may report the same person twice, first with what the session knows and then with the profile: an equal account changes nothing, a better one replaces it.\n\n' +
          '**`safeReturnPath`.** The other side of `?next=`: only a path on this site comes back out, and `signInHref` uses it to build the link. Use it on the reading side too, not only when you build the link. ' +
          'It refuses a string that does not start with `/`, starts with `//` or `/\\`, or has whitespace, a control character or a backslash anywhere (a browser deletes a tab or a newline from an address, so `/\\t/host` is `//host`), and then parses the rest. ' +
          'An encoded slash (`/%2F%2Fhost`) is a path on this site, because a browser does not decode it before it resolves an address; decode it yourself, and you must check the result again.\n\n' +
          '| Input | Result |\n| --- | --- |\n' +
          '| `/a/b?x=1#y` | kept |\n| `/%2F%2Fevil.com` | kept (a path on this site) |\n| `//evil.com` | fallback |\n| `/\\evil.com` | fallback |\n| `/\\t/evil.com` (a tab) | fallback |\n| `/\\n/evil.com` (a newline) | fallback |\n| `https://evil.com` | fallback |\n| `javascript:alert(1)` | fallback |\n| `evil.com`, empty, `null` | fallback |\n\n' +
          '**Without JavaScript** the server renders the unknown placeholder, because the session is read in the browser. A page that wants a link then renders its own `<noscript>` Sign in link beside it.',
      },
    },
  },
  args: {
    state: signedIn(),
    signInHref: '/sign-in',
    here: '/pricing',
    links,
    onSignOut: () => new Promise<void>((resolve) => setTimeout(resolve, 600)),
  },
  argTypes: {
    state: { control: 'object', table: { category: 'State' } },
    signInHref: { control: 'text', table: { category: 'Content' } },
    here: {
      control: 'text',
      description: 'The page the person is on. Added to the Sign in link as `?next=`.',
      table: { category: 'Content' },
    },
    links: { control: 'object', table: { category: 'Content' } },
    labels: { control: 'object', table: { category: 'Content' } },
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-72 justify-end">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A signed-in person, with a photo. */
export const SignedIn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Account menu for Dana' })).toHaveAttribute('aria-expanded', 'false');
  },
};

/** Before the browser has read the session: nothing to see, hear or focus, and the room is kept. */
export const Unknown: Story = {
  args: { state: unknown },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('link')).toBeNull();
    await expect(canvas.queryByRole('button')).toBeNull();
    await expect(canvasElement.querySelector('[data-slot="account-menu-placeholder"]')).toHaveAttribute('inert');
  },
};

/** A visitor: Sign in carries the page they are on. */
export const SignedOut: Story = {
  args: { state: signedOut },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Sign in' });
    await expect(link).toHaveAttribute('href', '/sign-in?next=%2Fpricing');
  },
};

/** On the sign-in page itself the link carries nothing. */
export const SignedOutOnSignInPage: Story = {
  args: { state: signedOut, here: '/sign-in/' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
  },
};

/** No photo: the initials, which are a picture of a person and not a label. */
export const SignedInNoPhoto: Story = {
  args: { state: signedIn({ ...dana, imageUrl: null }) },
};

/** Initials for a name that is not Latin, one letter from each name, not cut in half. */
export const SignedInHebrewName: Story = {
  decorators: [withRtl],
  args: { state: signedIn({ id: 'h1', firstName: 'דנה', lastName: 'לוי', email: 'dana@example.com' }) },
};

/** Open: the header (a heading, not an item), the app's links, then Sign out. */
export const MenuOpen: Story = {
  args: { links: [...links, { label: 'Notifications', href: '/notifications' }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Account menu for Dana' }));
    const menu = await within(document.body).findByRole('menu');
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
  },
};

/** Sign out takes a moment: the item is disabled and says so, and the menu stays open. */
export const SigningOut: Story = {
  args: { onSignOut: () => new Promise<void>(() => {}) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Account menu for Dana' }));
    await userEvent.click(await within(document.body).findByRole('menuitem', { name: 'Sign out' }));
    await expect(await within(document.body).findByRole('menuitem', { name: 'Signing out…' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
};

/** Sign out failed: the menu closes, focus is back on the trigger, and a polite message says so. */
export const SignOutFailed: Story = {
  args: { onSignOut: () => Promise.reject(new Error('offline')), onError: () => {} },
  render: (args) => (
    <div className="flex flex-col items-end gap-2">
      <AccountMenu {...args} />
      <p className="text-sm text-muted-foreground">
        The message is in a visually hidden live region; it is shown here so the state can be seen.
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Account menu for Dana' });
    await userEvent.click(trigger);
    await userEvent.click(await within(document.body).findByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(canvasElement.querySelector('[data-slot="account-menu-live"]')).toHaveTextContent(/could not sign you out/));
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/** A long name and a long address truncate inside the menu, with the full text in a title. */
export const LongEmail: Story = {
  args: {
    state: signedIn({
      id: 'l1',
      firstName: 'Bartholomew-Alexander',
      lastName: 'Featherstonehaugh',
      email: 'bartholomew-alexander.featherstonehaugh@a-very-long-company-domain-name.example.com',
    }),
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Account menu for/ }));
    await expect(await within(document.body).findByRole('menu')).toBeVisible();
  },
};

/** At the 320 px floor the menu stays inside the screen. */
export const Mobile320: Story = {
  decorators: [
    (Story) => (
      <div className="w-80 overflow-hidden">
        <Story />
      </div>
    ),
  ],
  play: MenuOpen.play,
  args: MenuOpen.args,
};

/** Right to left: the menu opens toward the start of the line, the name is shown as given. */
export const Rtl: Story = {
  decorators: [withRtl],
  play: MenuOpen.play,
  args: MenuOpen.args,
};

/** More contrast, the AAA reading condition. */
export const HighContrast: Story = {
  globals: { interlaceContrast: 'more' },
  play: MenuOpen.play,
  args: MenuOpen.args,
};

/** Text at 150 percent. */
export const TextSize150: Story = {
  globals: { interlaceTextSize: '2xl' },
  play: MenuOpen.play,
  args: MenuOpen.args,
};

const bar = (props: Partial<AccountMenuProps> & { state: AccountState }) => (
  <Topbar
    logo={
      <a href="/" className="font-semibold">
        Acme
      </a>
    }
    actions={
      <>
        <a href="/docs" data-testid="neighbour" className="px-2 text-sm">
          Docs
        </a>
        <AccountMenu signInHref="/sign-in" here="/pricing" links={links} onSignOut={() => {}} {...props} />
      </>
    }
    mobileNav="none"
  />
);

const STATES = {
  unknown,
  'signed-out': signedOut,
  'signed-in': signedIn(),
} as const;

const InTopbarFlow = () => {
  const [name, setName] = React.useState<keyof typeof STATES>('unknown');
  return (
    <div>
      {bar({ state: STATES[name] })}
      <div className="flex gap-2 p-4">
        {(Object.keys(STATES) as (keyof typeof STATES)[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setName(key)}
            className="rounded-lg border px-3 py-1.5 text-sm"
          >
            Show {key}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * In a Topbar's `actions`. The play function records where the neighbour on the left sits in each
 * of the three states and asserts that it is the same place: the bar does not move.
 */
export const InTopbar: Story = {
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <Story />],
  render: () => <InTopbarFlow />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const lefts: number[] = [];
    const widths: number[] = [];
    for (const key of ['unknown', 'signed-out', 'signed-in'] as const) {
      await step(`the neighbour's place in ${key}`, async () => {
        await userEvent.click(canvas.getByRole('button', { name: `Show ${key}` }));
        const neighbour = canvas.getByTestId('neighbour');
        await waitFor(() =>
          expect(canvasElement.querySelector('[data-slot="account-menu"]')).toHaveAttribute('data-state', key),
        );
        lefts.push(neighbour.getBoundingClientRect().left);
        widths.push(canvasElement.querySelector('[data-slot="account-menu"]')!.getBoundingClientRect().width);
      });
    }
    await expect(new Set(lefts.map((n) => Math.round(n * 10))).size).toBe(1);
    await expect(new Set(widths.map((n) => Math.round(n * 10))).size).toBe(1);
  },
};

/** An adapter the story controls: it answers after a moment and can be told about a sign-in. */
function makeAdapter() {
  const listeners = new Set<(account: Account | null) => void>();
  let current: Account | null = null;
  const adapter: AccountAdapter = {
    read: () => new Promise((resolve) => setTimeout(() => resolve(current), 400)),
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
  const set = (account: Account | null) => {
    current = account;
    listeners.forEach((l) => l(account));
  };
  return { adapter, set };
}

const JourneyFlow = () => {
  const store = React.useMemo(makeAdapter, []);
  const state = useAccount(store.adapter);
  const attempts = React.useRef(0);
  return (
    <div className="flex flex-col items-end gap-3">
      <AccountMenu
        state={state}
        signInHref="/sign-in"
        here="/pricing"
        links={links}
        onSignOut={async () => {
          attempts.current += 1;
          await new Promise((r) => setTimeout(r, 300));
          if (attempts.current === 1) throw new Error('offline');
          store.set(null);
        }}
        onError={() => {}}
      />
      <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => store.set(dana)}>
        Pretend the app signed Dana in
      </button>
    </div>
  );
};

/**
 * The journey: unknown while the adapter reads, then signed out; the app signs Dana in; the first
 * Sign out fails and says so; the second works.
 */
export const Journey: Story = {
  render: () => <JourneyFlow />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const root = () => canvasElement.querySelector('[data-slot="account-menu"]')!;
    await step('unknown: nothing to see or focus while the session is read', async () => {
      await expect(root()).toHaveAttribute('data-state', 'unknown');
      await expect(canvas.queryByRole('link')).toBeNull();
    });
    await step('signed out: the Sign in link', async () => {
      await expect(await canvas.findByRole('link', { name: 'Sign in' }, { timeout: 3000 })).toBeVisible();
    });
    await step('signed in: the app tells the kit', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Pretend the app signed Dana in' }));
      await expect(await canvas.findByRole('button', { name: 'Account menu for Dana' })).toBeVisible();
    });
    await step('signing out fails: the message, and focus is back on the trigger', async () => {
      const trigger = canvas.getByRole('button', { name: 'Account menu for Dana' });
      await userEvent.click(trigger);
      await userEvent.click(await within(document.body).findByRole('menuitem', { name: 'Sign out' }));
      await waitFor(() => expect(root().querySelector('[data-slot="account-menu-live"]')).toHaveTextContent(/could not sign you out/), {
        timeout: 3000,
      });
      await waitFor(() => expect(trigger).toHaveFocus());
    });
    await step('signing out works the second time: back to signed out', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Account menu for Dana' }));
      await userEvent.click(await within(document.body).findByRole('menuitem', { name: 'Sign out' }));
      await expect(await canvas.findByRole('link', { name: 'Sign in' }, { timeout: 3000 })).toBeVisible();
    });
  },
};
