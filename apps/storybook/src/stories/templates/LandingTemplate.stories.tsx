import type { Meta, StoryObj } from '@storybook/react-vite';
import { LandingTemplate } from '@interlace/ui/templates/landing-template';
import { Hero } from '@interlace/ui/patterns/hero';
import { FeatureGrid } from '@interlace/ui/patterns/feature-grid';
import { CTASection } from '@interlace/ui/patterns/cta-section';
import { Button } from '@interlace/ui/button';
import { Shield, Zap, Heart } from 'lucide-react';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof LandingTemplate> = {
  title: 'Templates/LandingTemplate',
  component: LandingTemplate,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof LandingTemplate>;

const logo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-6 rounded-md bg-linear-to-br from-violet-500 to-violet-700"
    />
    <span>Interlace</span>
  </a>
);

export const Default: Story = {
  args: {
    topbar: {
      logo,
      links: [
        { href: '/docs', label: 'Docs' },
        { href: '/pricing', label: 'Pricing' },
        { href: '/blog', label: 'Blog' },
      ],
      actions: <Button size="sm">Get started</Button>,
    },
    hero: (
      <Hero
        eyebrow="Open source · MIT"
        headline="The DS for shipping pages fast"
        body="Production-grade React primitives, patterns, and templates. R1-R26 enforced, WCAG 2.2 AA hard-gated, shadcn-compatible."
        actions={
          <>
            <Button size="lg">Get started</Button>
            <Button variant="outline" size="lg">
              Read the docs
            </Button>
          </>
        }
      />
    ),
    features: (
      <FeatureGrid
        title="Built for production"
        features={[
          { icon: <Shield className="size-6" />, title: 'A11y first', description: 'WCAG 2.2 AA hard gate.' },
          { icon: <Zap className="size-6" />, title: 'Fast', description: 'RSC-friendly, streams per section.' },
          { icon: <Heart className="size-6" />, title: 'Open', description: 'MIT licensed.' },
        ]}
      />
    ),
    cta: (
      <CTASection
        title="Ready to ship?"
        description="Install the DS and start shipping today."
        actions={<Button size="lg">Get started</Button>}
      />
    ),
    footer: {
      brand: logo,
      copyright: '© 2026 Interlace.',
    },
  },
};

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
