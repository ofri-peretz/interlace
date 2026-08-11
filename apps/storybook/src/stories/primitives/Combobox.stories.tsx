import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  Combobox,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxClear,
  ComboboxCollection,
  ComboboxCompose,
  ComboboxContent,
  ComboboxControl,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxStatus,
  ComboboxTrigger,
  ComboboxValue,
} from '@interlace/ui/combobox';
import { Label } from '@interlace/ui/label';
import { Skeleton } from '@interlace/ui/skeleton';
import { withReducedMotion, withRtl } from '@/decorators';

const meta: Meta<typeof Combobox> = {
  title: 'Primitives/Combobox',
  component: Combobox,
  tags: ['autodocs'],
  parameters: {
    // Not centered — a combobox is a FORM CONTROL and belongs at the width
    // of the field it fills. Same reasoning as Select.
    layout: 'padded',
    docs: {
      description: {
        component:
          'A text input that filters a list. Reach for it when the list is too long to scan — a package picker, a country field, a tag selector. Under ~7 options use `Select` instead: a combobox trades a one-keystroke listbox for a text field. Base UI owns the filtering, the combobox/listbox ARIA and the keyboard model; the one thing to know is that filtering only happens when `ComboboxList` takes a FUNCTION child (`{(item) => <ComboboxItem …/>}`) and the root carries `items` — a mapped array renders every row forever and reads as a broken filter.',
      },
    },
  },
  argTypes: {
    items: {
      control: false,
      description:
        'The full, unfiltered source list. Required for filtering and for `ComboboxEmpty` to know the list is empty rather than unmounted. `{ value, label }` objects resolve to a display string with no extra prop.',
      table: { type: { summary: 'readonly Item[] | readonly Group<Item>[]' }, category: 'Data' },
    },
    value: {
      control: false,
      description: 'Selected item. Controlled — pair with `onValueChange`.',
      table: { type: { summary: 'Item | null' }, category: 'Data' },
    },
    defaultValue: {
      control: false,
      description: 'Initially selected item. Uncontrolled.',
      table: { type: { summary: 'Item | null' }, category: 'Data' },
    },
    multiple: {
      control: 'boolean',
      description:
        'Select many. The value becomes an array and the field is composed from `ComboboxChips` + `ComboboxChip` instead of a bare control.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'Data' },
    },
    filter: {
      control: false,
      description:
        'Override the match function. Default is an `Intl.Collator`-backed `contains` — accent- and case-insensitive in the user\'s locale. Pass `null` to disable filtering entirely (async lists that filter server-side).',
      table: { type: { summary: '((item, query, itemToString) => boolean) | null' }, category: 'Data' },
    },
    limit: {
      control: 'number',
      description: 'Cap the number of rendered rows. `-1` for no cap.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '-1' }, category: 'Data' },
    },
    autoHighlight: {
      control: 'select',
      options: [false, true, 'always'],
      description:
        '`true` highlights the first match once the user types, so Enter commits without arrowing. `\'always\'` highlights as soon as the list opens.',
      table: { type: { summary: "boolean | 'always'" }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    openOnInputClick: {
      control: 'boolean',
      description: 'Open the popup when the input is clicked, not just when the user types.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'State' },
    },
    disabled: {
      control: 'boolean',
      description: 'Ignore all interaction; the field drops to 50% opacity.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    readOnly: {
      control: 'boolean',
      description:
        'The popup still opens and the value still submits, but nothing can be chosen and the query cannot be edited.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    modal: {
      control: 'boolean',
      description: 'Lock page scroll and make the rest of the page inert while the popup is open.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    onValueChange: {
      control: false,
      description: 'Fired with the newly selected item plus Base UI event details.',
      table: { type: { summary: '(value, eventDetails) => void' }, category: 'Events' },
    },
    onInputValueChange: {
      control: false,
      description: 'Fired with the query on every keystroke. Use for server-side filtering.',
      table: { type: { summary: '(value, eventDetails) => void' }, category: 'Events' },
    },
    children: {
      control: false,
      description: '`ComboboxControl` + `ComboboxContent`.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
  },
  args: {
    onValueChange: fn(),
    onOpenChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Combobox>;

interface Plugin {
  value: string;
  label: string;
}

const PLUGINS: Plugin[] = [
  { value: 'secure-coding', label: 'eslint-plugin-secure-coding' },
  { value: 'jwt', label: 'eslint-plugin-jwt' },
  { value: 'crypto', label: 'eslint-plugin-crypto' },
  { value: 'reliability', label: 'eslint-plugin-reliability' },
  { value: 'conventions', label: 'eslint-plugin-conventions' },
  { value: 'nestjs', label: 'eslint-plugin-nestjs' },
  { value: 'express', label: 'eslint-plugin-express' },
  { value: 'react-a11y', label: 'eslint-plugin-react-a11y' },
];

export const Default: Story = {
  args: {
    disabled: false,
    readOnly: false,
    modal: false,
    openOnInputClick: true,
    autoHighlight: false,
  },
  render: (args) => (
    <div className="flex w-72 flex-col gap-1.5">
      <Label htmlFor="plugin-combobox">Plugin</Label>
      <Combobox {...args} items={PLUGINS}>
        <ComboboxControl>
          <ComboboxInput
            id="plugin-combobox"
            placeholder="Search plugins…"
            className="pr-9"
          />
          <ComboboxClear />
        </ComboboxControl>
        <ComboboxContent>
          <ComboboxEmpty>No plugin matches that name.</ComboboxEmpty>
          <ComboboxList>
            {(item: Plugin) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  ),
};

/** `ComboboxCompose` — the flat single-select case in one element. */
export const Compose: Story = {
  render: () => (
    <ComboboxCompose
      className="w-72"
      items={PLUGINS}
      aria-label="Plugin"
      placeholder="Search plugins…"
      emptyMessage="No plugin matches that name."
    />
  ),
};

/**
 * A trigger button instead of a clear button — the "looks like a Select,
 * types like a Combobox" shape. The trigger opens the popup without the user
 * having to type first.
 */
export const WithTrigger: Story = {
  render: () => (
    <div className="w-72">
      <Combobox items={PLUGINS}>
        <ComboboxControl>
          <ComboboxInput
            aria-label="Plugin"
            placeholder="Search plugins…"
            className="pr-9"
          />
          <ComboboxTrigger aria-label="Open plugin list" />
        </ComboboxControl>
        <ComboboxContent>
          <ComboboxEmpty>No plugin matches that name.</ComboboxEmpty>
          <ComboboxList>
            {(item: Plugin) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  ),
};

const GROUPED = [
  {
    value: 'Security',
    items: PLUGINS.slice(0, 3),
  },
  {
    value: 'Quality',
    items: PLUGINS.slice(3, 5),
  },
  {
    value: 'Framework',
    items: PLUGINS.slice(5),
  },
];

/**
 * Grouped results. The root takes an array of `{ value, items }` groups and
 * each `ComboboxGroup` renders its own `ComboboxCollection` — Base UI drops a
 * whole group when none of its items survive the filter.
 */
export const Grouped: Story = {
  render: () => (
    <div className="w-72">
      <Combobox items={GROUPED}>
        <ComboboxControl>
          <ComboboxInput
            aria-label="Plugin"
            placeholder="Search plugins…"
            className="pr-9"
          />
          <ComboboxClear />
        </ComboboxControl>
        <ComboboxContent>
          <ComboboxEmpty>No plugin matches that name.</ComboboxEmpty>
          <ComboboxList>
            {(group: { value: string; items: Plugin[] }) => (
              <ComboboxGroup key={group.value} items={group.items}>
                <ComboboxGroupLabel>{group.value}</ComboboxGroupLabel>
                <ComboboxCollection>
                  {(item: Plugin) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  ),
};

/**
 * Multiple selection. Chips live in the field, and Backspace on an empty
 * input removes the last one — the behaviour a user who has typed into a
 * tag field anywhere else already expects.
 */
export const Multiple: Story = {
  render: () => (
    <div className="w-96">
      <Combobox items={PLUGINS} multiple>
        <ComboboxChips>
          <ComboboxValue>
            {(selected: Plugin[]) => (
              <>
                {selected.map((plugin) => (
                  <ComboboxChip key={plugin.value}>
                    {plugin.label}
                    <ComboboxChipRemove aria-label={`Remove ${plugin.label}`} />
                  </ComboboxChip>
                ))}
              </>
            )}
          </ComboboxValue>
          <ComboboxInput
            aria-label="Plugins"
            placeholder="Add a plugin…"
            // `min-w-24` is the floor that makes the rail WRAP instead of
            // crushing the field to a clipped letter once two chips are in.
            className="h-7 min-w-24 flex-1 border-0 shadow-none focus-visible:ring-0"
          />
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxEmpty>No plugin matches that name.</ComboboxEmpty>
          <ComboboxList>
            {(item: Plugin) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  ),
};

/**
 * Async list. `filter={null}` hands filtering to the server; `ComboboxStatus`
 * is a polite live region, so "Searching…" → "6 results" is announced without
 * stealing focus.
 */
export const AsyncStatus: Story = {
  render: function AsyncStory() {
    const [query, setQuery] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [results, setResults] = React.useState<Plugin[]>(PLUGINS);

    React.useEffect(() => {
      setLoading(true);
      const id = window.setTimeout(() => {
        setResults(
          PLUGINS.filter((p) =>
            p.label.toLowerCase().includes(query.toLowerCase()),
          ),
        );
        setLoading(false);
      }, 250);
      return () => window.clearTimeout(id);
    }, [query]);

    return (
      <div className="w-72">
        <Combobox items={results} filter={null} onInputValueChange={setQuery}>
          <ComboboxControl>
            <ComboboxInput
              aria-label="Plugin"
              placeholder="Search plugins…"
              className="pr-9"
            />
            <ComboboxClear />
          </ComboboxControl>
          <ComboboxContent>
            <ComboboxStatus>
              {loading ? 'Searching…' : `${results.length} results`}
            </ComboboxStatus>
            <ComboboxEmpty>No plugin matches that name.</ComboboxEmpty>
            <ComboboxList>
              {(item: Plugin) => (
                <ComboboxItem key={item.value} value={item}>
                  {item.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    );
  },
};

/**
 * The keyboard contract from `combobox.tsx`, driven for real. axe cannot
 * press a key, so this is the only place the model is proved.
 *
 * Note what is asserted and what is NOT: focus never leaves the input
 * (Base UI navigates virtually via `aria-activedescendant`), so an assertion
 * that `document.activeElement` becomes an option — correct for `Select` —
 * would be asserting a bug here.
 *
 * `overlay-nav-keyboard-lock` fails if this story is deleted.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <div className="w-72">
      <Combobox items={PLUGINS}>
        <ComboboxControl>
          <ComboboxInput
            aria-label="Plugin"
            placeholder="Search plugins…"
            className="pr-9"
          />
          <ComboboxClear />
        </ComboboxControl>
        <ComboboxContent>
          <ComboboxEmpty>No plugin matches that name.</ComboboxEmpty>
          <ComboboxList>
            {(item: Plugin) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('combobox', { name: /plugin/i });
    // The popup is portalled out of `canvasElement`.
    const body = within(document.body);

    await step('The input advertises the listbox it owns', async () => {
      await waitFor(() => {
        expect(input.getAttribute('aria-haspopup')).toBe('listbox');
        expect(input.getAttribute('aria-expanded')).toBe('false');
        expect(input.getAttribute('aria-autocomplete')).toBe('list');
      });
    });

    await step('Typing opens the popup and filters', async () => {
      await userEvent.tab();
      await waitFor(() => expect(document.activeElement).toBe(input));
      await userEvent.keyboard('jwt');
      await waitFor(() => expect(body.queryByRole('listbox')).toBeTruthy());
      await waitFor(() =>
        expect(input.getAttribute('aria-expanded')).toBe('true'),
      );
      await waitFor(() => {
        const options = body.getAllByRole('option');
        expect(options).toHaveLength(1);
        expect(options[0].textContent).toContain('eslint-plugin-jwt');
      });
    });

    await step('ArrowDown highlights WITHOUT moving DOM focus', async () => {
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        const active = input.getAttribute('aria-activedescendant');
        expect(active).toBeTruthy();
        expect(document.getElementById(active!)?.getAttribute('role')).toBe(
          'option',
        );
      });
      // The contract that separates a combobox from a listbox: the caret
      // stays in the text field the whole time.
      expect(document.activeElement).toBe(input);
    });

    await step('Enter commits the highlighted item and closes', async () => {
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(body.queryByRole('listbox')).toBeFalsy());
      await waitFor(() =>
        expect((input as HTMLInputElement).value).toBe('eslint-plugin-jwt'),
      );
      expect(document.activeElement).toBe(input);
    });

    await step('Escape on a closed popup clears the field', async () => {
      // Documented and easy to get wrong: Escape is not a no-op when the
      // list is shut — Base UI treats it as "undo this selection".
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
    });

    await step('Escape while open closes the popup, not the page', async () => {
      await userEvent.keyboard('cry');
      await waitFor(() => expect(body.queryByRole('listbox')).toBeTruthy());
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(body.queryByRole('listbox')).toBeFalsy());
      expect(document.activeElement).toBe(input);
    });
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="w-72">
      <Combobox items={PLUGINS} disabled>
        <ComboboxControl>
          <ComboboxInput aria-label="Plugin" placeholder="Unavailable" />
        </ComboboxControl>
        <ComboboxContent>
          <ComboboxList>
            {(item: Plugin) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-1">
      <Combobox items={PLUGINS}>
        <ComboboxControl>
          <ComboboxInput
            aria-label="Plugin"
            aria-invalid="true"
            aria-describedby="plugin-err"
            placeholder="Search plugins…"
          />
        </ComboboxControl>
        <ComboboxContent>
          <ComboboxList>
            {(item: Plugin) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <span id="plugin-err" className="text-destructive text-xs">
        Choose a plugin from the list.
      </span>
    </div>
  ),
};

export const Dark: Story = {
  globals: { theme: 'dark' },
  parameters: { backgrounds: { default: 'dark' } },
  render: () => (
    <div className="dark w-72">
      <Combobox items={PLUGINS} defaultValue={PLUGINS[1]}>
        <ComboboxControl>
          <ComboboxInput
            aria-label="Plugin"
            placeholder="Search plugins…"
            className="pr-9"
          />
          <ComboboxClear />
        </ComboboxControl>
        <ComboboxContent>
          <ComboboxList>
            {(item: Plugin) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  ),
};

const RTL_ITEMS = [
  { value: 'a', label: 'الأمان' },
  { value: 'b', label: 'الموثوقية' },
  { value: 'c', label: 'الاصطلاحات' },
];

export const RTL: Story = {
  render: () => (
    <div className="w-72">
      <Combobox items={RTL_ITEMS}>
        <ComboboxControl>
          <ComboboxInput aria-label="الإضافة" placeholder="ابحث…" className="pr-9" />
          <ComboboxClear />
        </ComboboxControl>
        <ComboboxContent>
          <ComboboxEmpty>لا توجد نتائج.</ComboboxEmpty>
          <ComboboxList>
            {(item: { value: string; label: string }) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  ),
  decorators: [withRtl],
};

export const ReducedMotion: Story = {
  ...Default,
  decorators: [withReducedMotion],
};

/** Loading placeholder — reserves the 36px control height (CLS=0). */
export const Loading: Story = {
  render: () => (
    <div className="w-72">
      <Skeleton variant="select" />
    </div>
  ),
};
