// Resolved exercise shapes shipped to the app (the build script expands `auto` entries into these).

export type Term = { ar: string; en?: string | null; tr?: string | null }

export type Exercise = { id: string; prompt?: string } & (
  | { type: 'listenPick'; answer: Term; options: Term[] }
  | { type: 'soundPick'; answer: string; options: string[]; listenFor?: string }
  | { type: 'match'; pairs: Term[] }
  | { type: 'trueFalse'; ar: string; claim: string; answer: boolean }
  | { type: 'flashcards'; cards: Term[] }
  | { type: 'fillBlank'; word: Term; blank: number; options: string[] }
  | { type: 'order'; items: string[]; hint?: string }
  | { type: 'trace'; letter?: string; form?: 'isolated' | 'initial' | 'medial' | 'final'; mark?: string }
  | { type: 'build'; word: Term; distractors: string[] }
  | { type: 'dictation'; word: Term }
  | { type: 'shadow'; term: Term; listenFor?: string; submit?: 'optional' | 'required' }
  | { type: 'sheet'; title: string; rows: SheetRow[]; submit?: 'optional' | 'required' }
)

/** A writing-sheet row: a ghost to trace (letter, word or $name) repeated, or empty practice boxes. */
export type SheetRow = { ghost?: string; repeat?: number; label?: string; empty?: number }

export type ExerciseType = Exercise['type']

/** Exercise types that are marked automatically (others are practice or self-rated). */
export const AUTO_MARKED: ExerciseType[] = ['listenPick', 'soundPick', 'match', 'trueFalse', 'fillBlank', 'order', 'trace', 'build', 'dictation']
