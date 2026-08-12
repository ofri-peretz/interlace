import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuthTemplate } from '@interlace/ui/templates/auth-template';
import { Button } from '@interlace/ui/button';
import { Field, FieldControl, FieldLabel } from '@interlace/ui/form';
import { Input } from '@interlace/ui/input';
import { withRtl } from '@/decorators';

const meta: Meta<typeof AuthTemplate> = {
  title: 'Templates/AuthTemplate',
  component: AuthTemplate,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Full-page shell for the four credential flows — sign in, sign up, password reset, verify email. Centred narrow column: brand mark, the consumer's own form, then a helper link. Reach for it when the auth form IS the page; use `Blocks/SignInForm` on its own when the form sits inside a wider layout.",
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['signin', 'signup', 'reset', 'verify'],
      description:
        'Which credential flow. Only changes the default title/description copy — the form itself is always consumer-supplied.',
      table: { category: 'Appearance', type: { summary: "'signin' | 'signup' | 'reset' | 'verify'" }, defaultValue: { summary: 'signin' } },
    },
    title: { control: 'text', description: 'Overrides the variant default headline.', table: { category: 'Content' } },
    description: { control: 'text', description: 'Supporting copy under the headline.', table: { category: 'Content' } },
    logo: { control: false, description: 'Brand mark above the form.', table: { category: 'Slots', type: { summary: 'ReactNode' } } },
    form: { control: false, description: 'Required. The credential form — the template owns layout only.', table: { category: 'Slots', type: { summary: 'ReactNode' } } },
    footer: { control: false, description: 'Cross-flow link ("Already have an account?").', table: { category: 'Slots', type: { summary: 'ReactNode' } } },
  },
};

export default meta;
type Story = StoryObj<typeof AuthTemplate>;

const sampleLogo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-8 rounded-md bg-linear-to-br from-primary to-chart-2"
    />
    <span className="text-lg">Interlace</span>
  </a>
);

const sampleForm = (
  <form className="flex flex-col gap-md">
    <Field>
      <FieldLabel>Email</FieldLabel>
      {/* `render=`, not children: FieldControl clones the element it is
          given. Passing `<Input>` as a child makes Base UI render an
          `<input>` WITH children, which React rejects — that threw inside
          SectionBoundary and painted the whole auth section as the error
          fallback. */}
      <FieldControl
        render={<Input type="email" autoComplete="email" placeholder="you@interlace.tools" />}
      />
    </Field>
    <Field>
      <FieldLabel>Password</FieldLabel>
      <FieldControl
        render={<Input type="password" autoComplete="current-password" placeholder="••••••••" />}
      />
    </Field>
    <Button type="submit" className="mt-sm">
      Sign in
    </Button>
  </form>
);

export const SignIn: Story = {
  args: {
    variant: 'signin',
    logo: sampleLogo,
    form: sampleForm,
    footer: (
      <>
        Don&apos;t have an account?{' '}
        <a href="/signup" className="text-primary underline underline-offset-4">
          Create one
        </a>
      </>
    ),
  },
};

export const SignUp: Story = {
  args: { ...SignIn.args, variant: 'signup' },
};

export const Reset: Story = {
  args: { ...SignIn.args, variant: 'reset' },
};

export const Dark: Story = { ...SignIn, globals: { theme: 'dark' } };
export const RTL: Story = { ...SignIn, decorators: [withRtl] };

/**
 * PageSkeleton — the page-level loading state a consumer renders from
 * `loading.tsx` while the whole route is in flight. Shapes mirror the
 * real layout so the swap costs no layout shift (R23).
 */
export const PageSkeleton: Story = {
  render: () => <AuthTemplate.Skeleton />,
};
