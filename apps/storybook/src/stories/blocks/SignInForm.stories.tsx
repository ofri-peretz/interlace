import type { FormEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SignInForm } from '@interlace/ui/patterns/sign-in-form';
import { withRtl } from '@/decorators';

const meta: Meta<typeof SignInForm> = {
  title: 'Blocks/SignInForm',
  component: SignInForm,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Email + password credential entry, wired as a real `<form>`: the block owns ' +
          'the structure (labels, autocomplete tokens, required flags, error slots) and ' +
          'the consumer owns submission via `action` (server action) or `onSubmit`. ' +
          'Reach for it on any first-party login screen; it is deliberately not an ' +
          'auth *page* — no OAuth buttons, no session handling, no routing — so wrap ' +
          'it in your own layout and add provider buttons around it.',
      },
    },
  },
  args: {
    // Real spy so submitting in the canvas shows up in Actions / Interactions.
    // preventDefault keeps the preview iframe from navigating away on submit.
    onSubmit: fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    }),
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Headline above the form.',
      table: { type: { summary: 'ReactNode' }, defaultValue: { summary: "'Sign in'" } },
    },
    subtitle: {
      control: 'text',
      description: 'Supporting copy under the title. Omit for the bare form.',
      table: { type: { summary: 'ReactNode' } },
    },
    submitLabel: {
      control: 'text',
      description: 'Label on the submit button.',
      table: { type: { summary: 'ReactNode' }, defaultValue: { summary: "'Sign in'" } },
    },
    actions: {
      control: false,
      description:
        'Slot beneath the submit button — typically a "Forgot password?" link. Elements only, so it is not typeable here; see the WithActionsAndFooter story.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    footer: {
      control: false,
      description:
        'Slot below the form — typically a "Don\'t have an account? Sign up." prompt.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    onSubmit: {
      description:
        'Native form submit. Inherited from `React.ComponentProps<\'form\'>` and passed straight through to the underlying `<form>`.',
      table: { type: { summary: 'FormEventHandler<HTMLFormElement>' }, category: 'Events' },
    },
    action: {
      control: false,
      description:
        'Server-action / classic POST target. Mutually exclusive with `onSubmit` in practice — pick one.',
      table: { type: { summary: "string | ((formData: FormData) => void)" }, category: 'Events' },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the inner `<form>` (not the outer stack) — the styling seam for width and spacing overrides.',
      table: { category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Sign in',
    subtitle: '',
    submitLabel: 'Sign in',
  },
};

export const WithSubtitle: Story = {
  args: {
    subtitle: 'Welcome back. Use your work email.',
  },
};

export const WithActionsAndFooter: Story = {
  args: {
    subtitle: 'Welcome back.',
    actions: (
      <a href="#" className="text-primary underline underline-offset-4">
        Forgot password?
      </a>
    ),
    footer: (
      <>
        Don&apos;t have an account?{' '}
        <a href="#" className="text-primary underline underline-offset-4">
          Sign up
        </a>
      </>
    ),
  },
};

/**
 * Auth screens are the one surface a product cannot ship in a single theme —
 * a login page is the first paint of a cold session, before any user
 * preference is known.
 */
export const Dark: Story = {
  ...WithActionsAndFooter,
  globals: { theme: 'dark' },
};

/**
 * The labels, description and error slots mirror; `type="email"` /
 * `type="password"` inputs keep LTR value entry, which is correct — credentials
 * are not natural-language text.
 */
export const RTL: Story = {
  args: {
    title: 'تسجيل الدخول',
    subtitle: 'مرحبًا بعودتك. استخدم بريد العمل الإلكتروني.',
    submitLabel: 'تسجيل الدخول',
  },
  decorators: [withRtl],
};
