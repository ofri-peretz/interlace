import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContextMenu } from '@interlace/ui/context-menu';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof ContextMenu> = {
  title: 'Primitives/ContextMenu',
  component: ContextMenu,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Right-click / long-press menu. Use for true OS-level context affordances (file lists, editor canvases, image grids). For click-to-open menus reach for `DropdownMenu`. Compose API takes a declarative `items` array; for per-part customisation drop to `<ContextMenu>` + `<ContextMenuTrigger>` + `<ContextMenuContent>`.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ContextMenu>;

const sampleItems = [
  { label: 'Open', onSelect: () => {}, shortcut: '↩' },
  { label: 'Duplicate', onSelect: () => {}, shortcut: '⌘D' },
  { type: 'separator' as const },
  { type: 'label' as const, label: 'Danger zone' },
  {
    label: 'Delete',
    onSelect: () => {},
    tone: 'destructive' as const,
    shortcut: '⌫',
  },
];

export const Default: Story = {
  render: () => (
    <div className="flex h-48 w-80 items-center justify-center">
      <ContextMenu.Compose
        trigger={
          <div className="border-border bg-card text-card-foreground flex h-32 w-64 items-center justify-center rounded-md border border-dashed">
            Right-click anywhere here
          </div>
        }
        items={sampleItems}
      />
    </div>
  ),
};

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
