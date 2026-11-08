import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import { flatten, resample, type Pt } from './paths'
import { checkTrace, referenceStrokes, type LetterStrokes } from './tracing'

const data = YAML.parse(readFileSync(new URL('../../content/strokes/u1.yaml', import.meta.url), 'utf8'))
const ba: LetterStrokes = data.letters['ب'].isolated
const ta: LetterStrokes = data.letters['ت'].isolated
const alif: LetterStrokes = data.letters['ا'].isolated

const wobble = (s: Pt[], amt = 4): Pt[] => s.map(([x, y], i) => [x + Math.sin(i) * amt, y + Math.cos(i * 1.3) * amt])

describe('paths', () => {
  it('flattens and resamples', () => {
    const p = flatten('M0 0 L100 0')
    const r = resample(p, 11)
    expect(r).toHaveLength(11)
    expect(r[5][0]).toBeCloseTo(50, 0)
  })
})

describe('checkTrace', () => {
  it('accepts the reference itself', () => {
    expect(checkTrace(ba, referenceStrokes(ba)).ok).toBe(true)
  })
  it('accepts a wobbly but faithful trace', () => {
    const [body, dot] = referenceStrokes(ba)
    expect(checkTrace(ba, [wobble(body), dot]).ok).toBe(true)
  })
  it('flags a reversed stroke as direction', () => {
    const [body, dot] = referenceStrokes(ba)
    const r = checkTrace(ba, [[...body].reverse(), dot])
    expect(r.ok).toBe(false)
    expect(r.problems[0]).toMatchObject({ kind: 'direction' })
    expect(r.problems[0].message).toMatch(/right/)
  })
  it('flags alif drawn bottom-up', () => {
    const r = checkTrace(alif, [[...referenceStrokes(alif)[0]].reverse()])
    expect(r.problems[0].message).toBe('Start at the top and go down.')
  })
  it('flags dots before the body', () => {
    const [body, dot] = referenceStrokes(ba)
    expect(checkTrace(ba, [dot, body]).problems.map((p) => p.kind)).toContain('order')
  })
  it('flags missing or misplaced dots', () => {
    const [body] = referenceStrokes(ta)
    expect(checkTrace(ta, [body]).problems[0].kind).toBe('dots')
    expect(checkTrace(ta, [body, [[100, 160]], [[110, 160]]]).problems[0].kind).toBe('dots')
  })
  it('flags a scribble as shape', () => {
    const scribble: Pt[] = Array.from({ length: 40 }, (_, i) => [20 + i * 4, 40 + (i % 2) * 60])
    expect(checkTrace(alif, [scribble]).ok).toBe(false)
  })
})
