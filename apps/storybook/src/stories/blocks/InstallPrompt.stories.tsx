import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Smartphone } from 'lucide-react';
import { expect, within } from 'storybook/test';
import { InstallPrompt } from '@interlace/ui/patterns/install-prompt';
import { withRtl } from '@/decorators';

/**
 * Stands in for the browser: after the prompt has mounted (and is listening),
 * it fires the `beforeinstallprompt` event a browser fires when a page can be
 * installed. The prompt's own listener runs first, as children's effects do.
 */
function OfferInstall({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    event.prompt = () => Promise.resolve();
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(event);
  }, []);
  return <>{children}</>;
}

const meta = {
  title: 'Blocks/InstallPrompt',
  component: InstallPrompt,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'An offer to add the site to the home screen, only where it can work. Where the browser offers its install dialog (`beforeinstallprompt`), Install opens it. On Safari for iPhone and iPad it says how instead: Share, then Add to Home Screen. Nothing shows in an installed app, after an install, or for `dismissDays` after Not now (remembered in localStorage, and harmless when storage is off). `useInstallPrompt()` gives the same state to a control of your own. In these stories a stand-in fires the browser\'s event.',
      },
    },
  },
  args: { icon: <Smartphone />, storageKey: 'storybook:install-prompt', dismissDays: 0 },
  render: (args) => (
    <div className="max-w-prose">
      <OfferInstall>
        <InstallPrompt {...args} />
      </OfferInstall>
    </div>
  ),
} satisfies Meta<typeof InstallPrompt>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The browser can install: Install opens its dialog. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = await canvas.findByRole('region', { name: 'Install the app' });
    await expect(region).toBeTruthy();
    await expect(canvas.getByRole('button', { name: 'Install' })).toBeTruthy();
    await Promise.all(region.getAnimations().map((a) => a.finished));
  },
};

/** Words in another language. */
export const Labels: Story = {
  args: {
    labels: {
      title: 'Ajouter à l’écran d’accueil',
      description: 'Ouvrez-la depuis votre écran d’accueil, en plein écran.',
      install: 'Installer',
      dismiss: 'Plus tard',
    },
  },
};

/** Right to left. */
export const RightToLeft: Story = {
  decorators: [withRtl],
};
