import type { Meta, StoryObj } from '@storybook/react-vite';
import { ErrorTemplate } from '@interlace/ui/templates/error-template';
import { Button } from '@interlace/ui/button';
import { withRtl } from '@/decorators';

const meta: Meta<typeof ErrorTemplate> = {
  title: 'Templates/ErrorTemplate',
  component: ErrorTemplate,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Full-page error surface for 404 / 500 / 503 plus a generic fallback. Each variant supplies its own status code, title and copy; pass `actions` for the recovery CTAs. Use `Primitives/DataState` instead when only a region of an otherwise-working page failed.",
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['404', '500', '503', 'generic'],
      description: 'Selects the built-in status code, title and description. Any of the three can still be overridden individually.',
      table: { category: 'Appearance', type: { summary: "'404' | '500' | '503' | 'generic'" }, defaultValue: { summary: '404' } },
    },
    statusCode: { control: 'text', description: 'Overrides the variant status code.', table: { category: 'Content' } },
    title: { control: 'text', description: 'Overrides the variant headline.', table: { category: 'Content' } },
    description: { control: 'text', description: 'Overrides the variant explanatory copy.', table: { category: 'Content' } },
    actions: { control: false, description: 'Recovery CTA cluster — back home, retry, contact support.', table: { category: 'Slots', type: { summary: 'ReactNode' } } },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorTemplate>;

const sampleActions = (
  <>
    <Button>Back to home</Button>
    <Button variant="outline">Contact support</Button>
  </>
);

export const NotFound: Story = {
  args: { variant: '404', actions: sampleActions },
};

export const ServerError: Story = {
  args: { variant: '500', actions: sampleActions },
};

export const Maintenance: Story = {
  args: { variant: '503', actions: sampleActions },
};

export const Dark: Story = { ...NotFound, globals: { theme: 'dark' } };
export const RTL: Story = { ...NotFound, decorators: [withRtl] };

/**
 * PageSkeleton — the page-level loading state a consumer renders from
 * `loading.tsx` while the whole route is in flight. Shapes mirror the
 * real layout so the swap costs no layout shift (R23).
 */
export const PageSkeleton: Story = {
  render: () => <ErrorTemplate.Skeleton />,
};
