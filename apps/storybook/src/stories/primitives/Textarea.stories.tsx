import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Textarea, MIN_VIEWPORT } from '@interlace/ui/textarea';
import { withRtl } from '@/decorators';
import { Skeleton } from '@interlace/ui/skeleton';

const meta = {
  title: 'Primitives/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The free-text field for input that legitimately runs to several lines — a comment, a rationale, a commit body. Use Input for anything that fits on one line; a textarea invites length, so do not use one for a name or a URL. It is a thin surface over the native element: size, tone and resize are ours, while selection, IME, undo and `onChange` stay the platform\'s. Server component, and every size clears the 2.5.5 target floor at the 320px viewport.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description:
        'Padding, type scale and min-height together: sm 64px · md 96px · lg 128px. Pick by how much text you expect, not by how much room you have.',
      table: {
        category: 'Appearance',
        type: { summary: "'sm' | 'md' | 'lg'" },
        defaultValue: { summary: "'md'" },
      },
    },
    tone: {
      control: 'select',
      options: ['default', 'invalid'],
      description:
        'Border tone. `invalid` is the explicit form; `aria-invalid` produces the same border and is what you should set, since it also tells assistive tech.',
      table: {
        category: 'Appearance',
        type: { summary: "'default' | 'invalid'" },
        defaultValue: { summary: "'default'" },
      },
    },
    resize: {
      control: 'select',
      options: ['y', 'none'],
      description:
        'Vertical-only by default — never allow horizontal resize, which breaks the measure. `none` for fixed-height fields inside a tight layout.',
      table: {
        category: 'Appearance',
        type: { summary: "'y' | 'none'" },
        defaultValue: { summary: "'y'" },
      },
    },
    rows: {
      control: { type: 'number', min: 1, max: 20, step: 1 },
      description:
        'Native row hint. The `size` min-height wins when it is taller, so use this only to make a field deliberately larger.',
      table: { category: 'Appearance', type: { summary: 'number' } },
    },
    placeholder: {
      control: 'text',
      description:
        'A hint, never the label — it disappears on the first keystroke. Pair with a real `<Label>` or an `aria-label`.',
      table: { category: 'Content', type: { summary: 'string' } },
    },
    defaultValue: {
      control: 'text',
      description: 'Uncontrolled initial content. Read once on mount.',
      table: { category: 'Content', type: { summary: 'string' } },
    },
    maxLength: {
      control: 'number',
      description:
        'Hard cap. Show the remaining count next to the field if you set one — silent truncation is a bug report.',
      table: { category: 'Content', type: { summary: 'number' } },
    },
    disabled: {
      control: 'boolean',
      description:
        'Not editable, not focusable, not submitted. 50% opacity — exempt from SC 1.4.3 as an inactive component.',
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    readOnly: {
      control: 'boolean',
      description:
        'Not editable but still focusable, selectable and submitted. The right choice for content the user must be able to copy.',
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    required: {
      control: 'boolean',
      description: 'Blocks native form submission while empty.',
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    name: {
      control: 'text',
      description: 'Field name on submit.',
      table: { category: 'Form', type: { summary: 'string' } },
    },
    onChange: {
      action: 'change',
      description: 'Native change event — nothing is intercepted on the way through.',
      table: { category: 'Events', type: { summary: '(event) => void' } },
    },
    className: {
      control: 'text',
      description:
        'Merged after the cva classes, so a one-off width or `font-mono` still wins.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  args: {
    size: 'md',
    tone: 'default',
    resize: 'y',
    disabled: false,
    readOnly: false,
    required: false,
    onChange: fn(),
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Tell us what you think…',
    name: 'feedback',
    rows: 4,
  },
  // Shown as a real form field — label above, helper text below — because the
  // label association and the helper spacing are half of what this primitive
  // has to get right.
  render: (args) => (
    <div className="flex w-[480px] max-w-full flex-col gap-xs">
      <label htmlFor="tx-default" className="text-ui-sm font-medium">
        Feedback
      </label>
      <Textarea id="tx-default" aria-describedby="tx-default-hint" {...args} />
      <span id="tx-default-hint" className="text-ui-sm text-muted-foreground">
        Markdown is supported. Drag the bottom-right corner to make it taller.
      </span>
    </div>
  ),
};

/**
 * Full matrix — every `size` × `tone` × `resize` combination so the grid
 * doubles as a visual regression sheet for the cva variants.
 */
export const Variants: Story = {
  render: () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    const tones = ['default', 'invalid'] as const;
    const resizes = ['y', 'none'] as const;

    return (
      <div className="w-[960px] max-w-full space-y-lg">
        {resizes.map((resize) => (
          <section key={resize} className="space-y-sm">
            <h3 className="text-ui-sm font-mono uppercase text-muted-foreground">
              resize=&quot;{resize}&quot;
            </h3>
            <div className="grid grid-cols-1 gap-md md:grid-cols-3">
              {sizes.map((size) =>
                tones.map((tone) => (
                  <div key={`${size}-${tone}`} className="space-y-xs">
                    <div className="text-ui-sm font-mono text-muted-foreground">
                      size=&quot;{size}&quot; · tone=&quot;{tone}&quot;
                    </div>
                    <Textarea
                      size={size}
                      tone={tone}
                      resize={resize}
                      placeholder={`size=${size} tone=${tone}`}
                      aria-invalid={tone === 'invalid' || undefined}
                    />
                  </div>
                )),
              )}
            </div>
          </section>
        ))}
      </div>
    );
  },
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  args: {
    placeholder: 'اكتب رسالتك هنا…',
  },
  decorators: [withRtl],
};

/**
 * Below-min-viewport demo — wrap in a (MIN_VIEWPORT - 1)px container with the
 * `data-interlace-dev` flag so preflight's dashed warning outline appears.
 * Storybook renders both the warning and the still-functional control.
 */
export const BelowMinViewport: Story = {
  render: () => (
    <div data-interlace-dev style={{ width: MIN_VIEWPORT - 1 }}>
      <Textarea placeholder={`< ${MIN_VIEWPORT}px — dev outline`} />
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

/** Disabled — pointer-events off, 50% opacity (SC 1.4.3 exempt). */
export const Disabled: Story = {
  args: {
    'aria-label': 'Disabled notes',
    className: 'w-[320px] max-w-full',
    defaultValue: 'Read-only while the run is in flight.',
    disabled: true,
  },
  render: (args) => <Textarea {...args} />,
};

/**
 * Invalid — `aria-invalid` flips the border to `--destructive`
 * (8.31:1 light / 10.43:1 dark on the page, past the 3:1 SC 1.4.11 floor)
 * and pairs with a described-by error message.
 */
export const Invalid: Story = {
  render: () => (
    <div className="flex w-[320px] max-w-full flex-col gap-1">
      <Textarea
        aria-label="Rule rationale"
        aria-invalid="true"
        aria-describedby="rationale-err"
        placeholder="Why should this rule ship?"
      />
      <span id="rationale-err" className="text-destructive text-xs">
        A rationale is required.
      </span>
    </div>
  ),
};

/** Loading placeholder — reserves the md size's min-height. */
export const Loading: Story = {
  render: () => (
    <div className="w-[320px] max-w-full">
      <Skeleton variant="textarea" />
    </div>
  ),
};
