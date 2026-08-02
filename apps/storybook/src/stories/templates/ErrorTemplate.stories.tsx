import type { Meta, StoryObj } from '@storybook/react-vite';
import { ErrorTemplate } from '@interlace/ui/templates/error-template';
import { Button } from '@interlace/ui/button';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof ErrorTemplate> = {
  title: 'Templates/ErrorTemplate',
  component: ErrorTemplate,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
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

export const Dark: Story = { ...NotFound, decorators: [withDark] };
export const RTL: Story = { ...NotFound, decorators: [withRtl] };

/**
 * PageSkeleton — the page-level loading state a consumer renders from
 * `loading.tsx` while the whole route is in flight. Shapes mirror the
 * real layout so the swap costs no layout shift (R23).
 */
export const PageSkeleton: Story = {
  render: () => <ErrorTemplate.Skeleton />,
};
