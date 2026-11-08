import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { baseLetters, clean, contextualForms, letterForm } from '../lib/arabic'
import { speak } from '../lib/speech'
import { useApp } from '../lib/app-state'
import { Button } from './ui'

function shuffle<T>(a: T[], seed: number): T[] {
  const out = [...a]
  let s = seed
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

type Tile = { id: number; ch: string }

/**
 * Word builder: drag (or tap) letters into the row and watch them join.
 * The joined word is shaped as one string (Safari breaks joining across spans), and the
 * contextual form of each tile is shown underneath.
 */
export function WordBuilder({ word, distractors = [], onResult }: { word: string; distractors?: string[]; onResult?: (ok: boolean, response: string) => void }) {
  const { settings } = useApp()
  const target = useMemo(() => baseLetters(word), [word])
  const tray0 = useMemo<Tile[]>(() => shuffle([...target, ...distractors].map((ch, id) => ({ id, ch })), word.length * 31 + 7), [target, distractors, word])
  const [placed, setPlaced] = useState<Tile[]>([])
  const [result, setResult] = useState<boolean | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ tile: Tile; x: number; y: number; moved: boolean } | null>(null)

  const tray = tray0.filter((t) => !placed.some((p) => p.id === t.id))
  const letters = placed.map((t) => t.ch)
  const forms = contextualForms(letters)

  function place(t: Tile) { if (result) return; setPlaced((p) => (p.some((x) => x.id === t.id) ? p : [...p, t])) }
  function remove(t: Tile) { if (result) return; setPlaced((p) => p.filter((x) => x.id !== t.id)) }

  // The ref holds the live drag (handlers fire faster than React re-renders); state only drives the ghost tile.
  const dragRef = useRef<{ tile: Tile; x0: number; y0: number; moved: boolean } | null>(null)
  function onDown(e: PointerEvent<HTMLButtonElement>, tile: Tile) {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* unknown pointer id */ }
    dragRef.current = { tile, x0: e.clientX, y0: e.clientY, moved: false }
  }
  function onMove(e: PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current
    if (!d) return
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) d.moved = true
    if (d.moved) setDrag({ tile: d.tile, x: e.clientX, y: e.clientY, moved: true })
  }
  function onUp(e: PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!d) return
    const r = rowRef.current?.getBoundingClientRect()
    const overRow = r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 20 && e.clientY <= r.bottom + 20
    if (!d.moved || overRow) place(d.tile)
  }

  function check() {
    const ok = letters.join('') === target.join('')
    setResult(ok)
    onResult?.(ok, letters.join(''))
    if (ok) speak(clean(word), 'ar', { slow: settings.slow })
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div ref={rowRef} className={`flex min-h-36 w-full max-w-md flex-col items-center justify-center rounded-3xl border-2 border-dashed p-3 transition ${drag ? 'border-brand bg-brand-soft/40' : result === true ? 'border-success bg-success-soft' : result === false ? 'border-danger' : 'border-line'}`}>
        {placed.length === 0 ? (
          <p className="text-sm text-muted">Drag or tap letters here. Arabic fills from the right.</p>
        ) : (
          <>
            <span lang="ar" dir="rtl" className="ar text-6xl">{result ? clean(word) : letters.join('')}</span>
            <div className="mt-2 flex gap-1" dir="rtl">
              {placed.map((t, i) => (
                <button key={t.id} onClick={() => remove(t)} className="flex flex-col items-center rounded-lg border border-line bg-card px-2" aria-label="Remove letter">
                  <span lang="ar" className="ar text-2xl">{letterForm(t.ch, forms[i])}</span>
                  <span className="text-[10px] text-muted" dir="ltr">{forms[i]}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2" dir="rtl">
        {tray.map((t) => (
          <button key={t.id}
            onPointerDown={(e) => onDown(e, t)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}
            className={`ar grid size-16 touch-none place-items-center rounded-2xl border border-line bg-card text-4xl shadow-sm ${drag?.tile.id === t.id && drag.moved ? 'opacity-30' : ''}`}
            style={{ touchAction: 'none' }}>
            {t.ch}
          </button>
        ))}
      </div>
      {drag?.moved && (
        <div className="ar pointer-events-none fixed z-50 grid size-16 place-items-center rounded-2xl bg-brand text-4xl text-on-brand shadow-lg" style={{ left: drag.x - 32, top: drag.y - 32 }}>{drag.tile.ch}</div>
      )}

      <div className="flex gap-2">
        {result === false && <Button variant="ghost" onClick={() => { setPlaced([]); setResult(null) }}>Try again</Button>}
        {result === null && <Button variant="ghost" onClick={() => setPlaced([])} disabled={!placed.length}>Clear</Button>}
        {result === null && <Button onClick={check} disabled={!placed.length}>Check</Button>}
      </div>
    </div>
  )
}
