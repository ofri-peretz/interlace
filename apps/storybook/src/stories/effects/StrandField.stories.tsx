import type { Meta, StoryObj } from '@storybook/react-vite';
import { StrandField } from '@interlace/ui/effects/strand-field';
import { expect, within } from 'storybook/test';

import { COMPARING, FALLING, RISING, TINY, WITH_GAPS } from '../charts/fixtures';

const FIELD = [
  { id: 'downloads', label: 'npm downloads', points: RISING },
  { id: 'visits', label: 'docs visits', points: COMPARING },
  { id: 'stars', label: 'stars', points: WITH_GAPS },
  { id: 'issues', label: 'open issues', points: FALLING },
  { id: 'prs', label: 'external PRs', points: TINY },
];

const meta: Meta<typeof StrandField> = {
  title: 'Effects/StrandField',
  component: StrandField,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Real series lifted into depth: each thread on its own plane in a CSS-3D perspective ' +
          'stage, fanned apart so the weave can be seen THROUGH, tilting gently with the ' +
          'pointer, collapsing back into one flat weave on demand — the thread as a SPACE.\n\n' +
          '**CSS 3D, not WebGL.** `perspective` + `translateZ` + two rotations, composited on ' +
          'the GPU, zero kilobytes of dependency, server-rendered default pose, and a graceful ' +
          'flat stack anywhere 3D transforms are missing. Every strand is the DS’s own SVG ' +
          'polyline drawn with the strand-draw verb, staggered.\n\n' +
          '**The field is theatre; the controls are elsewhere.** The whole field is ' +
          '`aria-hidden` with no focusable element — like HeroStrand, it never carries meaning ' +
          'alone. `onStrandSelect` is a pointer shortcut for a selection surface the consumer ' +
          'already renders accessibly. Under `prefers-reduced-motion` the tilt does not run and ' +
          'every strand is instantly drawn.',
      },
    },
  },
  argTypes: {
    series: {
      control: 'object',
      description:
        'The threads — `{ id, label, points }`. Each strand is normalized to its OWN shape ' +
        '(this is an exhibit of shapes, not a shared-domain chart — state that in nearby copy). ' +
        'Strands with fewer than two numeric points are not drawn; capped at seven planes.',
      table: { type: { summary: 'readonly StrandFieldSeries[]' }, category: 'Data' },
    },
    activeIds: {
      control: 'object',
      description: 'Ids drawn at full presence; the rest recede to 40%. Empty = all present.',
      table: { category: 'State' },
    },
    woven: {
      control: 'boolean',
      description: 'Collapse every plane to z=0 — the flat weave. The transition is the gesture.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    onStrandSelect: {
      description:
        'Pointer shortcut: a strand was clicked. Selection must ALSO be reachable through an ' +
        'accessible surface the consumer renders.',
      table: { category: 'Events' },
    },
  },
};
export default meta;

type Story = StoryObj<typeof StrandField>;

export const Default: Story = {
  args: {
    'data-testid': 'field',
    series: FIELD,
    className: 'h-80',
  },
  play: async ({ canvasElement }) => {
    const field = within(canvasElement).getByTestId('field');
    // Theatre, and only theatre: hidden from the tree, no focusables inside.
    await expect(field).toHaveAttribute('aria-hidden', 'true');
    await expect(field.querySelectorAll('button, a, [tabindex]')).toHaveLength(0);
    // Five threads made it (all fixtures have ≥2 numeric points).
    await expect(field.querySelectorAll('[data-slot="strand-field-plane"]')).toHaveLength(5);
  },
};

export const Woven: Story = {
  args: { 'data-testid': 'field', series: FIELD, woven: true, className: 'h-80' },
  parameters: {
    docs: {
      description: {
        story: 'Every plane at z=0 — the strands read as one flat weave until they are lifted.',
      },
    },
  },
};

export const WithActive: Story = {
  args: {
    'data-testid': 'field',
    series: FIELD,
    activeIds: ['downloads', 'stars'],
    className: 'h-80',
  },
};
