import { describe, expect, it } from 'vitest'
import { resolveExercises } from './exercises'

const words = [
  { ar: 'باب', en: 'door', tr: 'bāb', concrete: true, priority: 1, rank: 419 },
  { ar: 'بَيْت', en: 'house', tr: 'bayt', concrete: true, priority: 1, rank: 220 },
  { ar: 'بِنْت', en: 'girl', tr: 'bint', concrete: true, priority: 1, rank: null },
]
const base = { lessonId: 'u1-x', stepKind: 'exercises', pool: words, allWords: words, teaches: [] }

describe('resolveExercises', () => {
  it('rejects words with untaught letters', () => {
    const errors: string[] = []
    resolveExercises({ ...base, raw: [{ type: 'build', word: 'كِتاب' }], taught: new Set(['alif', 'ba', 'ta', 'kasra']), errors })
    expect(errors[0]).toMatch(/not taught/)
  })
  it('expands auto items from the readable pool with glosses', () => {
    const errors: string[] = []
    const taught = new Set(['alif', 'ba', 'ta', 'ya', 'nun', 'fatha', 'kasra', 'sukun'])
    const out = resolveExercises({ ...base, raw: [{ type: 'listenPick', auto: 2 }, { type: 'match', auto: 3 }], taught, errors })
    expect(errors).toEqual([])
    expect(out.map((e) => e.type)).toEqual(['listenPick', 'listenPick', 'match'])
    const lp = out[0] as Extract<typeof out[0], { type: 'listenPick' }>
    expect(lp.options).toHaveLength(3)
    expect(lp.options.map((o) => o.ar)).toContain(lp.answer.ar)
  })
})
