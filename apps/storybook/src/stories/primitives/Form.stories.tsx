import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import {
  Form,
  Field,
  FieldLabel,
  FieldControl,
  FieldDescription,
  FieldError,
  MIN_VIEWPORT,
} from '@interlace/ui/form';
import { Input } from '@interlace/ui/input';
import { Button } from '@interlace/ui/button';
import { withRtl } from '@/decorators';
import { Skeleton } from '@interlace/ui/skeleton';

const meta = {
  title: 'Primitives/Form',
  component: Form,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A native `<form>` with the DS data attributes, plus the `Field.*` parts that group one labelled control with its description and error. Use it for anything that submits — the point is that label, control, description and error are wired to each other by generated id, so a screen reader announces the whole triplet and `aria-invalid` flips with validity, rather than each call site reinventing that wiring (FORM_PHILOSOPHY.md). It deliberately does not own validation or field state: bring `action` / a server action / your own form library and keep `onSubmit` native. Server component; MIN_VIEWPORT = 320px, because a sign-in form is the last surface allowed to degrade on a narrow viewport.',
      },
    },
  },
  args: {
    // A real spy so submissions land in the Actions panel. preventDefault
    // keeps the Storybook iframe from navigating away on submit.
    onSubmit: fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    }),
  },
  argTypes: {
    onSubmit: {
      control: false,
      description:
        'Native form submit — nothing is wrapped or renamed. Fires after the browser (or Base UI `Field` validation) is satisfied. Call `preventDefault()` if you are handling the submission in JS rather than posting.',
      table: {
        type: { summary: '(event: FormEvent<HTMLFormElement>) => void' },
        category: 'Events',
      },
    },
    action: {
      control: 'text',
      description:
        'Native form action — a URL for a classic POST, or a React Server Action function. Passed straight through.',
      table: { type: { summary: 'string | ServerAction' }, category: 'Submission' },
    },
    method: {
      control: 'select',
      options: ['get', 'post'],
      description: 'Native form method, used with a URL `action`.',
      table: {
        type: { summary: "'get' | 'post'" },
        defaultValue: { summary: 'get' },
        category: 'Submission',
      },
    },
    noValidate: {
      control: 'boolean',
      description:
        'Skip the browser’s own constraint validation on submit. Turn it on when a form library owns the error messages, so the native bubble does not fight it.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'Submission',
      },
    },
    autoComplete: {
      control: 'select',
      options: ['on', 'off'],
      description:
        'Form-level autofill hint. Leave it on except where a password manager filling the form would be wrong — the per-field `autoComplete` token on each `Input` is what actually drives good autofill.',
      table: { type: { summary: "'on' | 'off'" }, category: 'Submission' },
    },
    asChild: {
      control: 'boolean',
      description:
        'Render as the single element child instead of a `<form>` — for framework form components such as `react-router`’s `<Form>`. A server-safe `cloneElement` slot, not Base UI `useRender`, so it does not flip the tree to a client boundary.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'Slots',
      },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the `<form>`. The form owns the vertical rhythm between its fields — there is no built-in gap.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
    children: {
      control: false,
      description:
        'One `Field` per control (`FieldLabel` + `FieldControl` + optional `FieldDescription` / `FieldError`), plus the submit button.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
  },
} satisfies Meta<typeof Form>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default — canonical sign-in form. Two required fields with descriptions plus
 * a submit. Walks the reader through the full composition (Form → Field →
 * FieldLabel + FieldControl + FieldDescription) once before the Variants story
 * shows the validity split. Submit it: the `onSubmit` spy logs to the Actions
 * panel. Turn `noValidate` on to watch the browser stop blocking an empty
 * submit.
 */
export const Default: Story = {
  args: {
    className: 'flex w-[360px] max-w-full flex-col gap-md',
    method: 'post',
    noValidate: false,
    autoComplete: 'on',
    asChild: false,
  },
  render: (args) => (
    <Form {...args}>
      <Field name="email" className="flex flex-col gap-xs">
        <FieldLabel>Email</FieldLabel>
        <FieldControl
          render={
            <Input
              type="email"
              required
              autoComplete="email"
              placeholder="you@interlace.tools"
            />
          }
        />
        <FieldDescription>We never share your address.</FieldDescription>
      </Field>
      <Field name="password" className="flex flex-col gap-xs">
        <FieldLabel>Password</FieldLabel>
        <FieldControl
          render={
            <Input
              type="password"
              required
              minLength={12}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          }
        />
        <FieldDescription>At least 12 characters.</FieldDescription>
        <FieldError />
      </Field>
      <Button type="submit" className="self-start">
        Sign in
      </Button>
    </Form>
  ),
};

/**
 * Variants — validity axis. Side-by-side `valid` (clean state, just a
 * description) and `invalid` (aria-invalid + FieldError announced via
 * aria-describedby) so the destructive ring + error text contract is
 * visible at a glance.
 */
export const Variants: Story = {
  render: () => (
    <div className="grid w-[720px] max-w-full grid-cols-1 gap-md md:grid-cols-2">
      <Form>
        <div className="mb-sm text-ui-sm font-mono uppercase text-muted-foreground">
          valid
        </div>
        <Field name="email-valid">
          <FieldLabel>Email</FieldLabel>
          <FieldControl
            render={
              <Input
                type="email"
                autoComplete="email"
                defaultValue="ofri@interlace.tools"
              />
            }
          />
          <FieldDescription>We never share your address.</FieldDescription>
        </Field>
      </Form>
      <Form>
        <div className="mb-sm text-ui-sm font-mono uppercase text-muted-foreground">
          invalid
        </div>
        <Field name="email-invalid" invalid>
          <FieldLabel>Email</FieldLabel>
          <FieldControl
            render={
              <Input type="email" autoComplete="email" defaultValue="not-an-email" />
            }
          />
          <FieldDescription>We never share your address.</FieldDescription>
          <FieldError>Enter a valid email address.</FieldError>
        </Field>
      </Form>
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  render: () => (
    <Form className="w-[360px] max-w-full" dir="rtl" lang="ar">
      <Field name="email-rtl">
        <FieldLabel>البريد الإلكتروني</FieldLabel>
        <FieldControl
          render={<Input type="email" autoComplete="email" placeholder="you@interlace.tools" />}
        />
        <FieldDescription>لن نشارك عنوانك أبدًا.</FieldDescription>
      </Field>
      <Field name="password-rtl">
        <FieldLabel>كلمة المرور</FieldLabel>
        <FieldControl
          render={
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
            />
          }
        />
        <FieldDescription>على الأقل 12 حرفًا.</FieldDescription>
      </Field>
      <Button type="submit">تسجيل الدخول</Button>
    </Form>
  ),
  decorators: [withRtl],
};

/**
 * Below-min-viewport demo — wrap the sign-in form in a (MIN_VIEWPORT - 1)px
 * container with `data-interlace-dev` so preflight's dashed warning outline
 * fires. The form still renders + still works; the outline simply flags
 * that the consumer is asking the primitive to operate under its declared
 * floor (R14).
 */
export const BelowMinViewport: Story = {
  render: () => (
    <div data-interlace-dev style={{ width: MIN_VIEWPORT - 1 }}>
      <Form>
        <Field name="email-narrow">
          <FieldLabel>Email</FieldLabel>
          <FieldControl
            render={<Input type="email" autoComplete="email" placeholder="you@…" />}
          />
          <FieldDescription>{`< ${MIN_VIEWPORT}px — dev outline`}</FieldDescription>
        </Field>
        <Button type="submit">Sign in</Button>
      </Form>
    </div>
  ),
  decorators: [
    (Story) => (
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

/**
 * Loading placeholder — three label+control rows and a submit button, so
 * the form's height is reserved before the real fields hydrate (CLS=0).
 */
export const Loading: Story = {
  render: () => (
    <div className="w-[320px] max-w-full">
      <Skeleton variant="form" />
    </div>
  ),
};
