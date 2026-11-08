import { createContext, useContext } from 'react'
import type { Settings } from './backend'

/** Which unit the student is in, so transliteration can fade out as the course goes on. */
export const LessonCtx = createContext<{ unitOrder: number | null }>({ unitOrder: null })
export const useLessonCtx = () => useContext(LessonCtx)

/** Transliteration fade (default A4): on in Units 0–2, tap-to-reveal in 3–4, off from 5. */
export function translitMode(s: Settings, unitOrder: number | null): 'show' | 'tap' | 'hide' {
  if (s.translit === 'on') return 'show'
  if (s.translit === 'off') return 'hide'
  if (unitOrder === null || unitOrder <= 2) return 'show'
  return unitOrder <= 4 ? 'tap' : 'hide'
}

/** Whether the surrounding lesson section is the one in focus (only it may auto-play audio or take keys). */
export const SectionCtx = createContext<{ active: boolean }>({ active: true })
export const useSection = () => useContext(SectionCtx)
