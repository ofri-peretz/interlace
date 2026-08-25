import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DecodeText } from '@interlace/ui/effects/decode-text';
import { SectionHeader } from '@interlace/ui/patterns/section-header';
import { SectionIndex } from '@interlace/ui/section-index';
import { expect, within } from 'storybook/test';

const meta: Meta<typeof SectionIndex> = {
  title: 'Primitives/SectionIndex',
  component: SectionIndex,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The numbered eyebrow: a zero-padded mono numeral in strand-a beside an uppercase ' +
          'tracked label, making the page\'s sections a legible sequence ("01 THE AGENDA … ' +
          '04 THE PROOF"). The numeral counts the way a terminal counts — monospaced, tabular ' +
          'figures — and is the view\'s meaning-point accent; the label stays muted. Screen ' +
          'readers hear "Section 2: The Agenda", never "zero two". No motion of its own: pass ' +
          '`<DecodeText>` as the label for the decode gesture. Drops straight into ' +
          'SectionHeader\'s `eyebrow` slot.',
      },
    },
  },
  argTypes: {
    value: {
      control: { type: 'number', min: 1, step: 1 },
      description: '1-based position in the page sequence; rendered zero-padded.',
      table: { category: 'Content', type: { summary: 'number' } },
    },
    'data-testid': {
      control: 'text',
      description: 'Stable E2E selector; consumer provides — no default.',
      table: { category: 'Contract', type: { summary: 'string' } },
    },
  },
};
export default meta;

type Story = StoryObj<typeof SectionIndex>;

export const Default: Story = {
  args: { value: 2, 'data-testid': 'section-index' },
  render: (args) => <SectionIndex {...args}>The Agenda</SectionIndex>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const numeral = canvasElement.querySelector(
      '[data-slot="section-index-numeral"]',
    );
    expect(numeral?.textContent).toBe('02');
    expect(numeral?.getAttribute('aria-hidden')).toBe('true');
    // The SR path: "Section 2: The Agenda".
    expect(canvas.getByText('Section 2:')).toBeTruthy();
    expect(canvas.getByText('The Agenda')).toBeTruthy();
  },
};

export const InASectionHeader: Story = {
  args: { value: 3, 'data-testid': 'section-index' },
  render: (args) => (
    <SectionHeader
      align="start"
      eyebrow={<SectionIndex {...args}>Evidence over confidence</SectionIndex>}
      title="Benchmarks carry their weights"
      tagline="Public numbers should carry their methodology — a claim expires unless it re-earns its receipt."
      data-testid="section-header"
    />
  ),
};

export const WithDecodeGesture: Story = {
  args: { value: 4, 'data-testid': 'section-index' },
  render: (args) => (
    <SectionIndex {...args}>
      <DecodeText data-testid="section-index-decode">The Proof</DecodeText>
    </SectionIndex>
  ),
};
