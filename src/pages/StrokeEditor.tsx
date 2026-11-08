import { useMemo, useState } from 'react'
import { markStrokes, saveStrokeOverride, strokeLetters, strokeMarks, strokeOverrides, strokesFor, type StrokeDef } from '../lib/course'
import { letterForm, type Position } from '../lib/arabic'
import { centroid, dist, length, type Pt } from '../lib/paths'
import { Guides, StrokeAnimator } from '../components/StrokeAnimator'
import { toPolyline, useInk } from '../components/ink'
import { useApp } from '../lib/app-state'
import { Button, Card } from '../components/ui'

const FORMS: Position[] = ['isolated', 'initial', 'medial', 'final']

/** Turn a raw ink stroke into a compact path (drop points closer than 5 units). */
function toPath(s: Pt[]): string {
  const kept: Pt[] = [s[0]]
  for (const p of s.slice(1)) if (dist(p, kept[kept.length - 1]) >= 5) kept.push(p)
  if (kept[kept.length - 1] !== s[s.length - 1]) kept.push(s[s.length - 1])
  return 'M' + kept.map((p) => `${Math.round(p[0])} ${Math.round(p[1])}`).join(' L')
}

/** Admin tool (C1): draw stroke data over the real font glyph, in writing order. */
export function StrokeEditor() {
  const { settings } = useApp()
  const [target, setTarget] = useState<{ kind: 'letter'; letter: string; form: Position } | { kind: 'mark'; mark: string }>({ kind: 'letter', letter: 'ب', form: 'isolated' })
  const [preview, setPreview] = useState(0)
  const [copied, setCopied] = useState(false)
  const [, bump] = useState(0)
  const ink = useInk({ penOnly: settings.penOnly })

  const key = target.kind === 'letter' ? `${target.letter}.${target.form}` : `mark.${target.mark}`
  const current = target.kind === 'letter' ? strokesFor(target.letter, target.form) : markStrokes(target.mark)
  const overridden = key in strokeOverrides()

  const drawn: StrokeDef | null = useMemo(() => {
    if (!ink.strokes.length) return null
    const bodies = ink.strokes.filter((s) => length(s) >= 16)
    const dots = ink.strokes.filter((s) => length(s) < 16).map(centroid).map(([x, y]) => ({ x: Math.round(x), y: Math.round(y) }))
    return { carrier: target.kind === 'mark', strokes: bodies.map((s) => ({ d: toPath(s), ...(target.kind === 'mark' ? { kind: 'mark' as const } : {}) })), ...(dots.length ? { dots } : {}) }
  }, [ink.strokes, target.kind])

  const glyph = target.kind === 'letter' ? letterForm(target.letter, target.form) : ''
  const yaml = drawn ? `${key}: ${JSON.stringify(drawn)}` : ''

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Stroke editor</h1>
        <p className="text-muted">Trace each stroke over the font, in the order and direction it is written. Body first, then dots (tap for a dot). Saved shapes apply in this browser at once; copy the line into <code>content/strokes/</code> to make it permanent.</p>
      </div>
      <Card className="space-y-3">
        <div className="flex flex-wrap gap-1" dir="rtl">
          {strokeLetters().map((l) => (
            <button key={l} onClick={() => { setTarget({ kind: 'letter', letter: l, form: target.kind === 'letter' ? target.form : 'isolated' }); ink.clear() }}
              className={`ar min-w-11 rounded-lg border px-2 text-2xl ${target.kind === 'letter' && target.letter === l ? 'border-brand bg-brand-soft' : 'border-line'}`}>{l}</button>
          ))}
          {strokeMarks().map((m) => (
            <button key={m} onClick={() => { setTarget({ kind: 'mark', mark: m }); ink.clear() }} dir="ltr"
              className={`min-w-11 rounded-lg border px-2 text-sm ${target.kind === 'mark' && target.mark === m ? 'border-brand bg-brand-soft' : 'border-line'}`}>{m}</button>
          ))}
        </div>
        {target.kind === 'letter' && (
          <div className="flex gap-1">
            {FORMS.map((f) => <button key={f} onClick={() => { setTarget({ ...target, form: f }); ink.clear() }} className={`rounded-lg px-3 py-1 text-sm ${target.form === f ? 'bg-brand text-on-brand' : 'bg-paper'}`}>{f}</button>)}
          </div>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-medium">Draw here</p>
          <div className="relative aspect-square rounded-3xl border border-line bg-paper">
            <svg viewBox="0 0 200 200" className="absolute inset-0 touch-none" style={{ touchAction: 'none' }} {...ink.handlers}>
              <Guides carrier={target.kind === 'mark'} />
              {glyph && <text x={100} y={132} textAnchor="middle" fontSize={150} className="ar fill-line" direction="rtl">{glyph}</text>}
              {current?.strokes.map((s, i) => <path key={i} d={s.d} className="fill-none stroke-brand/25" strokeWidth={3} strokeDasharray="4 3" />)}
              {ink.all.map((s, i) => s.length === 1 || length(s) < 16
                ? <circle key={i} cx={centroid(s)[0]} cy={centroid(s)[1]} r={6} className="fill-accent" />
                : <polyline key={i} points={toPolyline(s)} className="fill-none stroke-accent" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />)}
            </svg>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={ink.undo} disabled={!ink.strokes.length}>Undo</Button>
            <Button variant="ghost" onClick={ink.clear}>Clear</Button>
            <Button disabled={!drawn?.strokes.length} onClick={() => { saveStrokeOverride(key, drawn); ink.clear(); bump((x) => x + 1); setPreview((p) => p + 1) }}>Save</Button>
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Current {overridden ? '(your saved version)' : '(from content file)'}</p>
          <div className="relative aspect-square rounded-3xl border border-line bg-paper">
            {current && <StrokeAnimator def={current} playKey={preview + key.length} className="absolute inset-0" />}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setPreview((p) => p + 1)}>Replay</Button>
            {overridden && <Button variant="danger" onClick={() => { saveStrokeOverride(key, null); bump((x) => x + 1); setPreview((p) => p + 1) }}>Revert to file</Button>}
            {overridden && (
              <Button variant="ghost" onClick={async () => {
                await navigator.clipboard.writeText(`${key}: ${JSON.stringify(strokeOverrides()[key])}`)
                setCopied(true); setTimeout(() => setCopied(false), 1500)
              }}>{copied ? 'Copied' : 'Copy for content file'}</Button>
            )}
          </div>
        </div>
      </div>
      {yaml && <pre className="overflow-x-auto rounded-xl bg-paper p-3 text-xs text-muted" dir="ltr">{yaml}</pre>}
    </div>
  )
}
