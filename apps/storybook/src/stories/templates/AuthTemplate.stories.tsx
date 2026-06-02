import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuthTemplate } from '@interlace/ui/templates/auth-template';
import { Button } from '@interlace/ui/button';
import { Field, FieldControl, FieldLabel } from '@interlace/ui/form';
import { Input } from '@interlace/ui/input';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof AuthTemplate> = {
  title: 'Templates/AuthTemplate',
  component: AuthTemplate,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof AuthTemplate>;

const sampleLogo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-8 rounded-md bg-linear-to-br from-violet-500 to-violet-700"
    />
    <span className="text-lg">Interlace</span>
  </a>
);

const sampleForm = (
  <form className="flex flex-col gap-md">
    <Field>
      <FieldLabel>Email</FieldLabel>
      <FieldControl>
        <Input type="email" placeholder="you@interlace.tools" />
      </FieldControl>
    </Field>
    <Field>
      <FieldLabel>Password</FieldLabel>
      <FieldControl>
        <Input type="password" placeholder="••••••••" />
      </FieldControl>
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

export const Dark: Story = { ...SignIn, decorators: [withDark] };
export const RTL: Story = { ...SignIn, decorators: [withRtl] };
