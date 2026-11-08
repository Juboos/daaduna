import { useMemo } from 'react'
import { flatten, length } from '../lib/paths'
import type { StrokeDef } from '../lib/course'

const MS_PER_UNIT = 4.5 // drawing speed
const GAP = 250 // pause between strokes

/** Draws a letter stroke by stroke, the way it is written. Change `playKey` to replay. */
export function StrokeAnimator({ def, playKey = 0, className = '', showGhost = true }: { def: StrokeDef; playKey?: number; className?: string; showGhost?: boolean }) {
  const timeline = useMemo(() => {
    let t = 0
    const strokes = def.strokes.map((s) => {
      const dur = Math.max(350, length(flatten(s.d)) * MS_PER_UNIT)
      const item = { d: s.d, delay: t, dur }
      t += dur + GAP
      return item
    })
    const dots = (def.dots ?? []).map((d) => { const item = { ...d, delay: t }; t += 220; return item })
    return { strokes, dots }
  }, [def])

  return (
    <svg key={playKey} viewBox="0 0 200 200" className={`touch-none select-none ${className}`} aria-hidden>
      <Guides carrier={def.carrier} />
      {showGhost && def.strokes.map((s, i) => <path key={i} d={s.d} className="fill-none stroke-line" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />)}
      {showGhost && def.dots?.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={7} className="fill-line" />)}
      {timeline.strokes.map((s, i) => (
        <path
          key={i} d={s.d} pathLength={1}
          className="fill-none stroke-brand" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: `stroke-draw ${s.dur}ms ease-in-out ${s.delay}ms forwards` }}
        />
      ))}
      {timeline.dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={6.5} className="fill-brand"
          style={{ transformOrigin: `${d.x}px ${d.y}px`, transform: 'scale(0)', animation: `dot-pop 220ms ease-out ${d.delay}ms forwards` }} />
      ))}
    </svg>
  )
}

export function Guides({ carrier }: { carrier?: boolean }) {
  return (
    <>
      <line x1={10} x2={190} y1={132} y2={132} className="stroke-brand/30" strokeWidth={1.5} strokeDasharray="4 4" />
      {carrier && <path d="M150 132 L50 132" className="stroke-muted/40" strokeWidth={6} strokeLinecap="round" />}
    </>
  )
}
