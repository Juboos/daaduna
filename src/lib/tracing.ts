// Tracing checker: stroke count, order (body before dots), direction and shape.
// Tolerant on purpose: beginners' strokes are wobbly. Coordinates are in the 200×200 letter box.
import { centroid, dist, flatten, length, resample, type Pt } from './paths'

export type StrokeDef = { d: string; kind?: 'body' | 'mark' }
export type DotDef = { x: number; y: number }
export type LetterStrokes = { strokes: StrokeDef[]; dots?: DotDef[] }

export type Problem =
  | { kind: 'count'; message: string }
  | { kind: 'order'; message: string }
  | { kind: 'direction'; stroke: number; message: string }
  | { kind: 'shape'; stroke: number; message: string }
  | { kind: 'dots'; message: string }

export type TraceResult = { ok: boolean; problems: Problem[]; score: number }

const N = 32
const DOT_MAX_LEN = 16 // a stroke shorter than this counts as a dot/tap
const SHAPE_TOL = 20 // mean distance (units of the 200 box) allowed per stroke
const DOT_TOL = 24

const meanDist = (a: Pt[], b: Pt[]) => a.reduce((s, p, i) => s + dist(p, b[i]), 0) / a.length

export function checkTrace(ref: LetterStrokes, user: Pt[][]): TraceResult {
  const problems: Problem[] = []
  const strokes = user.filter((s) => s.length > 0)
  const isDot = (s: Pt[]) => length(s) < DOT_MAX_LEN
  const userBodies = strokes.filter((s) => !isDot(s))
  const userDots = strokes.filter(isDot).map(centroid)
  const refDots = ref.dots ?? []

  if (strokes.length === 0) return { ok: false, problems: [{ kind: 'count', message: 'Trace the letter on the grey guide.' }], score: 0 }

  // Order: Arabic convention writes the body first, then dots.
  const firstDot = strokes.findIndex(isDot)
  const lastBody = strokes.map((s, i) => (isDot(s) ? -1 : i)).reduce((a, b) => Math.max(a, b), -1)
  if (refDots.length && firstDot !== -1 && firstDot < lastBody)
    problems.push({ kind: 'order', message: 'Write the main shape first, then add the dots.' })

  if (userBodies.length !== ref.strokes.length) {
    problems.push({
      kind: 'count',
      message: ref.strokes.length === 1
        ? `This letter is one stroke. You drew ${userBodies.length}. Try it without lifting your finger.`
        : `This letter has ${ref.strokes.length} strokes. You drew ${userBodies.length}.`,
    })
  }

  let shapeScore = 0
  const pairs = Math.min(userBodies.length, ref.strokes.length)
  for (let i = 0; i < pairs; i++) {
    const r = resample(flatten(ref.strokes[i].d), N)
    const u = resample(userBodies[i], N)
    const fwd = meanDist(u, r)
    const rev = meanDist([...u].reverse(), r)
    if (rev + 4 < fwd && rev < SHAPE_TOL) {
      problems.push({ kind: 'direction', stroke: i, message: directionHint(r) })
    } else if (fwd > SHAPE_TOL) {
      problems.push({ kind: 'shape', stroke: i, message: 'Stay closer to the grey guide.' })
    }
    shapeScore += Math.max(0, 1 - Math.min(fwd, rev) / (SHAPE_TOL * 2))
  }

  if (userDots.length !== refDots.length) {
    problems.push({ kind: 'dots', message: refDots.length === 0 ? 'This letter has no dots.' : `Add ${refDots.length === 1 ? 'one dot' : refDots.length + ' dots'}, ${refDots[0].y > 130 ? 'below' : 'above'} the letter.` })
  } else {
    const left = [...userDots]
    for (const d of refDots) {
      const j = left.findIndex((u) => dist(u, [d.x, d.y]) < DOT_TOL)
      if (j === -1) { problems.push({ kind: 'dots', message: `Put the dots ${d.y > 130 ? 'below' : 'above'} the letter, on the guide.` }); break }
      left.splice(j, 1)
    }
  }

  const score = pairs ? shapeScore / ref.strokes.length : 0
  return { ok: problems.length === 0, problems, score }
}

function directionHint(ref: Pt[]): string {
  const [s, e] = [ref[0], ref[ref.length - 1]]
  const dx = e[0] - s[0], dy = e[1] - s[1]
  if (Math.abs(dy) > Math.abs(dx)) return dy > 0 ? 'Start at the top and go down.' : 'Start at the bottom and go up.'
  return dx < 0 ? 'Start on the right and move left.' : 'Start on the left and move right.'
}

/** Reference points of a letter (useful for tests and demo playback). */
export function referenceStrokes(ref: LetterStrokes): Pt[][] {
  return [...ref.strokes.map((s) => flatten(s.d)), ...(ref.dots ?? []).map((d) => [[d.x, d.y] as Pt])]
}
