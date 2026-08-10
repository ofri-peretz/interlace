import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea, MIN_VIEWPORT } from '@interlace/ui/textarea';
import { withDark, withRtl } from '@/decorators';
import { Skeleton } from '@interlace/ui/skeleton';

const meta = {
  title: 'Primitives/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Multi-line text input. Surface primitive over the native `<textarea>` — owns size + tone + resize, defers selection / IME / undo / onChange to the platform. Server component; MIN_VIEWPORT = 320px (form controls must work on a 320 CSS-px iPhone SE).',
      },
    },
  },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    tone: { control: 'select', options: ['default', 'invalid'] },
    resize: { control: 'select', options: ['y', 'none'] },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Tell us what you think…',
  },
  render: (args) => (
    <div className="w-[480px] max-w-full">
      <Textarea {...args} />
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
  decorators: [withDark],
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
  render: () => (
    <Textarea
      aria-label="Disabled notes"
      className="w-[320px] max-w-full"
      defaultValue="Read-only while the run is in flight."
      disabled
    />
  ),
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
