import data from '../generated/course.json'
import type { Exercise } from './exercise-types'

export type Visual = { type: string; [k: string]: unknown }
export type Cue = { at: string; action: 'draw' | 'show' }
export type Slide = { id: string; narration: string; visual: Visual; audio?: string; cues?: Cue[] }
export type Step = { kind: 'learn' | 'write' | 'listen' | 'read' | 'speak' | 'exercises'; slides: Slide[]; exercises: Exercise[] }
export type Lesson = { id: string; type: string; title: string; draft: boolean; free?: boolean; teaches: string[]; steps: Step[] }
export type Unit = { id: string; order: number; title: string; milestone: string }
export type Item = { id: string; group: 'letters' | 'variants' | 'marks' | 'digits' | 'mechanics'; glyph?: string; mark?: string; name: string; order: number }
export type Word = { id: string; source: 'core' | 'alsaid'; rank: number | null; ar: string; en: string | null; tr: string | null; concrete: boolean; priority: number; image?: string }

export const course = data as unknown as {
  units: Unit[]; lessons: Lesson[]; items: Item[]; words: Word[]; readingSets: Record<string, string[]>
}

export const lessonsOf = (unitId: string) => course.lessons.filter((l) => l.id.startsWith(unitId + '-'))
export const lessonById = (id: string) => course.lessons.find((l) => l.id === id)
export const wordById = (id: string) => course.words.find((w) => w.id === id)

/** Lessons never block: lesson n+1 opens when lesson n is completed. */
export function isUnlocked(lessonId: string, completed: Set<string>): boolean {
  const i = course.lessons.findIndex((l) => l.id === lessonId)
  return i <= 0 || completed.has(course.lessons[i - 1].id)
}

export function nextLesson(lessonId: string): Lesson | undefined {
  const i = course.lessons.findIndex((l) => l.id === lessonId)
  return course.lessons[i + 1]
}

/** Covered letter table = union of taught items over completed lessons. Computed, so reset clears it. */
export function coveredItems(completed: Set<string>): Set<string> {
  const s = new Set<string>()
  for (const l of course.lessons) if (completed.has(l.id)) l.teaches.forEach((t) => s.add(t))
  return s
}

// ---- strokes
import type { LetterStrokes } from './tracing'
import type { Position } from './arabic'
export type StrokeDef = LetterStrokes & { carrier?: boolean }
const strokeData = (data as unknown as { strokes: { letters: Record<string, Record<Position, StrokeDef>>; marks: Record<string, StrokeDef> } }).strokes

const OVERRIDE_KEY = 'daaduna.strokes.override'
export function strokeOverrides(): Record<string, StrokeDef> {
  try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) ?? '{}') } catch { return {} }
}
export function saveStrokeOverride(key: string, def: StrokeDef | null) {
  const o = strokeOverrides()
  if (def) o[key] = def
  else delete o[key]
  try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o)) } catch { /* ignore */ }
}

/** Stroke data for a letter form (Admin overrides from the stroke editor win). */
export function strokesFor(letter: string, form: Position = 'isolated'): StrokeDef | undefined {
  return strokeOverrides()[`${letter}.${form}`] ?? strokeData.letters[letter]?.[form]
}
export function markStrokes(mark: string): StrokeDef | undefined {
  return strokeOverrides()[`mark.${mark}`] ?? strokeData.marks[mark]
}
export const strokeLetters = () => Object.keys(strokeData.letters)
export const strokeMarks = () => Object.keys(strokeData.marks)
