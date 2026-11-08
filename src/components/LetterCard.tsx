import { useEffect, useState } from 'react'
import { course, strokesFor } from '../lib/course'
import { letterForm, type Position } from '../lib/arabic'
import { speak } from '../lib/speech'
import { useApp } from '../lib/app-state'
import { StrokeAnimator } from './StrokeAnimator'
import { Icon } from './ui'

const FORMS: Position[] = ['isolated', 'initial', 'medial', 'final']

/** Letter card: name, four forms, animated stroke order. `drawKey` > 0 plays the animation (narration cue). */
export function LetterCard({ letter, drawKey = 1, compact = false }: { letter: string; drawKey?: number; compact?: boolean }) {
  const { settings } = useApp()
  const item = course.items.find((i) => i.glyph === letter)
  const [form, setForm] = useState<Position>('isolated')
  const [play, setPlay] = useState(drawKey)
  useEffect(() => setPlay(drawKey), [drawKey])
  const def = strokesFor(letter, form)

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <button onClick={() => speak(letter, 'ar', { slow: settings.slow })} className="flex items-baseline gap-2 rounded-xl px-3 py-1 hover:bg-brand-soft">
        <span className="text-lg font-semibold">{item?.name ?? letter}</span>
        <span className="text-muted">{Icon.speaker}</span>
      </button>
      <div className={`relative aspect-square w-full ${compact ? 'max-w-40' : 'max-w-52'} rounded-3xl border border-line bg-paper`}>
        {def && play > 0
          ? <StrokeAnimator def={def} playKey={play * 10 + FORMS.indexOf(form)} className="absolute inset-0" />
          : <span lang="ar" dir="rtl" className="ar absolute inset-0 grid place-items-center text-9xl">{letterForm(letter, form)}</span>}
        {def && (
          <button onClick={() => setPlay((p) => p + 1)} className="absolute end-2 bottom-2 rounded-full bg-card p-2 text-muted shadow-sm hover:text-ink" aria-label="Replay stroke order">{Icon.replay}</button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2" dir="rtl">
        {FORMS.map((f) => (
          <button key={f} onClick={() => { setForm(f); setPlay((p) => Math.max(p, 1) + 1) }}
            className={`flex flex-col items-center rounded-xl border px-3 py-1 ${form === f ? 'border-brand bg-brand-soft' : 'border-line bg-paper'}`}>
            <span lang="ar" className="ar text-3xl">{letterForm(letter, f)}</span>
            <span className="text-[11px] text-muted" dir="ltr">{f}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
