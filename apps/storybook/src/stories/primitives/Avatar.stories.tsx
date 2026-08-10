import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar, AvatarImage, AvatarFallback } from '@interlace/ui/avatar';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof Avatar> = {
  title: 'Primitives/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Identity chip for a person or account in a dense row — comment headers, member lists, commit trails. Image errors fall through to `AvatarFallback`, so the surface never collapses and the initials become the accessible name. Not a general image frame: use `AspectRatio` for media.',
      },
    },
  },
  // The Base UI Avatar root deliberately has no props of its own beyond the
  // span passthrough — the real API lives on `AvatarImage` (`src` / `alt` /
  // `onLoadingStatusChange`) and `AvatarFallback`, which are composed as
  // children. `loading` is the one prop this wrapper adds.
  argTypes: {
    loading: {
      control: 'boolean',
      description:
        'Swap the surface for a shape-matched `<Skeleton variant="avatar" />` while the identity resolves. Same footprint, so the row does not shift.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    className: {
      control: 'text',
      description:
        'Sizing seam — the base is `size-8` (32px); override with `size-6` / `size-12` / `size-16` for dense or hero rows.',
      table: { category: 'Appearance' },
    },
    children: {
      control: false,
      description:
        '`AvatarImage` (carries `src` / `alt`) followed by `AvatarFallback` (initials shown while loading or on error).',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    render: {
      control: false,
      description:
        'Replace the rendered element (Base UI render prop) — e.g. wrap the avatar in a link without an extra DOM node.',
      table: { category: 'Slots', type: { summary: 'ReactElement | function' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

// Shown in the row it actually ships in — a 32px avatar alone in a 1200px
// canvas reads as a stray dot and teaches nothing about its scale.
export const Default: Story = {
  args: {
    loading: false,
    className: 'size-10',
    children: (
      <>
        <AvatarImage
          src="https://avatars.githubusercontent.com/u/8528983?v=4"
          alt="Ofri Peretz"
        />
        <AvatarFallback>OP</AvatarFallback>
      </>
    ),
  },
  render: (args) => (
    <div className="flex items-center gap-3">
      <Avatar {...args} />
      <div className="leading-tight">
        <div className="text-sm font-medium">Ofri Peretz</div>
        <div className="text-muted-foreground text-xs">
          committed 2 hours ago
        </div>
      </div>
    </div>
  ),
};
export const FallbackOnly: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>OP</AvatarFallback>
    </Avatar>
  ),
};

/**
 * `loading` — the shape-matched placeholder. Rendered next to the resolved
 * avatar so the footprint match (no layout shift on data arrival) is visible.
 */
export const Loading: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar loading className="size-10" />
        <div className="text-muted-foreground text-sm">loading</div>
      </div>
      <div className="flex items-center gap-3">
        <Avatar className="size-10">
          <AvatarFallback>OP</AvatarFallback>
        </Avatar>
        <div className="text-sm">resolved</div>
      </div>
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};
