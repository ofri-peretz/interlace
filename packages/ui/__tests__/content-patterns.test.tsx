import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
/**
 * Content patterns for writing that shows its work: StanceList, SideBySide,
 * Dialogue, AudioPlayer. All four are server components; these tests lock the
 * semantics a reader depends on (real lists, labelled regions, text that
 * carries meaning without colour, a transcript next to audio).
 */
import { describe, expect, it } from 'vitest';

import { AudioPlayer } from '../src/patterns/audio-player.js';
import { Dialogue } from '../src/patterns/dialogue.js';
import { SideBySide } from '../src/patterns/side-by-side.js';
import { StanceList } from '../src/patterns/stance-list.js';

describe('StanceList', () => {
  it('renders a list whose position labels are text', () => {
    render(
      <StanceList>
        <StanceList.Item holder="Group A" stance="Supports" tone="success">
          Because of X.
        </StanceList.Item>
        <StanceList.Item holder="Group B" stance="Opposes" tone="warning" />
      </StanceList>,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Supports')).toBeTruthy();
    expect(screen.getByText('Because of X.')).toBeTruthy();
  });
});

describe('SideBySide', () => {
  it('names each column region by its heading', () => {
    render(
      <SideBySide>
        <SideBySide.Column title="What you hear">One.</SideBySide.Column>
        <SideBySide.Column title="What the record shows" tone="info">
          Two.
        </SideBySide.Column>
      </SideBySide>,
    );
    expect(screen.getByRole('region', { name: 'What you hear' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'What the record shows' })).toBeTruthy();
  });

  it('renders on the server', () => {
    expect(
      renderToStaticMarkup(
        <SideBySide>
          <SideBySide.Column title="A">a</SideBySide.Column>
        </SideBySide>,
      ),
    ).toContain('aria-labelledby');
  });
});

describe('Dialogue', () => {
  it('is an ordered list of turns that always name the speaker', () => {
    const { container } = render(
      <Dialogue>
        <Dialogue.Turn speaker="Child">Why?</Dialogue.Turn>
        <Dialogue.Turn speaker="Parent" side="end">
          Good question.
        </Dialogue.Turn>
      </Dialogue>,
    );
    expect(container.querySelector('ol')).not.toBeNull();
    expect(screen.getByText('Child')).toBeTruthy();
    expect(container.querySelector('[data-side="end"]')?.textContent).toContain('Parent');
  });
});

describe('AudioPlayer', () => {
  it('uses native controls, a caption and a transcript', () => {
    const { container } = render(
      <AudioPlayer src="https://example.com/a.mp3" title="Episode 1" detail="4 min" transcript={<p>Hello.</p>} />,
    );
    const audio = container.querySelector('audio');
    expect(audio?.hasAttribute('controls')).toBe(true);
    expect(audio?.getAttribute('aria-label')).toBe('Episode 1');
    expect(audio?.getAttribute('preload')).toBe('metadata');
    expect(container.querySelector('figcaption')?.textContent).toContain('Episode 1');
    expect(container.querySelector('details summary')?.textContent).toBe('Transcript');
  });

  it('omits the transcript toggle when there is none', () => {
    const { container } = render(<AudioPlayer src="https://example.com/a.mp3" title="Clip" />);
    expect(container.querySelector('details')).toBeNull();
  });
});
