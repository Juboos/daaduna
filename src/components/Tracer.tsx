import { useState } from 'react'
import { useApp } from '../lib/app-state'
import type { StrokeDef } from '../lib/course'
import { checkTrace, type TraceResult } from '../lib/tracing'
import { flatten } from '../lib/paths'
import { Guides, StrokeAnimator } from './StrokeAnimator'
import { toPolyline, useInk } from './ink'
import { Button } from './ui'

/** Trace over a ghost letter; checks stroke count, order, direction and shape. */
export function Tracer({ def, onResult }: { def: StrokeDef; onResult?: (r: TraceResult) => void }) {
  const { settings } = useApp()
  const [result, setResult] = useState<TraceResult | null>(null)
  const [demo, setDemo] = useState(0)
  const ink = useInk({ penOnly: settings.penOnly, disabled: !!result?.ok })

  function check() {
    const r = checkTrace(def, ink.strokes)
    setResult(r)
    onResult?.(r)
  }
  function again() { ink.clear(); setResult(null) }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="relative aspect-square w-full max-w-sm rounded-3xl border border-line bg-paper">
        {demo > 0 ? (
          <StrokeAnimator def={def} playKey={demo} className="absolute inset-0" />
        ) : (
          <svg viewBox="0 0 200 200" className="absolute inset-0 touch-none select-none" style={{ touchAction: 'none' }} {...ink.handlers}>
            <Guides carrier={def.carrier} />
            {def.strokes.map((s, i) => <path key={i} d={s.d} className="fill-none stroke-line" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />)}
            {def.dots?.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={8} className="fill-none stroke-line" strokeWidth={2} strokeDasharray="3 3" />)}
            {def.strokes.map((s, i) => {
              const [x, y] = flatten(s.d, 2)[0]
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={7} className="fill-brand" />
                  <text x={x} y={y + 3.5} textAnchor="middle" fontSize={9} className="fill-on-brand font-semibold">{i + 1}</text>
                </g>
              )
            })}
            {ink.all.map((s, i) => s.length === 1
              ? <circle key={i} cx={s[0][0]} cy={s[0][1]} r={6} className={result?.ok ? 'fill-success' : 'fill-brand'} />
              : <polyline key={i} points={toPolyline(s)} className={`fill-none ${result?.ok ? 'stroke-success' : 'stroke-brand'}`} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />)}
          </svg>
        )}
      </div>

      {result && (
        <div className={`pop-in w-full max-w-sm rounded-2xl px-4 py-3 text-sm ${result.ok ? 'bg-success-soft text-success' : 'bg-accent-soft text-ink'}`}>
          {result.ok ? 'Well traced.' : result.problems.slice(0, 2).map((p, i) => <p key={i}>{p.message}</p>)}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="ghost" onClick={() => { setDemo((d) => d + 1); setTimeout(() => setDemo(0), 4000) }}>Show me</Button>
        {!result?.ok && <Button variant="ghost" onClick={ink.undo} disabled={!ink.strokes.length}>Undo</Button>}
        <Button variant="ghost" onClick={again}>{result?.ok ? 'Trace again' : 'Clear'}</Button>
        {!result?.ok && <Button onClick={check} disabled={!ink.strokes.length}>Check</Button>}
      </div>
      {settings.penOnly && <p className="text-xs text-muted">Pen only is on: finger touches are ignored.</p>}
    </div>
  )
}
