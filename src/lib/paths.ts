// Minimal SVG path sampler (absolute M, L, Q, C only). Works without a DOM so it can be unit-tested
// and used by the tracing checker. Stroke data in content/strokes uses only these commands.

export type Pt = [number, number]

type Seg = { kind: 'L'; p0: Pt; p1: Pt } | { kind: 'Q'; p0: Pt; c: Pt; p1: Pt } | { kind: 'C'; p0: Pt; c1: Pt; c2: Pt; p1: Pt }

export function parsePath(d: string): Seg[] {
  const tokens = d.match(/[MLQC]|-?\d*\.?\d+/g) ?? []
  const segs: Seg[] = []
  let cur: Pt = [0, 0]
  let cmd = ''
  let i = 0
  const num = () => Number(tokens[i++])
  while (i < tokens.length) {
    if (/[MLQC]/.test(tokens[i])) cmd = tokens[i++]
    if (cmd === 'M') { cur = [num(), num()]; cmd = 'L' }
    else if (cmd === 'L') { const p1: Pt = [num(), num()]; segs.push({ kind: 'L', p0: cur, p1 }); cur = p1 }
    else if (cmd === 'Q') { const c: Pt = [num(), num()]; const p1: Pt = [num(), num()]; segs.push({ kind: 'Q', p0: cur, c, p1 }); cur = p1 }
    else if (cmd === 'C') { const c1: Pt = [num(), num()]; const c2: Pt = [num(), num()]; const p1: Pt = [num(), num()]; segs.push({ kind: 'C', p0: cur, c1, c2, p1 }); cur = p1 }
    else throw new Error(`Unsupported path command in "${d}"`)
  }
  return segs
}

function at(s: Seg, t: number): Pt {
  const u = 1 - t
  if (s.kind === 'L') return [s.p0[0] * u + s.p1[0] * t, s.p0[1] * u + s.p1[1] * t]
  if (s.kind === 'Q') return [
    u * u * s.p0[0] + 2 * u * t * s.c[0] + t * t * s.p1[0],
    u * u * s.p0[1] + 2 * u * t * s.c[1] + t * t * s.p1[1],
  ]
  return [
    u ** 3 * s.p0[0] + 3 * u * u * t * s.c1[0] + 3 * u * t * t * s.c2[0] + t ** 3 * s.p1[0],
    u ** 3 * s.p0[1] + 3 * u * u * t * s.c1[1] + 3 * u * t * t * s.c2[1] + t ** 3 * s.p1[1],
  ]
}

/** Dense polyline for a path. */
export function flatten(d: string, perSeg = 24): Pt[] {
  const pts: Pt[] = []
  for (const s of parsePath(d)) for (let k = pts.length ? 1 : 0; k <= perSeg; k++) pts.push(at(s, k / perSeg))
  return pts
}

export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])

export function length(pts: Pt[]): number {
  let L = 0
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i])
  return L
}

/** Resample a polyline to n evenly spaced points. */
export function resample(pts: Pt[], n = 32): Pt[] {
  if (pts.length === 0) return []
  if (pts.length === 1) return Array.from({ length: n }, () => pts[0])
  const total = length(pts)
  if (total === 0) return Array.from({ length: n }, () => pts[0])
  const step = total / (n - 1)
  const out: Pt[] = [pts[0]]
  let acc = 0
  let prev = pts[0]
  for (let i = 1; i < pts.length && out.length < n; i++) {
    let cur = pts[i]
    let d = dist(prev, cur)
    while (acc + d >= step && out.length < n) {
      const t = (step - acc) / d
      const q: Pt = [prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]
      out.push(q)
      prev = q
      d = dist(prev, cur)
      acc = 0
    }
    acc += d
    prev = cur
    cur = pts[i]
  }
  while (out.length < n) out.push(pts[pts.length - 1])
  return out
}

export function centroid(pts: Pt[]): Pt {
  const n = pts.length || 1
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n]
}
