import { foldBoard } from '../src/games/note-board-model.js';
import type { NotesState } from '../src/games/live-text-model.js';

/** Which notes are in which column, by id, once the moves are applied (what `NoteBoard` draws). */
export function foldNote(state: NotesState): Record<string, string[]> {
  return Object.fromEntries(foldBoard(state.columns.map((c) => c.id), state.notes, state.moves).map((c) => [c.id, c.notes.map((n) => n.id)]));
}
